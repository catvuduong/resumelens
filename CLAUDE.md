# resumelens

Monorepo (npm workspaces): `apps/web` (Next.js), `apps/api` (NestJS + Postgres via `pg`), `e2e/` (Playwright).

## Rules for automated tasks
- Work only inside this repo, on the branch you are given. Never push, never touch `main`, never edit `.github/workflows` or deploy config unless the task says so.
- Never read, print or create secrets. Do not add `.env` files with real values.
- Keep changes small and focused on the task. Add or update tests for every behaviour change (unit tests in `apps/api/src/*.spec.ts`, e2e in `e2e/`).
- Before finishing run `npm run verify` (lint, unit tests, build, e2e) and fix failures. Do not disable or delete tests to make them pass.
- Web calls the API through `NEXT_PUBLIC_API_URL`. The API reads `DATABASE_URL` (optional locally: health reports `db: disabled`).

- Tests that persist data need Postgres: `npm run verify` runs with `DATABASE_URL` already pointing at a throwaway local postgres (docker compose service `db`, port 55432). Create tables in code (`CREATE TABLE IF NOT EXISTS`), never rely on manual setup.

## Commands
- `npm install` — install all workspaces
- `npm run verify` — full local check, same as CI
- `docker compose up -d db` then `DATABASE_URL=postgres://postgres:postgres@localhost:55432/app` for a local DB

## UI quality (required, checked by `e2e/ui-quality.spec.ts`)
- Write a complete stylesheet (`src/index.css` or CSS modules) for EVERY page and component you create: layout, typography, spacing, colors as CSS variables, buttons, forms, tables, cards, badges, empty/loading/error states, hover/focus states. Never leave a `className` without CSS behind it, never ship browser-default styling.
- Look like a polished product: consistent spacing scale, one accent color, readable type, rounded cards with subtle borders/shadows, a proper app shell (sidebar or top bar), responsive down to 390px wide, light and dark mode.
- Every main page must show realistic seeded data and work end to end (login, create, list, detail, update, delete where relevant).
- Before finishing, build and look at the result: take a Playwright screenshot of the main pages and fix anything that looks unfinished.
