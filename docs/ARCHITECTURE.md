# Architecture

Next.js renders role-specific portals and talks to /api/v1 with HttpOnly cookies and an X-CSRF-Token on mutations. TanStack Query invalidates database-backed views after writes. FastAPI dependencies enforce authentication, roles and institution/region scope. SQLAlchemy services own relational transactions. SQLite foreign keys and WAL are enabled.

Routers separate authentication, operations, management, credentials, reports and demo sessions. Services separate validation, ingestion, issuer cryptography, anomaly detection, audit/notification creation and deterministic seeding. The provider protocol in app/integrations represents external identity evidence and defaults to unavailable.

Student identity is separate from enrolment. Intake is scoped to programme/year and references a versioned policy. Import rows retain masked data and errors. Accepted rows use savepoints. Findings store rule/model evidence and human review. RecordVersion stores before/after changes. DemoSession stores scenario progress without plaintext disclosure tokens.

Native scripts own processes through a root-specific ledger and verified command lines. The API binds loopback. Production requires TLS, a managed database, OS secret/key protection, backed-up issuer keys, independent security review and approved government-provider contracts. PostgreSQL is verified in the Vercel/Neon hosted demonstration; see HOSTED_DEMO_RESULTS.md. Native local execution continues to use SQLite.
