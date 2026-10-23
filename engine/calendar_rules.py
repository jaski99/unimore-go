"""Interpretation of the calendar notes printed in the Trenitalia timetable PDF.

Each TrainRun carries the raw ``calendar_note`` transcribed from the official
PDF (``Regionale_Emilia.pdf``) and a ``source`` URL with the page anchor.
This module turns the notes into composable :class:`CalendarRule` objects.

Design rules (no invented values):

* A note is interpreted only when every calendar clause matches the grammar
  *completely*. Truncated clauses ("Sospeso il 21/11,"), hyphenated line
  breaks we cannot rebuild, or several alternative notes joined by ``|``
  (the transcription could not tell which one applies to the run) make the
  whole note *uninterpretable*.
* Uninterpretable notes never silently change the result: the run keeps its
  structured ``days``/``valid_from``/``valid_to`` data and the planner attaches
  a warning that quotes the note and cites the PDF page.
* Purely informative segments (operator, transcription checks, group-ticket
  rules) are recognised and ignored.

New clause types are added by appending a :class:`ClauseParser` to the
registry passed to :class:`CalendarNoteParser` (Open/Closed).
"""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import date

from engine.holidays import is_festive

WEEKDAY_NAMES: dict[str, int] = {
    "lunedì": 0,
    "martedì": 1,
    "mercoledì": 2,
    "giovedì": 3,
    "venerdì": 4,
    "sabato": 5,
    "domenica": 6,
}
WEEKDAY_LABELS = ("lun", "mar", "mer", "gio", "ven", "sab", "dom")


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------


class CalendarRule(ABC):
    """A predicate telling whether a run operates on a given day."""

    @abstractmethod
    def applies(self, day: date) -> bool:
        """True when the run operates on ``day`` according to this rule."""

    @abstractmethod
    def describe(self) -> str:
        """Short Italian description, used in explanations and tests."""


def _fmt(day: date) -> str:
    return f"{day.day}/{day.month}"


def _fmt_days(days: frozenset[int]) -> str:
    return ", ".join(WEEKDAY_LABELS[d] for d in sorted(days))


@dataclass(frozen=True)
class OnlyWeekdays(CalendarRule):
    days: frozenset[int]

    def applies(self, day: date) -> bool:
        return day.weekday() in self.days

    def describe(self) -> str:
        return f"solo {_fmt_days(self.days)}"


@dataclass(frozen=True)
class ExceptWeekdays(CalendarRule):
    days: frozenset[int]
    start: date | None = None
    end: date | None = None

    def applies(self, day: date) -> bool:
        in_window = (self.start is None or day >= self.start) and (
            self.end is None or day <= self.end
        )
        return not (in_window and day.weekday() in self.days)

    def describe(self) -> str:
        window = ""
        if self.start or self.end:
            window = f" ({_fmt(self.start) if self.start else '…'}–{_fmt(self.end) if self.end else '…'})"
        return f"sospeso {_fmt_days(self.days)}{window}"


@dataclass(frozen=True)
class DateWindow(CalendarRule):
    """Runs only between ``start`` and ``end`` (inclusive, open bounds allowed)."""

    start: date | None = None
    end: date | None = None

    def applies(self, day: date) -> bool:
        return (self.start is None or day >= self.start) and (self.end is None or day <= self.end)

    def describe(self) -> str:
        if self.start and self.end:
            return f"dal {_fmt(self.start)} al {_fmt(self.end)}"
        if self.start:
            return f"dal {_fmt(self.start)}"
        return f"fino al {_fmt(self.end)}" if self.end else "sempre"


@dataclass(frozen=True)
class ExceptWindow(CalendarRule):
    """Suspended between ``start`` and ``end`` (inclusive)."""

    start: date | None = None
    end: date | None = None

    def applies(self, day: date) -> bool:
        return not DateWindow(self.start, self.end).applies(day)

    def describe(self) -> str:
        return f"sospeso {DateWindow(self.start, self.end).describe()}"


@dataclass(frozen=True)
class OnlyDates(CalendarRule):
    dates: frozenset[date]

    def applies(self, day: date) -> bool:
        return day in self.dates

    def describe(self) -> str:
        return "solo il " + ", ".join(_fmt(d) for d in sorted(self.dates))


@dataclass(frozen=True)
class ExceptDates(CalendarRule):
    dates: frozenset[date]

    def applies(self, day: date) -> bool:
        return day not in self.dates

    def describe(self) -> str:
        return "sospeso il " + ", ".join(_fmt(d) for d in sorted(self.dates))


@dataclass(frozen=True)
class WorkingDays(CalendarRule):
    """Trenitalia 'feriali'/'lavorativi': Monday–Saturday except holidays."""

    include_saturday: bool = True

    def applies(self, day: date) -> bool:
        if is_festive(day):
            return False
        return self.include_saturday or day.weekday() != 5

    def describe(self) -> str:
        return "feriali" if self.include_saturday else "feriali escluso il sabato"


@dataclass(frozen=True)
class FestiveDays(CalendarRule):
    """'Festivi': Sundays and national holidays (or their complement)."""

    only: bool = True

    def applies(self, day: date) -> bool:
        return is_festive(day) if self.only else not is_festive(day)

    def describe(self) -> str:
        return "solo festivi" if self.only else "sospeso nei festivi"


@dataclass(frozen=True)
class AnyOf(CalendarRule):
    """True when at least one of ``rules`` applies (union of day sets)."""

    rules: tuple[CalendarRule, ...]

    def applies(self, day: date) -> bool:
        return any(rule.applies(day) for rule in self.rules)

    def describe(self) -> str:
        return " oppure ".join(rule.describe() for rule in self.rules)


@dataclass(frozen=True)
class AllOf(CalendarRule):
    """True when every rule applies (intersection of day sets)."""

    rules: tuple[CalendarRule, ...]

    def applies(self, day: date) -> bool:
        return all(rule.applies(day) for rule in self.rules)

    def describe(self) -> str:
        return " e ".join(f"({rule.describe()})" for rule in self.rules)


@dataclass(frozen=True)
class Not(CalendarRule):
    """Complement of ``rule`` (used for "Sospeso ...")."""

    rule: CalendarRule

    def applies(self, day: date) -> bool:
        return not self.rule.applies(day)

    def describe(self) -> str:
        return f"sospeso: {self.rule.describe()}"


# ---------------------------------------------------------------------------
# Interpretation result
# ---------------------------------------------------------------------------

UNRESTRICTED = "unrestricted"
INTERPRETED = "interpreted"
UNINTERPRETABLE = "uninterpretable"


@dataclass(frozen=True)
class CalendarInterpretation:
    """Outcome of parsing one calendar note."""

    status: str
    rules: tuple[CalendarRule, ...] = ()
    unparsed: tuple[str, ...] = ()
    reason: str = ""

    @property
    def interpretable(self) -> bool:
        return self.status != UNINTERPRETABLE

    def runs_on(self, day: date) -> bool:
        """Apply every rule (logical AND). Uninterpretable notes do not filter."""
        if not self.interpretable:
            return True
        return all(rule.applies(day) for rule in self.rules)

    def describe(self) -> str:
        if self.status == UNRESTRICTED:
            return "nessuna limitazione"
        if self.status == INTERPRETED:
            return "; ".join(rule.describe() for rule in self.rules) or "nessuna limitazione"
        return "non interpretata"


# ---------------------------------------------------------------------------
# Grammar
# ---------------------------------------------------------------------------

_DATE = r"\d{1,2}/\d{1,2}"
_WEEKDAY = r"(?:lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)"
# Lists must be complete: "il A", "il A e il B", "il A, il B e il C".
_DATE_LIST = rf"il {_DATE}(?:(?:, il {_DATE})* e il {_DATE})?"
_WEEKDAY_LIST = rf"il {_WEEKDAY}(?:(?:, il {_WEEKDAY})* e il {_WEEKDAY})?"
_WEEKDAY_RANGE = rf"dal {_WEEKDAY} al(?:la)? {_WEEKDAY}"
_PERIOD = rf"(?:dal {_DATE} al {_DATE}|fino al {_DATE}|dal {_DATE})"

DateResolver = Callable[[str], date]


@dataclass(frozen=True)
class ClauseParser:
    """Full-match regex plus a factory producing rules from the match."""

    name: str
    pattern: re.Pattern[str]
    build: Callable[[re.Match[str], DateResolver], tuple[CalendarRule, ...]]

    def parse(self, clause: str, resolve: DateResolver) -> tuple[CalendarRule, ...] | None:
        match = self.pattern.fullmatch(clause)
        if not match:
            return None
        return self.build(match, resolve)


def _weekdays_in(text: str) -> frozenset[int]:
    found = [WEEKDAY_NAMES[w] for w in re.findall(_WEEKDAY, text)]
    if text.startswith("dal ") and len(found) == 2:
        start, end = found
        span = range(start, end + 1) if start <= end else [*range(start, 7), *range(0, end + 1)]
        return frozenset(span)
    return frozenset(found)


def _dates_in(text: str, resolve: DateResolver) -> frozenset[date]:
    return frozenset(resolve(token) for token in re.findall(_DATE, text))


def _period(text: str | None, resolve: DateResolver) -> tuple[date | None, date | None]:
    if not text:
        return None, None
    tokens = re.findall(_DATE, text)
    if text.startswith("fino al"):
        return None, resolve(tokens[0])
    if len(tokens) == 2:
        return resolve(tokens[0]), resolve(tokens[1])
    return resolve(tokens[0]), None


def _compile(body: str) -> re.Pattern[str]:
    return re.compile(body, re.IGNORECASE)


DEFAULT_CLAUSE_PARSERS: tuple[ClauseParser, ...] = (
    ClauseParser(
        "working_days",
        _compile(
            r"(?:si effettua )?(?:solo )?(?:nei )?(?:giorni )?(?:feriali|lavorativi)"
            r"(?P<nosat>,? (?:escluso il sabato|sabato escluso|esclusi i sabati))?"
        ),
        lambda m, _r: (WorkingDays(include_saturday=not m.group("nosat")),),
    ),
    ClauseParser(
        "festive_only",
        _compile(r"si effettua (?:solo )?(?:nei )?(?:giorni )?festivi"),
        lambda _m, _r: (FestiveDays(only=True),),
    ),
    ClauseParser(
        "except_festive",
        _compile(r"(?:sospeso|non si effettua) (?:nei )?(?:giorni )?festivi"),
        lambda _m, _r: (FestiveDays(only=False),),
    ),
    ClauseParser(
        "only_weekdays",
        _compile(
            rf"si effettua (?P<days>{_WEEKDAY_LIST}|{_WEEKDAY_RANGE})(?: (?P<period>{_PERIOD}))?"
        ),
        lambda m, r: (
            OnlyWeekdays(_weekdays_in(m.group("days"))),
            *((DateWindow(*_period(m.group("period"), r)),) if m.group("period") else ()),
        ),
    ),
    ClauseParser(
        "except_weekdays",
        _compile(rf"sospeso (?P<days>{_WEEKDAY_LIST}|{_WEEKDAY_RANGE})(?: (?P<period>{_PERIOD}))?"),
        lambda m, r: (
            ExceptWeekdays(_weekdays_in(m.group("days")), *_period(m.group("period"), r)),
        ),
    ),
    ClauseParser(
        "only_period",
        _compile(rf"si effettua (?P<period>{_PERIOD})"),
        lambda m, r: (DateWindow(*_period(m.group("period"), r)),),
    ),
    ClauseParser(
        "except_period",
        _compile(rf"sospeso (?P<period>{_PERIOD})"),
        lambda m, r: (ExceptWindow(*_period(m.group("period"), r)),),
    ),
    ClauseParser(
        "only_dates",
        _compile(rf"si effettua (?P<dates>{_DATE_LIST})"),
        lambda m, r: (OnlyDates(_dates_in(m.group("dates"), r)),),
    ),
    ClauseParser(
        "except_dates",
        _compile(rf"sospeso (?P<dates>{_DATE_LIST})"),
        lambda m, r: (ExceptDates(_dates_in(m.group("dates"), r)),),
    ),
)

_TERM_PREFIX = re.compile(
    r"(?P<polarity>si effettua|sospeso|non si effettua) (?P<body>.+)", re.IGNORECASE
)
_TERM_SEPARATOR = re.compile(r"\s*(?:,\s*|\s+e\s+|\s+nonché\s+|\s+)", re.IGNORECASE)
_TERM_ATOMS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("weekday_range", _compile(rf"dal (?P<a>{_WEEKDAY}) al(?:la)? (?P<b>{_WEEKDAY})")),
    ("period", _compile(rf"dal (?P<a>{_DATE}) al (?P<b>{_DATE})")),
    ("period_to", _compile(rf"fino al (?P<b>{_DATE})")),
    ("period_from", _compile(rf"dal (?P<a>{_DATE})")),
    ("weekday", _compile(rf"(?:il|la) (?P<a>{_WEEKDAY})")),
    ("date", _compile(rf"il (?P<a>{_DATE})")),
    ("festive", _compile(r"nei (?:giorni )?festivi")),
)


@dataclass
class _WeekdayGroup:
    days: set[int] = field(default_factory=set)
    festive: bool = False
    windows: list[DateWindow] = field(default_factory=list)

    def rule(self) -> CalendarRule:
        parts: list[CalendarRule] = []
        if self.days:
            parts.append(OnlyWeekdays(frozenset(self.days)))
        if self.festive:
            parts.append(FestiveDays(only=True))
        base = parts[0] if len(parts) == 1 else AnyOf(tuple(parts))
        if not self.windows:
            return base
        window = self.windows[0] if len(self.windows) == 1 else AnyOf(tuple(self.windows))
        return AllOf((base, window))


class TermListClauseParser:
    """General clause: ``Si effettua|Sospeso`` + a list of day terms.

    Terms are dates (``il 31/10``), periods (``dal 3/11 al 7/11``, ``fino al
    22/10``, ``dal 15/11``), weekdays (``il lunedì``, ``la domenica``, ``dal
    martedì alla domenica``) and ``nei festivi``, separated by ``,``, ``e``
    or ``nonché``. Periods written right after a weekday group restrict that
    group ("il sabato e la domenica dal 15/11 al 29/11"); ``nonché`` closes the
    group, so what follows stands alone ("il mercoledì dal 25/11 nonché il
    24/11"). The run operates on the union of the terms (``Si effettua``) or
    outside it (``Sospeso``). Any token outside this grammar rejects the clause.

    Seen in Regionale_Emilia.pdf (17/10–12/12/2026), e.g. note 116 on page 22
    and note 53 on page 78.
    """

    name = "term_list"

    def parse(self, clause: str, resolve: DateResolver) -> tuple[CalendarRule, ...] | None:
        match = _TERM_PREFIX.fullmatch(clause.strip())
        if not match:
            return None
        atoms = self._tokenize(match.group("body"))
        if atoms is None:
            return None
        terms = self._group(atoms, resolve)
        if not terms:
            return None
        union = terms[0] if len(terms) == 1 else AnyOf(tuple(terms))
        include = match.group("polarity").lower() == "si effettua"
        return (union,) if include else (Not(union),)

    @staticmethod
    def _tokenize(body: str) -> list[tuple[str, bool, re.Match[str]]] | None:
        """Atoms with an "after nonché" flag; None when the clause is not a full list.

        A comma-separated list must close with ``e``/``nonché`` before its last
        item ("il lunedì, il venerdì e il sabato"): a list ending on a comma item
        is a truncated transcription and is rejected.
        """
        atoms: list[tuple[str, bool, re.Match[str]]] = []
        separators: list[str] = []
        pos = 0
        while pos < len(body):
            separator = _TERM_SEPARATOR.match(body, pos) if atoms else None
            after_nonche = False
            if separator and separator.end() > pos:
                word = separator.group(0).strip().lower()
                after_nonche = word == "nonché"
                if word:
                    separators.append(word)
                pos = separator.end()
            for kind, pattern in _TERM_ATOMS:
                atom = pattern.match(body, pos)
                if atom and (atom.end() == len(body) or not body[atom.end()].isalnum()):
                    atoms.append((kind, after_nonche, atom))
                    pos = atom.end()
                    break
            else:
                return None
        if "," in separators and separators[-1] == ",":
            return None
        return atoms

    @staticmethod
    def _group(
        atoms: list[tuple[str, bool, re.Match[str]]], resolve: DateResolver
    ) -> list[CalendarRule]:
        terms: list[CalendarRule] = []
        group: _WeekdayGroup | None = None

        def close() -> None:
            nonlocal group
            if group is not None:
                terms.append(group.rule())
                group = None

        for kind, after_nonche, atom in atoms:
            if after_nonche:
                close()
            if kind in ("weekday", "weekday_range", "festive"):
                if group is None or group.windows:
                    close()
                    group = _WeekdayGroup()
                if kind == "festive":
                    group.festive = True
                else:
                    group.days |= _weekdays_in(atom.group(0))
            elif kind.startswith("period"):
                start = resolve(atom.group("a")) if "a" in atom.groupdict() else None
                end = resolve(atom.group("b")) if "b" in atom.groupdict() else None
                if group is not None:
                    group.windows.append(DateWindow(start, end))
                else:
                    terms.append(DateWindow(start, end))
            else:  # date
                close()
                terms.append(OnlyDates(frozenset({resolve(atom.group("a"))})))
        close()
        return terms


# Informative segments that carry no calendar meaning.
IGNORED_SEGMENTS: tuple[re.Pattern[str], ...] = (
    _compile(r"servizio di trenitalia.*"),
    _compile(r"verificato attivo.*"),
    _compile(r"corsa sul limite.*"),
    _compile(r"non sono ammessi i gruppi.*"),
    _compile(r"sono ammessi esclusivamente i viaggiatori muniti di biglietto.*"),
)
UNRESTRICTED_SEGMENT = _compile(r"nessuna limitazione di calendario.*")

_NOTE_PREFIX = re.compile(r"^nota\s+\d+\s*:\s*", re.IGNORECASE)
_SENTENCE_SPLIT = re.compile(r"(?<=\.)\s+(?=[A-ZÀ-Ý])")
_CLAUSE_SPLIT = re.compile(r",\s*(?=(?:sospeso|si effettua|non si effettua)\b)", re.IGNORECASE)
_HYPHEN_BREAK = re.compile(r"(\w)- (\w)")


@dataclass
class CalendarNoteParser:
    """Parse raw calendar notes into :class:`CalendarInterpretation` objects.

    ``edition_start`` resolves the year of ``D/M`` dates: months before the
    edition's start month belong to the following year (editions such as
    December–June cross the new year).
    """

    edition_start: date
    clause_parsers: Sequence[ClauseParser | TermListClauseParser] = field(
        default=(*DEFAULT_CLAUSE_PARSERS, TermListClauseParser())
    )

    def resolve_date(self, token: str) -> date:
        day_str, month_str = token.split("/")
        month = int(month_str)
        year = self.edition_start.year + (1 if month < self.edition_start.month else 0)
        return date(year, month, int(day_str))

    def parse(self, note: str) -> CalendarInterpretation:
        text = _HYPHEN_BREAK.sub(r"\1\2", " ".join((note or "").split()))
        calendar_alternatives: list[list[str]] = []
        for part in text.split(";"):
            for alternative in part.split("|"):
                sentences = self._calendar_sentences(alternative)
                if sentences:
                    calendar_alternatives.append(sentences)

        if not calendar_alternatives:
            # Only informative segments or an explicit "no limitation" note.
            return CalendarInterpretation(status=UNRESTRICTED)
        if len(calendar_alternatives) > 1:
            flat = tuple(s for alt in calendar_alternatives for s in alt)
            return CalendarInterpretation(
                status=UNINTERPRETABLE,
                unparsed=flat,
                reason="la nota contiene più varianti alternative",
            )
        return self._parse_sentences(calendar_alternatives[0])

    def _calendar_sentences(self, alternative: str) -> list[str]:
        """Return the sentences of an alternative that carry calendar meaning."""
        result: list[str] = []
        for raw in _SENTENCE_SPLIT.split(alternative.strip()):
            sentence = _NOTE_PREFIX.sub("", raw.strip()).strip()
            if not sentence:
                continue
            if UNRESTRICTED_SEGMENT.fullmatch(sentence) or any(
                p.fullmatch(sentence) for p in IGNORED_SEGMENTS
            ):
                continue
            result.append(sentence)
        return result

    def _parse_sentences(self, sentences: list[str]) -> CalendarInterpretation:
        rules: list[CalendarRule] = []
        unparsed: list[str] = []
        for sentence in sentences:
            body = sentence.strip()
            if body.endswith("."):
                body = body[:-1].strip()
            for clause in _CLAUSE_SPLIT.split(body):
                parsed = self._parse_clause(clause.strip())
                if parsed is None:
                    unparsed.append(clause.strip())
                else:
                    rules.extend(parsed)
        if unparsed:
            return CalendarInterpretation(
                status=UNINTERPRETABLE,
                unparsed=tuple(unparsed),
                reason="testo della nota incompleto o non riconosciuto",
            )
        return CalendarInterpretation(status=INTERPRETED, rules=tuple(rules))

    def _parse_clause(self, clause: str) -> tuple[CalendarRule, ...] | None:
        for parser in self.clause_parsers:
            try:
                rules = parser.parse(clause, self.resolve_date)
            except ValueError:  # e.g. 31/11: not a real date
                return None
            if rules is not None:
                return rules
        return None
