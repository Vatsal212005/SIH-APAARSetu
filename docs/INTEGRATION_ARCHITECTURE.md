# Integration architecture

Working adapters are CSV, XLSX and versioned authenticated REST/OpenAPI. The identity provider Protocol returns explicit IdentityEvidence including state, provider and reference. The default APAAR provider reports unavailable and never externally confirms an identity.

Official APAAR, DigiLocker and AICTE registry connectors remain unavailable. No invented response or undocumented checksum is used. A future authorized adapter must implement the provider protocol, retain provider reference/provenance, verify signed callbacks and enforce consent and contractual purpose. Configure secrets outside source, use provider-issued test environments and record evidence before assigning externally_confirmed.

Institutional SIS imports can call the existing authenticated student/import services. Production interoperability requires service identities, organization-scoped authorization, request limits, idempotency and schema/version contracts. The current demonstration uses human session authentication and does not claim production OAuth service-to-service onboarding.
