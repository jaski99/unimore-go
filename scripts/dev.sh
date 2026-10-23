#!/usr/bin/env bash
# Start the API (FastAPI/uvicorn) and the web app (Next.js) together.
# Ctrl+C stops both. Ports and URLs can be overridden via env vars:
#   API_PORT (8000), WEB_PORT (3000), CORS_ORIGINS, NEXT_PUBLIC_API_URL, PYTHON
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:${WEB_PORT}}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:${API_PORT}}"

if [[ -z "${PYTHON:-}" ]]; then
  if [[ -x "$ROOT/.venv/bin/python" ]]; then PYTHON="$ROOT/.venv/bin/python"; else PYTHON=python3; fi
fi

if [[ ! -d "$ROOT/web/node_modules" ]]; then
  echo "web/node_modules missing: run 'make install' first." >&2
  exit 1
fi

cleanup() {
  trap - EXIT INT TERM
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "API  -> http://localhost:${API_PORT}  (CORS_ORIGINS=${CORS_ORIGINS})"
echo "Web  -> http://localhost:${WEB_PORT}  (NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL})"

(cd "$ROOT" && exec "$PYTHON" -m uvicorn api.main:app --host 0.0.0.0 --port "$API_PORT" --reload) &
(cd "$ROOT/web" && exec npx next dev --hostname 0.0.0.0 --port "$WEB_PORT") &

# Exit (and stop the other process) as soon as either one terminates.
wait -n
