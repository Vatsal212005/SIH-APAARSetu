# Vercel and Neon deployment

The deployment configuration preserves the Next.js frontend and FastAPI backend. They run as two Vercel Services behind one origin, with Lakebase Postgres on Neon's free plan for persistence. Vercel Services is currently Beta. Native Windows/SQLite operation remains supported.

## Layout

- Root `vercel.json` declares the frontend and backend services.
- `/api/v1/*`, `/health`, `/docs` and `/openapi.json` route to FastAPI. Remaining paths route to Next.js.
- `backend/pyproject.toml` pins Python 3.12 and runtime-only dependencies, including psycopg. Test/development packages remain in `backend/requirements.txt` for local setup.
- The frontend uses `NEXT_PUBLIC_API_URL=/api/v1`. Same-origin requests preserve the application's secure HttpOnly session cookie and CSRF checks.
- The deployment and database region is Singapore (`sin1` / `aws-ap-southeast-1`).

## Environment

Configure these in the Vercel project's production environment before building. Do not commit their private values.

| Variable | Value/purpose |
|---|---|
| `APAARSETU_DATABASE_URL` | Neon pooled PostgreSQL URI, with TLS enabled |
| `APAARSETU_SECRET_KEY` | Stable high-entropy secret; changing it invalidates identifier encryption and session/disclosure hashes |
| `APAARSETU_SIGNING_PRIVATE_KEY_B64` | Base64-encoded Ed25519 PKCS8 PEM private key; retain across deployments |
| `APAARSETU_ENV` | `production` for Secure session cookies |
| `APAARSETU_DEMO_MODE` | `true` for this explicitly synthetic public demonstration |
| `APAARSETU_AUTO_INITIALIZE` | `false`; migrations and seeding run explicitly before deployment |
| `APAARSETU_FRONTEND_ORIGIN` | Exact public HTTPS application origin |
| `APAARSETU_MAX_UPLOAD_BYTES` | `3145728` (3 MiB), leaving room for multipart overhead within Vercel's request limit |
| `NEXT_PUBLIC_API_URL` | `/api/v1` |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | `3` |

The public frontend settings are not secrets. Database and signing values must remain server-only. Preview deployments should use a separate branch/database before independent feature testing; the initial demonstration uses one synthetic database for the verified deployment.

## Initialize a new hosted demonstration

Use a **direct**, non-pooled PostgreSQL URI for Alembic migrations. In an ignored private JSON file, supply the server-side environment keys above, replacing only the database URI with its direct counterpart. Run from the repository root after installing backend requirements:

```powershell
.\.venv\Scripts\python.exe scripts\initialize_cloud.py --env-file .\runtime\cloud-env.json
```

The command applies additive migrations and the idempotent synthetic seed. It prints counts, never secrets. It creates the same deterministic identities with 100 institutions, 300 programmes, 5,000 students, 5,001 current-year enrolments and 1,000 historical enrolments. Keep the application and signing secrets consistent with the runtime deployment. Existing unrelated local databases are not uploaded or changed.

For serverless operation, the application refuses a local SQLite URL or missing stable secrets. Temporary files, if required, live under the platform's temporary directory; credentials and academic data persist outside that filesystem. Startup does not migrate or reseed the hosted database.

## Deployment checks

1. Confirm the selected Vercel project, Git repository, commit and environment.
2. Configure environment variables and run migrations/seed against the intended new database.
3. Run backend tests, frontend unit tests, production build and TypeScript checks.
4. Deploy and inspect build/runtime logs.
5. Verify sign-in, authorized records, imports, reports, credential signatures and consent revocation against the deployed URL.
6. Confirm the final presentation URL opens without Vercel account authentication if public access is intended. Keep application role authentication enabled.

## Limits

This is a synthetic demonstration, with public development accounts. Do not add real student information to it. Provider verification, independent security certification, national-scale load, identity-bound recipient access and managed key rotation remain outside the verified scope. Free hosting/database usage quotas still apply, and cold starts can add latency. Local in-process rate limits are per instance. Uploaded student files are limited to 3 MiB on this deployment; the local default remains 10 MiB.
