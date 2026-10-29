# Security and privacy

Sessions use random opaque cookies, keyed hashes in the database, HttpOnly and SameSite=Strict. Production cookies are Secure. Passwords use salted scrypt. Mutation endpoints require CSRF headers. Login attempts are throttled in process; verification requests are limited per client window. These local limits need shared storage and trusted proxy configuration for a multi-worker deployment.

All sensitive record access requires server-side roles and scope. Students cannot enumerate institutional data. Verifiers need a scoped bearer disclosure reference. Institutions cannot authorize intake capacity, create central users, issue credentials as operators, or access another institution. Region filtering applies to regulatory lists. Negative tests exercise read and mutation restrictions.

Identifiers use Fernet ciphertext and keyed HMAC lookup. Routine views show last four digits. Import ledgers retain masked identifiers. Application secrets, private issuer keys, databases, logs and generated environments are excluded from Git. Access logs are disabled on the native backend runner to avoid logging disclosure URLs. Referrer-Policy:no-referrer, no-store and nosniff protect verification responses. Tokens are stored only as hashes; plaintext links appear once in the browser.

A bearer link can be forwarded by its recipient. Recipient identity authentication is not cryptographically bound to the token. The verifier label describes the student's intended recipient. Implement identity-bound audiences and key custody in an authorized production deployment. Files accept only CSV/XLSX with compressed-workbook expansion, byte and row limits; no upload is executed.

Audit history has no ordinary edit/delete endpoints. It is not tamper-proof against a database administrator. Local signing PEMs rely on filesystem access controls and are not HSM-protected. The demonstration has not undergone independent penetration testing or legal compliance certification.

All data is fictional. No Aadhaar fields are collected. Real minors require guardian consent, lawful purpose and appropriate retention controls. Retention should be administered through reviewed policies and backups; this demo does not automatically erase academic records.
