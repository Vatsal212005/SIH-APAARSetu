# Database design

Core tables: users, session_tokens, institutions, programmes, capacity_policies, approved_intakes, students, enrolments, import_batches, import_rows, anomaly_findings, academic_credentials, consent_grants, disclosure_tokens, verification_events, correction_requests, notifications, audit_events, student_record_versions, academic_years and demo_sessions.

UUID keys separate public identifiers from identity. Unique constraints protect institution permanent IDs, programme codes per institution, intake per programme/year and local student IDs per institution/year. Student identifiers use Fernet ciphertext plus a keyed HMAC lookup and last-four display. Identity lookup is indexed but not a public endpoint.

An identity may have historical or concurrent enrolments. Transferred/withdrawn records remain stored. Policy determines counted statuses; routine intake reports separate regular and supernumerary allocations. NRI category is independent from OCI and foreign-national status.

Migrations 0001 and 0002 are additive and idempotent. Initialization runs Alembic upgrade head. Never drop the database during startup. Migration tests reopen an existing database and confirm retained records. The initial migration imports current ORM metadata, which is convenient for this demo but should be frozen into explicit historical DDL before a production migration programme. Destructive downgrade is disabled.

Back up runtime/apaarsetu.db through SQLite's online backup API together with application.secret and runtime/keys. A database without its encryption/signing material cannot reproduce identity lookups or verify the original issuer signatures.
