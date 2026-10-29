# APAARSetu

Intelligent Student Data Management, Enrolment Compliance and Academic Verification Platform. SIH26263 synthetic demonstration.

## Run on Windows

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\ironm\OneDrive\Desktop\APAARSetu\start-dev.ps1" -Demo -OpenBrave
```

Frontend: http://localhost:3001. API and OpenAPI: http://localhost:8001/docs. Stop with .\stop-dev.ps1 from the project root. The launcher applies additive Alembic migrations and seeds only with -Demo. Existing healthy services are detected. Occupied ports are reported without killing foreign processes. For a clean machine run .\scripts\setup.ps1 once; Python 3.12 and Node 22 are required. Docker is optional and not required.

## Demonstration accounts

Password for development-only accounts: Demo@26263. Accounts are rejected unless APAARSETU_DEMO_MODE=true (enabled by -Demo).

| Role | Email |
|---|---|
| Central administrator | central.admin@apaarsetu.demo |
| Southern regional officer | regional.officer@apaarsetu.demo |
| Institution administrator | institution.admin@apaarsetu.demo |
| Institution operator | institution.operator@apaarsetu.demo |
| Student | student@apaarsetu.demo |
| Verifier | verifier@apaarsetu.demo |
| Auditor | auditor@apaarsetu.demo |

## Application

Four portals share versioned FastAPI services. The central portal includes searchable registries, intake compliance, findings and reviews, reports, audit records, management and five interactive scenarios. Institutions manage scoped admissions, preview/map CSV or XLSX imports, review errors and corrections, transition enrolments and issue/revoke credentials. Students see their own records, request corrections, share selected credential fields and revoke consent. Verifiers open opaque disclosure references; no unrestricted APAAR lookup exists.

The frontend uses Next.js App Router, React, strict TypeScript, Tailwind, reusable UI components, TanStack Query/Table, React Hook Form, Zod and Recharts. Python 3.12 services use SQLAlchemy, Pydantic, Alembic, SQLite, pandas/openpyxl, scikit-learn and cryptography. Ed25519 signatures cover canonical credential JSON. QR codes contain only opaque links. PDF output uses ReportLab.

## Data and security

The deterministic base seed has 100 fictional institutions, 300 programmes, 900 programme/year approvals, 5,000 identities and 5,001 current-year enrolments. The extra current-year record is an intentional cross-institution overlap. Recovery adds 1,000 historical enrolments without duplicating identities. Browser exercises add labelled synthetic admissions. All identifiers and people are fictional. runtime/ contains the private database, issuer keys and generated application secret; it is ignored by Git. Preserve this directory to retain credentials across restart.

Official APAAR verification unavailable — demonstration mode. Format validation, institutional attestation, internal consistency and Ed25519 signature validity are separate evidence. This software issues no official APAAR IDs and claims no government partnership or security certification.

## Verification commands

```powershell
.\.venv\Scripts\python.exe -m pytest backend -q
.\.venv\Scripts\python.exe -m ruff check backend scripts
.\.venv\Scripts\python.exe scripts\evaluate.py
cd frontend
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

Browser tests use the installed Brave executable and live services. See docs/TEST_RESULTS.md for actual run evidence, docs/COMPLETE_DEMO_GUIDE.md for navigation and docs/SECURITY_AND_PRIVACY.md for deployment boundaries. docs/evaluation.json contains measured synthetic hold-out results.

## Troubleshooting

If a service exits, inspect runtime/backend.err.log and frontend.err.log. Run stop-dev.ps1 before restarting a partial launch. Do not copy node_modules or a virtual environment between projects; reinstall from the lockfile/requirements instead. The recovered primary directory owns its own environments and has no runtime dependence on staging. Build output remains local to frontend/.next; simultaneous build and dev execution should be avoided. Clear no database to solve a frontend cache error.

## Government-style interface — 29 October 2026

The current interface includes the public gateway, seven-role sign-in, all four portals, scoped case files, guided imports, compliance review, reporting and Demo Centre. Read docs/UI_DESIGN_SYSTEM.md, docs/UI_PAGE_MAP.md, docs/UI_ACCESSIBILITY_RESULTS.md and docs/UI_REDESIGN_TEST_RESULTS.md for the latest implementation and acceptance evidence. Public, login, guidance and verification screens support English/Hindi; protected workspaces remain English.

