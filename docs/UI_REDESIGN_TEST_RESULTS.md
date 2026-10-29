# Government-style frontend redesign — acceptance results

Verified in the primary application at C:\Users\ironm\OneDrive\Desktop\APAARSetu on 29 October 2026.

| Check | Executed result |
|---|---|
| Baseline backend | 77 passed |
| Baseline frontend | 6 passed; original production build passed |
| Final backend regression | **101 passed**, no failures/skips; 61.52 seconds |
| Final frontend unit suite | **12 passed** across three files |
| Final live Brave E2E suite | **16 passed**, no failures/skips; approximately two minutes |
| Automated accessibility | **33 named page/state scans, zero violations** with WCAG A/AA tags |
| TypeScript strict typecheck | Passed |
| ESLint / Ruff | Passed |
| Next.js production build | Passed; generation stage completed 24/24, including dynamic record/verification routes |
| npm audit at dependency installation | Zero known vulnerabilities |

The backend suite includes the existing signing, tampering, consent/revocation, authorization, intake, import, correction, reporting and migration regressions. New tests verify filtered dashboard counts, role/institution isolation in workspace projections, pagination, masked case files, actual reviewer assignment/audit and the real paginated intake cohort.

The browser suite runs actual local frontend and backend services in installed Brave. It covers all seven role choices, all four portals, academic-year filtering, institutional case sections, student records, actual mixed-file preview/commit, compliance evidence and assignment, all five Demo Centre services, correction review, credential issuance, selective disclosure, actual signature checks, consent revocation, reports, bilingual public controls, keyboard navigation and responsive layouts. Auditor and regional controls reflect existing backend authority. The revocation dialog was tested without revoking an additional credential merely for layout inspection.

Screenshots: docs/screenshots/ui-redesign. The named 1440/1280/768/375 files and role/module screenshots are real application renders. ui-accessibility.json and ui-final-backend.xml provide machine-readable evidence; the local Playwright report is in frontend/playwright-report.

Issues repaired during development included UTF-8 corruption from a Windows editing operation, stale Next cache after that error, a dashboard year selector omitting existing approval years, UTC timestamp interpretation, accessible-name mismatches, language-control labelling, a missing favicon, a responsive chart legend, and premature browser navigation assertions. One typecheck collided with development route-type generation; final checks run serially with a clean production build before typechecking. One upstream Starlette/AnyIO deprecation warning remains; it is not a failed backend test.

The existing database, issuer keys, application secret, authentication, CSRF, consent and domain workflows were preserved. The source checkpoint before redesign is under recovery-checkpoints/ui-redesign-20261029; private SQLite/key backups remain under runtime/backups. Browser exercises deliberately add labelled synthetic imports and review/audit events. Persistence is checked by recording counts after those exercises, stopping/starting only owned services and comparing the same counts; see persistence-check.json and live-acceptance.json.

Remaining boundaries: no official government identity integration or formal accessibility certification; protected workspaces remain English; table column sorting operates on the loaded page while server search/filtering and pagination cover the complete authorized register. National-scale load, independent penetration testing and production PostgreSQL remain outside this local UI acceptance. Earlier TEST_RESULTS.md/FINAL_HANDOFF.md describe the pre-redesign delivery; this file is the current frontend acceptance record.
