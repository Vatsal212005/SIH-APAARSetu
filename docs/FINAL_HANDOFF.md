# APAARSetu local acceptance and submission handoff

Primary application: C:\Users\ironm\OneDrive\Desktop\APAARSetu. Both original project directories were preserved. The primary project has independently installed dependencies, its own database/secret/issuer keys, and no startup dependency on SIH-2.

## Start and access

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\ironm\OneDrive\Desktop\APAARSetu\start-dev.ps1" -Demo -OpenBrave
```

Frontend: http://localhost:3001. Backend/OpenAPI: http://localhost:8001/docs. Stop with stop-dev.ps1 in the primary root. The completed acceptance run left both services running. Repeated launch reuses healthy owned services; stopping checks process ownership and preserves data.

Development accounts share password Demo@26263 and work only with explicit demo mode:

| Portal | Account | Verified workflow |
|---|---|---|
| AICTE administration | central.admin@apaarsetu.demo | Central dashboard, registry/programmes/years, intake authorizations, policy versions, finding review, reports, audit, users/configuration and Demo Center |
| Institution management | institution.admin@apaarsetu.demo | Scoped registry/student management, CSV/XLSX preview/mapping/import, row errors, enrolment history/transitions, corrections and credential issuance/revocation |
| Student | student@apaarsetu.demo | Own identity/enrolments, correction requests, signed credential wallet, scoped sharing, QR/certificate downloads, expiry/revocation and access history |
| Academic verifier | verifier@apaarsetu.demo | Opaque disclosure reference entry, signature and validity evidence, consent checks and denied access after revocation; no identity enumeration |

Additional regional officer, operator and auditor accounts are listed in README.md. Negative backend tests enforce role and institution boundaries independently of navigation visibility.

## Five real-service demonstrations

A computes 135 countable admissions against 120 approved regular seats, yielding 15 excess; evidence and review persist. B shows two institutional submissions sharing one fictional identifier, with overlap evidence, justified review and transfer-aware rules. C issues a real Ed25519-signed local credential, records explicitly scripted synthetic student consent, verifies selected fields and denies access after revocation. D parses a mixed CSV through the actual importer, persists accepted records and produces rejected-row details/error download. E fits Isolation Forest to actual stored institutional features, saves scores/explanations and records human review. Refresh retains scenario evidence; repeat C for a fresh one-time-displayed disclosure reference.

## Acceptance evidence

The final automated runs passed 77 backend tests, 6 frontend unit tests and 7 live Brave browser journeys. Strict TypeScript, ESLint, Ruff and the production build passed. npm audit reported zero known vulnerabilities at install time. See TEST_RESULTS.md and backend-test-results.xml for recorded results and limits.

The live central account confirmed 100 institutions, 5,009 student identities, 6,010 enrolments and 18 reporting variants. These totals include deliberate historical and browser-exercise records. The original 5,000 identity / 5,001 current-year enrolment seed remains intentional; the additional enrolment demonstrates a cross-institution conflict. A stop/start preserved all 5,009 identities, 6,010 enrolments, 6 credentials, 12 consent grants, 3 record versions and 5 import receipts. See live-acceptance.json and persistence-check.json.

Synthetic hold-out precision is 0.80, recall 1.00 and F1 0.888889 (TP40/TN190/FP10/FN0); this is not a production-accuracy estimate. Evaluation source, labelled datasets, timing evidence and methodology are included. Tests exercise server-side authorization, CSRF/session expiry, masked identifiers, safe uploads, intake authority, actual signatures/tampering, selective disclosure and credential/consent expiry/revocation. Ordinary endpoints cannot modify audit entries. Independent penetration testing has not been performed.

## Submission package

- SIH_IDEA_TITLE.txt, SIH_IDEA_DESCRIPTION.txt, SIH_ABSTRACT.txt, SIH_INNOVATION.txt, SIH_TECH_STACK.txt, SIH_FEASIBILITY.txt, SIH_IMPACT.txt and SIH_EVALUATION_RESULTS.txt are ready-to-copy plain text.
- SIH_JUDGE_QA.md, SIH_DEMO_GUIDE.md and COMPLETE_DEMO_GUIDE.md cover judge questions and actual portal navigation.
- SIH_VIDEO_SCRIPT.txt and SIH_3_MINUTE_DEMO.md provide the two-to-three-minute recording sequence.
- presentation/APAARSetu-SIH-draft.pdf and presentation/APAARSetu-SIH-draft.pptx contain six slides and actual browser screenshots. No official template was available; both are explicitly labelled drafts. The PDF was rendered and visually inspected; PPTX structure, layout and import were checked, without claiming inspection in native PowerPoint.
- README.md, INSTALLATION.md, ARCHITECTURE.md, DATABASE_DESIGN.md, API.md, COMPLETE_USER_GUIDE.md and the validation/intake/anomaly/signature/consent/security documents describe operation and implementation.

## Remaining boundaries

Official APAAR/DigiLocker/AICTE verification is unavailable and explicitly labelled. Credentials are local issuer attestations. Opaque links are bearer references; recipient labels are not cryptographically bound authenticated audiences. The local signing key has no automated multi-key rotation/HSM. PostgreSQL deployment, national-scale performance and legal/security certification are unverified. Maintenance is on demand, not a scheduled production worker. See KNOWN_LIMITATIONS.md for upload limits, audit administrator trust and migration-hardening notes.

No GitHub repository or public deployment was created. Source checkpointing is local; private runtime data, generated keys, application secrets, environments and dependency folders are excluded. Recovery checkpoints and a consistent SQLite/key backup remain local.
