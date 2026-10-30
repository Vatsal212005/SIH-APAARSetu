# Hosted demonstration — 30 October 2026

Public presentation URL: **https://sih-apaarsetu.vercel.app/**

The Next.js frontend and FastAPI Python backend run together as Vercel Services in Singapore, with a persistent Neon Lakebase Postgres database. Both providers remain on the selected free/Hobby plans. No paid upgrade or custom domain purchase was performed. Provider quotas and cold starts still apply.

## Verified deployment

- Vercel project: `sih-apaarsetu`.
- Verified application commit: `b8743b6bde84fac1c3c762b82ad796121f476733`.
- Deployment: `dpl_dKFs4DMbhRNRrbKRP6ufPWPD9GWZ`, `READY`, production, region `sin1`.
- Public domain opens without Vercel authentication, cookies or private share parameters. Existing Vercel deployment protection was retained.
- Application role authentication, Secure/HttpOnly cookies, CSRF validation and server-side scope checks remain active.

## Executed checks

| Layer | Result |
|---|---|
| Backend regression with hosting changes | 105 passed, one upstream deprecation warning |
| Follow-up report/policy regressions | 30 passed after batching annual reconciliation |
| Frontend unit tests | 12 passed |
| Frontend production build and strict TypeScript | Passed |
| ESLint and Ruff | Passed |
| API workflows against the real Neon database | 45 successful assertions, including intended 403 responses |
| Anonymous public Brave browser workflow | 16 checks passed, zero page errors |

The PostgreSQL checks cover all seven demonstration accounts, role-specific dashboards, overview, registers, intake, findings, reports, notifications, policies, two real demo scenarios, credential signatures, selected-field disclosure, consent revocation and student/verifier access denials.

The public browser checks cover the gateway, live backend health, central sign-in and metrics, institution/student/intake/finding/report tables, annual PDF export, student sign-in, signed credential sharing and subsequent denial after revocation, denied student register enumeration, institution operator sign-in, and actual CSV preview/validation/CSRF-protected commit with a persisted receipt. [Machine-readable browser results](hosted-verification.json) list the checks.

## Data and operational behavior

The fresh synthetic seed contains 100 institutions, 300 programmes, 5,000 identities and 6,001 enrolments: 5,001 current-year records plus 1,000 historical records. The browser check adds explicitly named fictional import rows and ordinary review/consent/audit events, so current totals can increase. No existing private Windows database was uploaded.

Application and Ed25519 signing secrets are stable encrypted Vercel environment variables. Migrations and seeding run explicitly, not on every serverless startup. PostgreSQL connections use the pooled application URI and a direct URI for initialization. Local Windows/SQLite operation keeps its existing default behavior.

Hosted student uploads are limited to 3 MiB to leave room for multipart overhead. Local uploads retain the 10 MiB default. The annual reconciliation query was consolidated: the same remote-database local check fell from about 114 seconds to 1.3 seconds. These timings measure that observed run, not a production performance guarantee.

## Repairs during hosting

The first cloud browser check found that `/` did not match the frontend catch-all while `/login` and API routes worked. The final deployment uses the documented `/(.*)` catch-all and the public gateway passed. The first Windows build hit a sandbox `EPERM`; the isolated build succeeded with approved permissions. No database reset or loss of signing material was used to resolve either issue.

Official APAAR/DigiLocker/AICTE integration, real-world anomaly accuracy, national-scale load and independent security/accessibility certification remain unverified. All accounts and records in the public app are synthetic. Do not enter real student information into this demonstration.
