#!/usr/bin/env bash
# End-to-end smoke test against a running API (same base URL the web app uses).
# Usage: scripts/smoke.sh [API_URL]   (default: $NEXT_PUBLIC_API_URL or http://localhost:8000)
set -euo pipefail

API_URL="${1:-${NEXT_PUBLIC_API_URL:-http://localhost:8000}}"
API_URL="${API_URL%/}"
ORIGIN="${SMOKE_ORIGIN:-http://localhost:3000}"
PYTHON="${PYTHON:-python3}"

echo "== GET ${API_URL}/api/health"
curl -fsS "${API_URL}/api/health"
echo

echo "== POST ${API_URL}/api/plan  (Reggio Emilia FS -> DIEF, Mon 26/10/2026 08:30, bike, margin 10)"
response="$(curl -fsS -X POST "${API_URL}/api/plan" \
  -H 'Content-Type: application/json' -H "Origin: ${ORIGIN}" \
  -d '{"origin":{"station_id":"reggio_fs"},"campus_id":"dief","arrive_by":"2026-10-26T08:30:00+01:00","mode":"bike","margin_min":10}')"
echo "$response" | "$PYTHON" -m json.tool
leave_at="$(echo "$response" | "$PYTHON" -c 'import json,sys; print(json.load(sys.stdin)["itineraries"][0]["leave_at"])')"
echo "== Esci alle ${leave_at}"
