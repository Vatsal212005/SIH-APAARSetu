# Credential signatures

The issuer service serializes canonical JSON using sorted keys and compact separators, then signs those exact UTF-8 bytes with Ed25519. Payloads include issuer, subject reference, academic record, provenance, issuance and expiration. The database stores detached base64url signature and key ID. The public-key endpoint provides PEM metadata. Tampering changes canonical bytes and fails verification.

Ordinary issuance requires institution-administrator or central authorization and an accepted/enrolled/completed institution-attested source record. Operator issuance is denied. Revocation remains a separate server-side status; it never rewrites the signed JSON. Reissue creates a new credential code and retains prior entries. Consent verification checks current database status as well as signature.

Private keys are generated locally under runtime/keys and ignored by Git. Preserve them across restarts and back them up securely with the database. This implementation uses one active demonstration key ID. Production rotation needs archived public keys and a key-ID registry plus controlled private-key custody; automated rotation is not claimed.

Certificates have a synthetic watermark, masked APAAR and institutional student ID, programme/year, credential code and signing metadata. A consent-specific download can include its scoped QR. A routine owner-only PDF without a consent token routes to the wallet and discloses nothing publicly.
