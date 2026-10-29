# Windows installation and recovery

Use the primary folder C:\Users\ironm\OneDrive\Desktop\APAARSetu. Python 3.12.7 and Node 22.20 were present on this host. Run scripts/setup.ps1 on a fresh checkout. It creates .venv, installs backend/requirements.txt, and runs npm ci --legacy-peer-deps in frontend. Do not depend on globally installed Python libraries.

Run start-dev.ps1 -Demo -OpenBrave. The script uses absolute project-local paths, applies Alembic migrations, creates a stable random application secret when absent, initializes issuer keys, seeds synthetic data idempotently and waits for HTTP health. Run stop-dev.ps1 to stop only ledger-owned processes and their immediate children. Foreign listeners cause a reported port conflict.

.env settings use APAARSETU_ prefix. Demo mode defaults false. A -Demo launch explicitly enables synthetic accounts. Production sets APAARSETU_ENV=production for Secure cookies, uses TLS and a strong persistent secret. Database URL defaults to runtime/apaarsetu.db. Frontend origin defaults http://localhost:3001 and must match the browser origin for credentialed requests.

Recovery source checkpoints are under recovery-checkpoints/ and are ignored by Git. Runtime keys and databases were preserved independently. The initial primary dependency folders were incomplete copies; reinstalling packages directly repaired missing Next.js and Alembic modules. No project source was restarted or discarded.
