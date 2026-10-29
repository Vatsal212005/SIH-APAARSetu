# User guide

Sign in at /login using a development account with -Demo enabled. Sign out before changing roles. The role and portal appear in the header. Every screen carries the synthetic-data boundary.

Central: Overview shows database counts and charts. Institutions supports search and profile drill-downs. Programmes & Intake shows approved and counted seats with explicit excess. Student Registry searches masked identities. Management creates students, programmes, institutions, policy versions, academic years, approvals and users according to role. Findings & Review expands evidence and records a justified decision. Audit Trail shows persisted events. Reports downloads authorized CSV/PDF summaries. Demo Center runs the five guided scenarios.

Institution: Management registers individual admissions. Data Ingestion selects programme/year, uploads CSV/XLSX, maps nonstandard columns, previews errors and confirms persistence. Download the mixed CSV or error report. Enrolment Lifecycle opens a record, changes allowed status with justification and displays persisted versions. Institution administrators review Corrections and issue/revoke credentials in Credential Wallet. Operators cannot authorize capacity or issue credentials.

Student: Overview and Enrolment Lifecycle show only linked records. Corrections selects a specific enrolment; choose full_name or institution_student_id, enter requested value/reason and submit. Credential Wallet shows signatures and history. Share/Verify selects fields and intended verifier, then grants 24-hour consent. Copy/open the link or scan the QR. Revoking access blocks the next verification attempt.

Verifier: enter the student's opaque reference in the verifier overview or open the shared URL directly. Check signature, issuer, consent and status separately. Only authorized fields appear. An invalid, expired or revoked reference reveals no student data.

Notifications persist read status. Loading/error messages reflect actual API responses. If an action is denied, do not use another role's credentials in a real deployment; the demo accounts exist only for demonstration.
