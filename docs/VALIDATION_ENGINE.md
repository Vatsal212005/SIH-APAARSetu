# Validation engine

validate_student_row validates presence, twelve-digit identifier structure, student/local ID, seat types, independent boolean categories, programme/institution ownership and academic-year context. Internal HMAC lookup compares existing names and date of birth. Same-institution/year active submissions are duplicates. Other-institution active records create potential conflicts unless an explicitly selected policy permits concurrent enrolment. Transferred or withdrawn records do not create active overlap.

Missing/malformed fields reject a row. Cross-institution or demographic inconsistencies flag the row for review. The importer saves masked raw values, result and errors. Successful flags persist findings with submitted/existing evidence. It does not merge records based on similar names. A matching identifier links the internal identity while preserving discrepancy evidence.

Preview runs the checks without committing a batch. Confirmation validates again against current database state. Content hashes include institution, programme, year and mapping to provide context-scoped idempotency. A repeated confirmed batch returns the existing receipt. Savepoints protect accepted rows against duplicate local-ID constraint failures.

Review actions store actor, justification, assignment and review state. Transfer decisions are reflected by explicit lifecycle changes, with before/after RecordVersion entries. Format validation and conflict classification are evaluated separately from numerical anomaly detection.
