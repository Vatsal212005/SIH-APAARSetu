# Recovery and implementation audit

The two existing source trees were compared by SHA-256 on 29 October 2026. Staging contained newer frontend dependency manifests, evaluation script and tests. Primary contained no unique application source; it did contain a separate SQLite database, issuer keys and application secret. Both source trees were checkpointed before reconciliation. Runtime data and keys stay in their original directory.

The primary startup failure was an incomplete node_modules copy (missing next/dist/compiled/@babel/runtime/package.json). Dependencies are being installed directly from the reconciled lockfile. No staging runtime path is required by application source.

Initial implemented services: persistent registry/enrolments, sessions and CSRF, basic scoping, intake counts, CSV/XLSX partial ingestion, findings/review, Isolation Forest, Ed25519 credentials, consent tokens, PDF reports/certificates.

Initial gaps identified: missing management mutation interfaces, incomplete import preview/mapping, policy rules not consumed consistently, missing version/lifecycle records and correction review, incomplete demo interactions, narrow negative-access coverage, regional scoping gaps, consent metadata leaks on denial, missing QR display and access history, launcher process ownership/reuse and incomplete documentation.

Recovery completed the management workspace, policy-based counts, import preview/mapping, scoped idempotency, version history, correction review, own-profile provenance, credential issuance/revocation/sharing controls, QR display, access history, an 18-report catalog, user access controls, institution CSV imports, integration status and an audited maintenance hook. Five Demo Center scenarios invoke actual services and persist evidence. Negative access tests and browser regression coverage were expanded. Primary dependencies were reinstalled directly, local virtual-environment metadata was corrected, and native health checks now use explicit IPv4 loopback to avoid Windows localhost resolution timeouts.

The initial verification baseline was ten backend tests and a staging build. Final evidence is recorded in TEST_RESULTS.md and live-acceptance.json. Deployment boundaries, bearer-audience limitations and unverified optional infrastructure are documented in KNOWN_LIMITATIONS.md rather than claimed as complete.
