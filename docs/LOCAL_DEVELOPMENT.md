# Local development and login

## Start the Next.js application

Next.js is the single application runtime: it serves the UI and `/api/v1` server routes. There is no separate FastAPI server to start.

From the repository root, ensure `.env` contains a reachable `DATABASE_URL` and a strong `SECRET_KEY`. Apply the schema and create synthetic test records if needed:

```bash
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd backend
../.venv/bin/alembic upgrade head
../.venv/bin/python -m app.seed_demo
cd ../frontend
npm ci
npm run dev
```

Open `http://localhost:3000/login`.

## Demo accounts and seeded student profiles

The demo seed creates the same nine login accounts and five student records documented in the repository [README](../README.md#demo-accounts-and-seed-data-synthetic-local-development-only). Refer to that table for the exact names, faculty IDs/email usernames, phone numbers, linked children, admission numbers, and passwords.

- Staff choose **School Staff** and sign in with their faculty ID.
- Guardians choose **Guardian** and sign in with their email address.
- Students are seeded profile records, not login accounts; no student username/password is supported by the current role model.
- Re-running the seed on an existing `SJA-001` database is intended to restore the reserved demo credentials and ensure the five student profiles, guardian links, and staff assignments exist.

Use synthetic credentials only against a local/test database. Do not run the seed against production.

## Health check

```bash
curl http://localhost:3000/api/health
```

A healthy response reports `"status":"healthy"` and `"database":"connected"`.

## Password reset

In development, when SMTP is not configured, the reset URL is written to the Next.js server console. In deployed environments, configure SMTP environment variables so the reset email can be delivered.
