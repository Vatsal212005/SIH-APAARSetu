# Verified scope and deployment boundaries

The native demonstration uses synthetic records. Official APAAR, DigiLocker and AICTE provider connections remain unavailable. Format/internal checks and local issuer signatures do not authenticate government identities.

Consent uses opaque bearer references, not cryptographically authenticated recipient audiences. The recipient name is a consent label. Local private keys rely on operating-system file permissions; automated multi-key rotation and HSM custody are not implemented. PostgreSQL compatibility is designed through SQLAlchemy but not exercised here. Rate limits use process memory and need shared infrastructure for multiple workers.

The five guided scenarios and ordinary portal workflows use real services. Demo Center consent is explicitly scripted for a fictional student. It does not grant administrators ordinary consent authority. Scenario tokens are shown once and omitted from persisted state. A refresh retains scenario evidence; repeat C to obtain a fresh disclosure reference.

Imports have deliberate demonstration limits: 10 MB, 10,000 student rows, 50 MB expanded XLSX, and 200 preview rows returned to the browser. Registry CSV supports 1,000 rows and 2 MB. Empty and rejected cohorts appear honestly rather than fabricated counts. The report catalog uses authorized aggregates; its named report types share a common reporting engine.

Maintenance reminders and session-retention candidate counts run on demand through the administrative job endpoint. Academic-record deletion is not automated. Audit records have no application mutation endpoints but are not tamper-proof against a database administrator. No national-scale load test, independent penetration test or statutory certification has been performed.

No official SIH presentation template was supplied/found. The six-slide editable PPTX and PDF are clearly identified drafts. The source repository is https://github.com/Vatsal212005/SIH-APAARSetu. Presentation files retain their original draft context; apply the current official template and team details before submission.

Synthetic hold-out model results and tiny deterministic/conflict case sets do not establish production accuracy. See evaluation.json for confusion matrices and measured timings. Desktop computer-use URL inspection was unavailable; automated Brave/Playwright journeys and rendered screenshots provide the browser evidence used here.
