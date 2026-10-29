# Judge questions and answers

**Does a valid twelve-digit identifier prove an official APAAR identity?** No. The application checks format and internal consistency. Official provider evidence is unavailable.

**What does the digital signature prove?** The local demonstration issuer signed the canonical payload and its bytes have not changed. Consent, expiry and revocation are checked independently.

**How do you avoid calling transfers fraud?** Identity linkage, year/status context, transfer lifecycle states and configurable permitted concurrency inform review. Findings require human adjudication and a reason.

**Can an institution change capacity to hide excess admissions?** Capacity authorization is central-only and changes retain before/after audit evidence. Negative backend tests exercise the restriction.

**What is the ML model?** A real Isolation Forest over utilization and category/flag ratios. Features and raw outlier ranking are stored. Evaluation uses a separate labelled synthetic hold-out set.

**Are the evaluation numbers production accuracy?** No. They describe the documented synthetic distribution and seed. False positives are reported, and real deployment needs validated institutional datasets.

**What privacy limitations remain?** Bearer links can be forwarded, local keys rely on OS controls, and a database administrator can alter audit rows. Production requires authenticated audiences, hardened key custody and independent assessment.

**Can this run without paid services or Docker?** Yes. The native Windows application uses local SQLite, ML inference and Ed25519 keys. Government connectors remain disabled.

**Why more enrolments than students?** Identities and enrolments are separate. One intentional current-year overlap plus historical enrolments demonstrate cross-institution and lifecycle cases.

**What is ready for a real national deployment?** The local demonstration and tests establish the implemented workflows. National deployment needs authorized government integrations, infrastructure/load testing, governance and security certification not claimed here.
