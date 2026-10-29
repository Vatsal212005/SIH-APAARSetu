# Executed verification - 29 October 2026

Final commands ran from the independent primary project, C:\Users\ironm\OneDrive\Desktop\APAARSetu.

| Check | Actual result |
|---|---|
| Backend pytest suite | 77 passed, 0 failed, 0 skipped; 49.32 seconds |
| Backend lint | Ruff passed |
| Frontend unit tests | 6 passed across 2 files |
| Strict TypeScript | Passed |
| ESLint | Passed with no reported errors/warnings in the final primary run |
| Production frontend build | Passed, 20 generated/dynamic routes |
| Brave Playwright journeys | 7 passed; latest full run 28.7 seconds |
| Dependency audit | 0 known npm vulnerabilities at install time |
| Alembic migrations | Upgrade/idempotency and preserved-record tests passed |
| Digital signatures | Actual Ed25519, tampering, expiration/revocation and scoped disclosure tests passed |
| Native launcher | Primary startup succeeded; repeated launch detected healthy owned services |
| HTTP checks | Backend healthy with primary project_root; frontend HTTP 200 |
| Six-slide draft | PPTX structural/layout/import finalization passed; six PDF pages rendered and visually inspected |

The backend emits one upstream Starlette/AnyIO deprecation warning. It is not a failed test. Earlier failures were retained and repaired: missing copied dependencies, a test JSX configuration problem, a cold-login hydration race, a missing selected-ID submission, demo JSON datetime persistence and repeat-run test data conflicts. Tests were not deleted to hide failures.

Backend coverage includes roles and institution scope, session expiry/CSRF, individual enrolment, identifier checks, duplicates, transfers/year separation, explicit concurrency policy, separate category counting, CSV/XLSX partial imports and idempotency, mapped previews, lifecycle versions, corrections, all 18 report variants, institution CSV, account status changes, own-profile masking, maintenance audit, signatures, consent, revocation, all five scenario services and additive migrations.

The seven browser journeys exercise central dashboard/intake/findings, student sharing/revocation, institution mixed CSV preview/commit, all five Demo Center scenarios with persistence, correction review, restricted verifier access, credential issuance and CSV/PDF exports. No API success interception was used. Screenshots under docs/screenshots are actual Brave renders. Native desktop computer-use URL inspection was unavailable; no claim of a successful desktop automation inspection is made.

Synthetic evaluation: Isolation Forest precision 0.80, recall 1.00, F1 0.888889, TP 40/TN 190/FP 10/FN 0. Format checks cover five cases and conflict classification four scenarios; those small sets each returned F1 1.0. A 200-row real import-service evaluation accepted 200 rows in 255.484 ms in the final primary run. Fit/predict time was 106.288 ms. These are single-run local timings, not service-level guarantees or real-world accuracy.

See evaluation.json, live-acceptance.json and persistence-check.json for machine-readable evidence. Production PostgreSQL, national-scale load, external identity integrations, authenticated recipient audiences and independent penetration testing are outside the verified local demonstration boundary.
