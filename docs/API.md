# API

Interactive contracts: http://localhost:8001/docs. Machine contract: /openapi.json. Prefix /api/v1.

Authentication: POST /auth/login, GET /auth/me, POST /auth/logout. Successful login returns CSRF token and sets an HttpOnly SameSite=Strict cookie. Send X-CSRF-Token on mutations.

Registry: GET/POST /institutions, GET/PATCH /institutions/{id}; GET/POST /programmes, PATCH /programmes/{id}; GET/POST /academic-years; GET/POST /policies; GET/POST /intakes; GET/POST /students; GET /enrolments and PATCH /enrolments/{id}; GET /enrolments/{id}/history.

Ingestion: multipart POST /imports accepts file, institution_id, programme_id, academic_year, mapping (source-to-supported-field JSON) and preview boolean. Preview commits no rows. Confirm stores accepted rows and rejection evidence. GET /imports and /imports/{id}/errors.csv expose authorized receipts/errors.

Review: GET /findings, POST /findings/{id}/review; POST /anomaly/run. GET/POST /corrections, POST /corrections/{id}/review. GET /notifications, POST /notifications/{id}/read; GET /audit. GET/POST /users is central-only. GET /integrations reports provider availability.

Credentials: GET /credentials; POST /credentials/issue; POST /credentials/{id}/revoke?reason=...; GET /credentials/{id}/certificate.pdf. Student-only GET/POST /consents and POST /consents/{id}/revoke. Public GET /verification/{opaque-token} checks all disclosure conditions and logs access. GET /disclosure-qr/{token} renders only the opaque URL. GET /verification-events is scope-limited.

Reports: /reports/summary, /reports/enrolment.csv, /reports/enrolment.pdf. GET /reports/catalog lists 18 named variants; /reports/analysis accepts kind, academic_year, institution_id, state, region, start, end and format=json/csv/pdf. Demo Center: GET /demo/scenarios; POST /demo/scenarios/{scenario}/run with action run/review/verify/revoke. Demo routes require central role and enabled demonstration mode.

Additional management: POST /institutions/import accepts a registry CSV. PATCH /users/{id} changes role/active status and invalidates sessions. GET /profile returns only the student's own masked identity and provenance. GET /privacy-config exposes the full-identifier certificate policy. POST /jobs/maintenance generates deduplicated unresolved-review reminders and counts expired-session retention candidates. It does not delete academic records.

401 means absent/expired session; 403 means denied role/scope/CSRF; 409 means duplicate or reviewed record; 422 means business/schema validation; 413/415 reject oversized/unsupported uploads. Sensitive error details remain in local structured logs.
