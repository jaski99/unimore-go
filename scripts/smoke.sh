#!/usr/bin/env bash
# End-to-end smoke test against a running API (same base URL the web app uses).
# Usage: scripts/smoke.sh [API_URL]   (default: $NEXT_PUBLIC_API_URL or http://localhost:8000)
#
# Sends the current request body (station buffer, train categories, return
# trip) and checks the answers against data/trains.json (PDF 17/10-12/12/2026).
# Exits non-zero on the first mismatch.
set -euo pipefail

API_URL="${1:-${NEXT_PUBLIC_API_URL:-http://localhost:8000}}"
API_URL="${API_URL%/}"
ORIGIN="${SMOKE_ORIGIN:-http://localhost:3000}"
PYTHON="${PYTHON:-python3}"

post() {
  curl -fsS -X POST "${API_URL}/api/plan" \
    -H 'Content-Type: application/json' -H "Origin: ${ORIGIN}" -d "$1"
}

# check <label> <python expression on `d`> <json>
check() {
  local label="$1" expression="$2" json="$3"
  if echo "$json" | "$PYTHON" -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if ($expression) else 1)"; then
    echo "ok   ${label}"
  else
    echo "FAIL ${label}"
    echo "$json" | "$PYTHON" -m json.tool | head -60
    exit 1
  fi
}

echo "== GET ${API_URL}/api/health"
health="$(curl -fsS "${API_URL}/api/health")"
echo "$health"
check "health ok, timetable 17/10-12/12/2026" \
  'd["status"] == "ok" and d["data_valid_from"] == "2026-10-17" and d["data_valid_to"] == "2026-12-12"' "$health"

echo "== Andata: Reggio Emilia FS -> DIEF, lun 26/10/2026 08:30, bici, anticipo 10, solo regionali"
outbound="$(post '{"origin":{"station_id":"reggio_fs"},"campus_id":"dief","arrive_by":"2026-10-26T08:30:00+01:00","mode":"bike","margin_min":10,"station_buffer_min":5,"train_categories":["regional"]}')"
check "Esci alle 07:39 con RV 3907 delle 07:44" \
  'd["itineraries"][0]["leave_at"] == "07:39" and [l["train"]["number"] for l in d["itineraries"][0]["legs"] if l["train"]] == ["3907"]' "$outbound"
check "calcolo: in stazione a Modena entro le 07:58" 'd["calculation"]["time"] == "07:58"' "$outbound"
check "durata porta a porta 39 min, 0 cambi" \
  'd["itineraries"][0]["duration_min"] == 39 and d["itineraries"][0]["changes"] == 0' "$outbound"
check "primo avviso legacy = non in tempo reale" 'd["warnings"][0].startswith("Orari pianificati")' "$outbound"

echo "== Ritorno: DIEF -> Reggio Emilia FS, fine lezione 13:00, bici, solo regionali"
inbound="$(post '{"origin":{"station_id":"reggio_fs"},"campus_id":"dief","depart_after":"2026-10-26T13:00:00+01:00","mode":"bike","margin_min":10,"train_categories":["regional"]}')"
check "Parti alle 13:33 (treno delle 14:00)" \
  'd["planner"] == "depart_after" and d["itineraries"][0]["leave_at"] == "13:33"' "$inbound"

echo "== Domenica 25/10: Modena FS -> Palazzo Dossetti 09:00, a piedi (review B1)"
sunday="$(post '{"origin":{"station_id":"modena_fs"},"campus_id":"palazzo_dossetti","arrive_by":"2026-10-25T09:00:00+01:00","mode":"walk","margin_min":10}')"
check "treno trovato (RV 3902 08:00), calcolo entro le 08:31" \
  'd["itineraries"][0]["leave_at"] == "07:55" and d["calculation"]["time"] == "08:31"' "$sunday"

echo "== Domenica 20/12: fuori validità (review B4)"
outside="$(post '{"origin":{"station_id":"reggio_fs"},"campus_id":"dief","arrive_by":"2026-12-20T08:30:00+01:00","mode":"bike","margin_min":10}')"
check "un solo avviso principale + soluzione di sabato 12/12" \
  '[n["code"] for n in d["notices"]] == ["out_of_validity", "not_realtime"] and d["nearby"][0]["itinerary"]["date"] == "2026-12-12"' "$outside"

echo "== Smoke test superato"
