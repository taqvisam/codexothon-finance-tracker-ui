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

## Demo Credentials
- demo@finance.com / Demo@123
- test@amiti.in / Test@123

## QA Note
- Login page includes a demo login shortcut for QA speed.

