# UnimoreGo — web

Next.js 16 + TypeScript + Tailwind + Leaflet frontend. Project overview, architecture,
data limits and licences: see the [root README](../README.md).

## Avvio / Run

```bash
npm ci
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev   # needs the API running (make api)
NEXT_PUBLIC_USE_MOCK=1 npm run dev                      # offline mock (recorded API fixtures)
```

| Variable               | Default                 | Meaning                                                                      |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:8000` | API base URL called by the browser; `/` = same origin                        |
| `NEXT_PUBLIC_USE_MOCK` | _(empty)_               | `1` = `MockPlanService` instead of `HttpPlanService`                         |
| `API_PROXY_TARGET`     | _(empty)_               | Next.js rewrites `/api/*` to this backend (use with `NEXT_PUBLIC_API_URL=/`) |

`NEXT_PUBLIC_*` values are inlined at build time.

## Scripts

```bash
npm run lint && npx tsc --noEmit   # ESLint + types
npx vitest run                     # unit tests
npm run build                      # production build
```

## Structure

- `src/lib/api/` — `PlanService` port, `HttpPlanService`, `MockPlanService`, `config`, contract `types`, proxy rewrites
- `src/lib/plan-request.ts` — form values → `POST /api/plan` body
- `src/lib/time-format.ts` — Europe/Rome formatting (`formatClock` shows the API's `HH:MM`)
- `src/hooks/use-plan.ts` — request state machine
- `src/components/` — UI (form, result, timeline, weekly schedule, map)
