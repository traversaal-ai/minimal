# Nestpad — server

Express + SQLite API for Nestpad. Implements every route in `docs/api-contract.md`
exactly (that file is the source of truth).

## Run it

No `.env` and no external account needed — data and auth are local.

```bash
cd server
npm install
npm run seed     # creates the demo workspace, users, and pages (idempotent)
npm start         # starts the API on http://localhost:3001
```

The seed script prints demo login credentials to stdout — use those to log in
from the frontend (or via `POST /auth/login`) instead of creating a new account.

## Notes

- Data lives in a single SQLite file at `server/data.db` (created automatically,
  git-ignored). Delete it to reset all data, then re-run `npm run seed`.
- `JWT_SECRET` defaults to `"nestpad-dev-secret"` if not set in the environment —
  fine for local use, never for a real deployment.
- CORS is open to `http://localhost:5173` (the Vite frontend).
- Re-running `npm run seed` is safe — it skips creating duplicate demo data if
  the demo users already exist.
