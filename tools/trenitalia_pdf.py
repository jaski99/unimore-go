"""Extract train runs between selected stations from the Trenitalia regional PDF.

Reproducible replacement for the manual transcription of ``data/trains.json``.
The official timetable ``Regionale_Emilia.pdf`` is a set of tables: one column
per train, one row per station, with the train category glyph, the number,
service symbols and note keys in the column header and the note texts in a
sidebar on the same page.

Facts verified on the edition valid 17/10–12/12/2026 (SHA-256 below):

* quadro 1 (Bologna–Milano, both directions) prints **no day-of-week symbol**
  in its column headers: every restriction is a numbered note, so a column
  without a restricting note runs every day of the edition;
* note keys in headers are either boxed characters (``8`` = "Servizio di
  Trenitalia Tper") or numbers encoded with ``chr(digit + 33)`` per digit;
* cell markers: ``|`` passes without stopping, ``·`` does not serve the
  station, ``!`` boarding only, ``"`` alighting only, ``:`` stops only in the
  periods given by a note (excluded: the stop note is not machine-readable).

The module is split in two layers: :func:`read_pdf_pages` adapts PyMuPDF to
plain :class:`Word` records; everything else is pure and unit-tested.

Usage::

    python tools/trenitalia_pdf.py path/to/Regionale_Emilia.pdf --out data/trains.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass, field
from pathlib import Path

PDF_URL = (
    "https://www.trenitalia.com/content/dam/trenitalia/allegati/info/orario-digitale/"
    "orari-regionali/Regionale_Emilia.pdf"
)
PDF_SHA256 = "80f3c07b96214ce8c5b8b9ba7f00541e20feb448f4c666722617653d11ee4cd3"
EDITION = ("2026-10-17", "2026-12-12")
# File pages (1-based): quadro 1 Bologna–Milano (13–128) and quadro 2 Bologna–Torino/Genova
# (129–148), both directions. Quadro 2 has no Rubiera row.
TIMETABLE_PAGES = range(13, 149)
STATIONS = ("Reggio Emilia", "Rubiera", "Modena")
ALL_DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")

# Category glyphs of the table symbol font (``infotra1``), checked visually.
CATEGORY_GLYPHS = {
    "L": "Regionale",
    "o": "Regionale Veloce",
    "C": "Intercity",
    "A": "Intercity Notte",
    "¥": "Frecciarossa",
    "B": "EuroCity",
    "M": "Suburbano",
}
SYMBOL_FONT = "infotra1"
NOTE_KEY_FONTS = ("Infotra2", "FontTimeNotes")
TIME_RE = re.compile(r"^\d{2}\.\d{2}$")
NUMBER_RE = re.compile(r"^[A-Z]?\d{2,5}[A-Z]?$")
TIME_OFFSET = 8.0  # time cells are right-aligned ~8 pt right of the number centre
ROW_TOLERANCE = 1.6
MIN_MINUTES, MAX_MINUTES = 3, 45
# Columns whose notes make them unusable with an ordinary ticket (sleeper-only ICN).
UNUSABLE_NOTE = re.compile(r"Sono ammessi esclusivamente i viaggiatori muniti di biglietto", re.I)


@dataclass(frozen=True)
class Word:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    font: str = ""

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2


@dataclass
class Cell:
    time: str | None = None  # "HH:MM"
    marker: str = ""  # "|", "·", "!", '"', ":" or ""


@dataclass
class Column:
    center: float
    number: str
    category: str
    note_keys: list[str] = field(default_factory=list)
    cells: dict[tuple[str, str], Cell] = field(default_factory=dict)  # (station, arr|dep)


@dataclass
class PageTable:
    file_page: int
    printed_page: str
    title: str
    rows: list[tuple[str, str, float]]  # (station label, "arr"|"dep", y)
    columns: list[Column]
    notes: dict[str, str]


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def decode_key(raw: str) -> str:
    """Printed note label: encoded digits (``$&`` -> ``35``) or the boxed character."""
    if raw and all("!" <= ch <= "*" for ch in raw):
        return "".join(str(ord(ch) - 33) for ch in raw)
    return raw


def to_clock(token: str) -> str:
    return token.replace(".", ":")


def minutes(clock: str) -> int:
    hours, mins = clock.split(":")
    return int(hours) * 60 + int(mins)


def duration(depart: str, arrive: str) -> int:
    delta = minutes(arrive) - minutes(depart)
    return delta + 24 * 60 if delta < 0 else delta


def group_lines(words: Iterable[Word], tolerance: float = 1.0) -> list[list[Word]]:
    """Group words into text lines by their top coordinate."""
    lines: list[list[Word]] = []
    for word in sorted(words, key=lambda w: (w.y0, w.x0)):
        if lines and abs(lines[-1][0].y0 - word.y0) <= tolerance:
            lines[-1].append(word)
        else:
            lines.append([word])
    return [sorted(line, key=lambda w: w.x0) for line in lines]


def parse_sidebar(words: Sequence[Word]) -> dict[str, str]:
    """Map raw note keys to their full text (continuation lines joined).

    A line starting with a word in a note-key font opens a new note; lines
    without a key continue the previous one. Hyphenated line breaks are
    rebuilt ("lavo-" + "rativi").
    """
    notes: dict[str, str] = {}
    current: str | None = None
    for line in group_lines(words):
        first = line[0]
        if first.font in NOTE_KEY_FONTS and len(line) > 1:
            current = first.text
            notes[current] = " ".join(w.text for w in line[1:])
        elif current is not None:
            text = " ".join(w.text for w in line)
            previous = notes[current]
            if previous.endswith("-") and not previous.endswith(" -"):
                notes[current] = previous[:-1] + text
            else:
                notes[current] = f"{previous} {text}"
    return {key: " ".join(text.split()) for key, text in notes.items()}


def _nearest(columns: Sequence[Column], x: float, max_distance: float) -> Column | None:
    best = min(columns, key=lambda c: abs(c.center - x), default=None)
    if best is None or abs(best.center - x) > max_distance:
        return None
    return best


def parse_page(words: Sequence[Word], file_page: int) -> list[PageTable]:
    """Split a page into its tables (one per "Km" header label) and parse each."""
    anchors = sorted((w for w in words if w.text == "Km"), key=lambda w: w.y0)
    quadro = next(
        (w for w in words if w.y0 < 20 and w.font == "Arial-BoldMT" and w.text.isdigit()), None
    )
    if not anchors or quadro is None:
        return []
    labels_x = min(w.x0 for w in words if w.text == "Km")
    if quadro.x0 < labels_x:
        sidebar = [w for w in words if w.x1 < labels_x - 2 and 44 < w.y0 < 385]
        table_hi = 553.0
    else:
        sidebar = [w for w in words if w.x0 >= quadro.x0 - 1 and 44 < w.y0 < 385]
        table_hi = quadro.x0 - 2
    notes = parse_sidebar(sidebar)
    printed = next((w.text for w in words if w.y0 > 385 and w.text.isdigit()), "")
    title = " ".join(
        w.text
        for w in sorted(words, key=lambda w: (w.y0, w.x0))
        if w.y0 < 45 and w.font == "Arial-BoldMT" and abs(w.x0 - quadro.x0) < 60 and w is not quadro
    )
    tables = []
    for i, anchor in enumerate(anchors):
        top = anchor.y0 - 40
        bottom = anchors[i + 1].y0 - 40 if i + 1 < len(anchors) else 386
        band = [w for w in words if top <= w.y0 < bottom and (w.x0 < table_hi or w in sidebar)]
        table = parse_table(band, anchor, labels_x, table_hi, file_page)
        if table is not None:
            table.printed_page, table.title, table.notes = printed, title, notes
            tables.append(table)
    return tables


def parse_table(
    words: Sequence[Word], anchor: Word, labels_x: float, table_hi: float, file_page: int
) -> PageTable | None:
    """Parse one table whose "Km" header label is ``anchor``."""
    label_lo, label_hi = labels_x + 10, labels_x + 58  # station names start ~10 pt after "Km"
    table_lo = labels_x + 76

    # Train numbers: the header line with the most number-like words.
    candidates = [
        w
        for w in words
        if w.y0 < anchor.y0 and table_lo <= w.x0 < table_hi and NUMBER_RE.match(w.text)
    ]
    if not candidates:
        return None
    by_line = group_lines(candidates)
    number_line = max(by_line, key=len)
    number_y = number_line[0].y0
    columns = [Column(center=w.cx, number=w.text, category="") for w in number_line]
    spacing = min(
        (b.center - a.center for a, b in zip(columns, columns[1:], strict=False)), default=30
    )
    reach = spacing / 2 - 0.5

    for word in words:
        if not (table_lo - 6 <= word.x0 < table_hi) or word.y0 >= anchor.y0 - 0.5:
            continue
        if word.y0 < number_y - 3 and word.font == SYMBOL_FONT:
            column = _nearest(columns, word.cx, reach)
            if column and word.text in CATEGORY_GLYPHS:
                column.category = CATEGORY_GLYPHS[word.text]
        elif word.y0 > number_y + 3 and word.font in NOTE_KEY_FONTS:
            column = _nearest(columns, word.cx, reach)
            if column:
                column.note_keys.append(word.text)

    rows: list[tuple[str, str, float]] = []
    for line in group_lines(w for w in words if label_lo - 1 <= w.x0 < labels_x + 73):
        label = " ".join(w.text for w in line if w.x0 < label_hi)
        kind = "arr" if any(w.text == "a" and w.x0 >= label_hi for w in line) else "dep"
        if label in STATIONS:
            rows.append((label, kind, line[0].y0))

    time_columns = [
        Column(center=c.center + TIME_OFFSET, number=c.number, category="") for c in columns
    ]
    for label, kind, y in rows:
        cells = sorted(
            (
                w
                for w in words
                if table_lo - 6 <= w.x0 < table_hi and abs(w.y0 - y) <= ROW_TOLERANCE
            ),
            key=lambda w: w.x0,
        )
        pending_marker: tuple[float, str] | None = None
        for word in cells:
            if word.text in ("!", '"', ":"):
                pending_marker = (word.x1, word.text)
                continue
            target = _nearest(time_columns, word.cx, reach + 2)
            if target is None:
                continue
            column = columns[time_columns.index(target)]
            if TIME_RE.match(word.text):
                marker = ""
                if pending_marker and 0 <= word.x0 - pending_marker[0] < 8:
                    marker = pending_marker[1]
                column.cells[(label, kind)] = Cell(to_clock(word.text), marker)
            elif word.text in ("|", "·"):
                column.cells.setdefault((label, kind), Cell(None, word.text))
            pending_marker = None

    return PageTable(file_page, "", "", rows, columns, {})


def _departure(column: Column, station: str) -> Cell | None:
    return column.cells.get((station, "dep"))


def _arrival(column: Column, station: str) -> Cell | None:
    cell = column.cells.get((station, "arr"))
    if cell and cell.time:
        return cell
    return column.cells.get((station, "dep"))


def operator_for(notes: Iterable[str]) -> str:
    for text in notes:
        match = re.match(r"Servizio di (Trenitalia Tper|Trenitalia|Trenord|Tper)\b", text)
        if match:
            return match.group(1)
    return "Trenitalia"


def calendar_note(column: Column, notes: dict[str, str]) -> str:
    """All header notes of the column, as sentences (they all apply together)."""
    parts = []
    for raw in dict.fromkeys(column.note_keys):
        text = notes.get(raw)
        if text:
            sentence = text if text.endswith(".") else f"{text}."
            parts.append(f"Nota {decode_key(raw)}: {sentence}")
    return " ".join(parts)


def runs_from_table(table: PageTable, report: list[str]) -> list[dict]:
    """Runs for every ordered pair of target stations served by each column."""
    order = []
    for label, _kind, _y in sorted(table.rows, key=lambda r: r[2]):
        if label not in order:
            order.append(label)
    runs: list[dict] = []
    for column in table.columns:
        where = f"{column.number} pag. {table.file_page}"
        if not column.category:
            report.append(f"skip {where}: category glyph not recognised (bus or unknown)")
            continue
        if column.number.startswith("B") or column.category == "Suburbano":
            report.append(f"skip {where}: {column.category or 'bus'}")
            continue
        if any(UNUSABLE_NOTE.search(table.notes.get(k, "")) for k in column.note_keys):
            report.append(f"skip {where}: sleeper/couchette ticket only")
            continue
        for i, origin in enumerate(order):
            dep = _departure(column, origin)
            if not dep or not dep.time or dep.marker in ('"', ":"):
                if dep and dep.time and dep.marker:
                    report.append(f"skip {where} from {origin}: stop marker {dep.marker!r}")
                continue
            for destination in order[i + 1 :]:
                arr = _arrival(column, destination)
                if not arr or not arr.time:
                    continue
                if arr.marker in ("!", ":"):
                    report.append(f"skip {where} to {destination}: stop marker {arr.marker!r}")
                    continue
                span = duration(dep.time, arr.time)
                if not MIN_MINUTES <= span <= MAX_MINUTES:
                    report.append(f"skip {where} {origin}->{destination}: {span} min")
                    continue
                note_texts = [table.notes[k] for k in column.note_keys if k in table.notes]
                labels = ", ".join(decode_key(k) for k in dict.fromkeys(column.note_keys))
                runs.append(
                    {
                        "from": origin,
                        "to": destination,
                        "depart": dep.time,
                        "arrive": arr.time,
                        "train": column.number,
                        "category": column.category,
                        "operator": operator_for(note_texts),
                        "days": list(ALL_DAYS),
                        "valid_from": EDITION[0],
                        "valid_to": EDITION[1],
                        "calendar_note": calendar_note(column, table.notes),
                        "source": (
                            f"{PDF_URL}#page={table.file_page} (pagina stampata "
                            f"{table.printed_page}; note {labels or '-'})"
                        ),
                    }
                )
    return runs


def dedupe(runs: Iterable[dict]) -> list[dict]:
    """Drop exact duplicates (same column printed twice); keep variants with other notes."""
    seen: set[tuple] = set()
    kept = []
    for run in runs:
        key = (
            run["from"],
            run["to"],
            run["train"],
            run["depart"],
            run["arrive"],
            run["calendar_note"],
        )
        if key not in seen:
            seen.add(key)
            kept.append(run)
    return sorted(kept, key=lambda r: (r["from"], r["to"], r["depart"], r["train"]))


# ---------------------------------------------------------------------------
# PDF adapter
# ---------------------------------------------------------------------------


def read_pdf_pages(
    path: Path, pages: Iterable[int]
) -> Iterator[tuple[int, list[Word]]]:  # pragma: no cover - needs the PDF
    import pymupdf  # optional dependency: pip install -e ".[data]"

    doc = pymupdf.open(path)
    for file_page in pages:
        page = doc[file_page - 1]
        spans = [
            (span["bbox"], span["font"])
            for block in page.get_text("dict")["blocks"]
            for line in block.get("lines", [])
            for span in line["spans"]
        ]
        words = []
        for x0, y0, x1, y1, text, *_ in page.get_text("words"):
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            font = next((f for b, f in spans if b[0] <= cx <= b[2] and b[1] <= cy <= b[3]), "")
            words.append(Word(x0, y0, x1, y1, text, font))
        yield file_page, words


def sha256(path: Path) -> str:  # pragma: no cover - IO
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main(argv: Sequence[str] | None = None) -> int:  # pragma: no cover - CLI
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--report", type=Path, default=None)
    args = parser.parse_args(argv)
    digest = sha256(args.pdf)
    if digest != PDF_SHA256:
        print(f"SHA-256 mismatch: {digest} (expected {PDF_SHA256}); new edition?", file=sys.stderr)
        return 2
    report: list[str] = []
    runs: list[dict] = []
    for file_page, words in read_pdf_pages(args.pdf, TIMETABLE_PAGES):
        tables = parse_page(words, file_page)
        if not tables:
            report.append(f"page {file_page}: no table")
        for table in tables:
            runs.extend(runs_from_table(table, report))
    runs = dedupe(runs)
    payload = json.dumps(runs, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.write_text(payload, encoding="utf-8")
    else:
        sys.stdout.write(payload)
    if args.report:
        args.report.write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"{len(runs)} runs extracted, {len(report)} report lines", file=sys.stderr)
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
