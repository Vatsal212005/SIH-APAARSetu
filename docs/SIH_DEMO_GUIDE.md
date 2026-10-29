# Five-scenario demo guide

Start with start-dev.ps1 -Demo, then sign in as central.admin@apaarsetu.demo. Open SIH Demo Center and optionally select Presentation mode.

A: Click Run scenario for Approved Intake Exceeded. Read authorized 120, counted 135 and excess 15. Expand actual inputs. Click Record review to persist a clarification request. Open Findings & Review and Audit Trail to see the same finding and decision. The backend counts real regular-seat enrolments and excludes separate supernumerary capacity.

B: Run Cross-Institution Duplicate. Compare the two current-year institutional records, dates and statuses. Explain that the same synthetic identifier may reflect a transfer or permitted concurrency. Record review requests documentation. Actual lifecycle changes must be made by an authorized institution, preserving history.

C: Run Student-Controlled Verification. This central presentation path explicitly scripts a synthetic student's consent using real issuer/consent services. Inspect actual signature status and selected fields. Click Verify signature and consent, open the verifier link or scan QR, then Revoke and verify denial. Repeat creates a new scoped reference and revokes the old scripted consent. For ordinary student operation, use the student wallet steps below.

D: Run Bulk Upload Validation. The backend constructs an actual mixed CSV, invokes the real parser/importer and stores accepted/rejected rows. Read counts and per-row errors. Download the persisted error report. Repeating returns the same scenario receipt. For the full upload UI, sign in as institution.operator@apaarsetu.demo, choose MBA/Technology Management, select the mixed CSV, Preview and validate, map columns if needed, then Confirm submission.

E: Run Intelligent Enrolment Anomaly. Read the evaluated institutions and actual Isolation Forest result. Expand feature examples and model output. Record review persists an expected-pattern outcome for an actual outlier. Use Findings & Review for an official justification and individual evidence.

Ordinary consent: sign in as student@apaarsetu.demo, open Credential Wallet, Share/Verify, choose fields and recipient, Grant 24-hour consent, Open verifier. Return and Revoke access, then refresh verifier to show denial. Issuance: institution.admin@apaarsetu.demo opens Credential Wallet, selects an eligible source and expiration days, Save record. Signature validity never implies official APAAR confirmation.

Progress persists in DemoSession. Plaintext disclosure links are intentionally not persisted server-side; repeat scenario C after a full browser reset to create a new reference. No scenario reset deletes unrelated records.
