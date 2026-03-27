# codexothon-finance-tracker-ui

Frontend web app for Personal Finance Tracker.

## Stack
- React + TypeScript + Vite
- TanStack Query
- Zustand
- React Hook Form + Zod
- Recharts

## Deploy with Podman
1. Create env file:
   - `Copy-Item .env.example .env -Force`
2. Build and run:
   - `podman compose up --build -d`
3. Verify:
   - `curl http://localhost:5173`
4. Stop:
   - `podman compose down`

## Deploy without Podman
1. Create `.env` from `.env.example`.
2. Run:
   - `npm install`
   - `npm run build`
   - `npm run dev`
3. UI runs on `http://localhost:5173`.

## Tests
- Component tests: `npm run test`
- Playwright e2e tests: `npm run test:e2e`
- Playwright smoke suite: `npm run test:smoke`

### Smoke Test Modes
- Local UI with local backend:
  - `npm run test:smoke`
- Deployed UI / backend:
  - `$env:PLAYWRIGHT_BASE_URL='https://lively-tree-0520a0f00.6.azurestaticapps.net/'`
  - `$env:PLAYWRIGHT_SKIP_WEBSERVER='true'`
  - `npm run test:smoke`
- Existing user instead of fresh signup:
  - `$env:PLAYWRIGHT_SMOKE_AUTH_MODE='login'`
  - `$env:PLAYWRIGHT_SMOKE_EMAIL='user@example.com'`
  - `$env:PLAYWRIGHT_SMOKE_PASSWORD='YourPassword@123'`
  - `npm run test:smoke`

The smoke suite covers:
- signup or login
- onboarding workbook import
- dashboard and major V2 pages
- transactions import modal
- settings delete-account modal
- backend 5xx detection during the browser flow

## Demo Credentials
- test@amiti.in / Test@123

## QA Note
- Login page includes a demo login shortcut for QA speed.

## Deployed URL
- UI: `https://lively-tree-0520a0f00.6.azurestaticapps.net/`
