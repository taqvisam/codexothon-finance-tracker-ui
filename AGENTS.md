# AGENTS.md

## Purpose
This repository contains the frontend UI for the Personal Finance Tracker.

## UX and QA Guidelines
- Keep critical user journeys stable:
  - Login
  - Dashboard view
  - Create transaction
  - Create budget
  - Create goal
  - Reports view
- Ensure authenticated routes redirect to `/login` when session is missing/expired.
- Keep header month selector behavior consistent across pages.

## Demo Mode
- Login page must support quick demo access with:
  - `demo@finance.com / Demo@123`
- Any UX change must preserve Playwright selectors and accessibility labels.

## Local Run
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run test:e2e`

