# Consent and verification

The student selects credential, fields, intended recipient, purpose and expiration. The backend validates ownership and an allowed field list. A random 256-bit-scale opaque reference is returned once; only its keyed hash remains in DisclosureToken. The link contains no student identifier.

Verification looks up the reference, checks Ed25519 signature, trusted demo key, consent expiry/revocation and credential expiry/revocation. Only when all checks pass does it project the selected fields. Denial returns no student fields, credential code, purpose or issuer metadata. Every recognized-token attempt records an access event visible in the student wallet.

Revoking consent immediately affects subsequent requests. Expiration is checked at access time and does not require a background job. Revoke does not invalidate a signature; it invalidates disclosure authorization. Credential revocation independently invalidates credential-current checks. QR images encode only the opaque link and carry no academic payload.

Demo Center scenario C has a visibly labelled scripted synthetic student consent actor. Ordinary consent endpoints remain student-only. Token possession authorizes disclosure; verifier login alone does not allow enumeration. Recipient names are labels, not independently authenticated audiences.
