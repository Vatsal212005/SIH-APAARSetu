# Redesigned pages and integration map

Base backend namespace: /api/v1. Existing service endpoints are retained. New /workspace endpoints are additive and protected by server-side role/institution checks.

| Route | Redesigned experience | Live data/actions |
|---|---|---|
| / | Public service gateway, four portal entrances, process and prototype notices | Real /login?role= entry paths; no national statistics |
| /login | Seven-role selector, credential validation, password visibility, bilingual labels | /auth/login; selection never changes server permissions |
| /about, /help, /privacy, /accessibility | Bilingual prototype and service guidance | Working navigation and local language/text-size preferences |
| /dashboard — central/regional/auditor | MIS filters, six metrics, charts, work queue and activity | /dashboard; /workspace/overview with year/state/region/type/programme filters |
| /dashboard — institution | Identity, intake/utilization, records, corrections and task actions | Same APIs with institution scope enforced on the server |
| /dashboard — student | Original demonstration identity card and own academic records | /profile; /dashboard |
| /dashboard — verifier | Formal disclosure-reference entry | Opaque reference opens /verify/[token] |
| /institutions | Search, state/region/type/approval/year filters, counts and paging | /workspace/institutions; /workspace/overview options |
| /institutions/[id] | Seven-section administrative case file | /institutions/[id]; scoped /workspace/institutions/[id]/activity for enrolments, submissions, compliance, verification and audit |
| /students | Paginated student register with masked identifier, latest scoped enrolment and correction state | /workspace/students; /academic-years |
| /students/[id] | Identity, enrolments, credentials, correction information and version history | /workspace/students/[id] |
| /enrolments | Paginated/searchable register, lifecycle form and chronological changes | Staff: /workspace/enrolments; student: own /enrolments; PATCH /enrolments/[id]; /enrolments/[id]/history |
| /manage | Shared government-form workspace: institution, programme, student, policy, intake, year and access management | Existing institution/programme/student/intake/policy/year/user mutation endpoints; server-authoritative roles; supported task deep links |
| /intakes | Academic-year intake register, search, policy and separate seat/category treatment | /intakes; /academic-years |
| /imports | Seven-phase submission rail, real file picker/drop, context, mapping, preview, validation, review acknowledgment and receipt | /programmes; /academic-years; POST /imports preview/commit; /imports history; /imports/[id]/errors.csv; actual cohort context from /workspace/overview |
| /anomalies | Findings table, technical evidence, scoped side-by-side cross-institution comparison, justification, confirmation and timeline | /findings; /workspace/findings/[id]; POST /findings/[id]/review; POST /workspace/findings/[id]/assign; /anomaly/run |
| /corrections | Student request and authorized review forms | /corrections; /corrections/[id]/review; own/scoped /enrolments |
| /credentials | Document-style wallet, eligible issuance, signed payload, certificates, consent preferences, QR, sharing/revocation and access history | Existing credentials, consents, verification-events, privacy-config, certificate and QR services |
| /verify/[token] | Bilingual integrity/consent result, permitted fields, issuer and explicit official-identity boundary | Public scoped /verification/[token]; actual Ed25519 validation, expiry and revocation checks |
| /reports | Category-based 18-report catalogue, supported filters, applied context, timestamp and exports; full-year intake reconciliation retained | /reports/catalog; /reports/analysis; /reports/summary; existing CSV/PDF exports |
| /notifications | Actual messages grouped by content into action/validation/compliance/verification/system categories | /notifications; POST /notifications/[id]/read; stored deep links |
| /audit | Server-filtered, paginated event log with actors, role, record and expandable metadata | /workspace/audit; no mutation actions |
| /settings | Provider availability, immutable policy versions and authorized maintenance | /integrations; /policies; /jobs/maintenance; auditor receives read-only controls |
| /demo | Five guided scenarios, stored outcomes, technical evidence, service actions and presentation mode | Existing /demo/scenarios and /demo/scenarios/[id]/run actions; real import/validation/model/signature services |

Central administrator, regional officer, institution administrator/operator, student, verifier and auditor sign-ins remain distinct real accounts. Scope and write permissions are enforced by FastAPI, not by visual navigation. Institution case-file audit data is unavailable to roles without audit authority. The existing database and key files are preserved.

Protected workspaces remain English. Public content, sign-in validation, guidance and verification controls have local Hindi translations; institution names, record values, references and technical evidence retain their stored values.
