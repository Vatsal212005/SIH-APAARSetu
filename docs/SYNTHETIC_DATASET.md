# Synthetic dataset

Seed 26263 uses UUID5 identifiers, explicit Synthetic institution/student names, reserved example.invalid contacts and artificial twelve-digit APAAR-like values. It creates 100 institutions across ten states/five regions, three programmes per institution, three approval years, 5,000 identities and 5,001 current-year enrolments. The extra enrolment intentionally links one student to two institutions during the same year.

Recovery extends the existing seed with 1,000 past-year enrolments. These preserve the same identities and have completed or transferred statuses. Historical records do not alter the 2025-26 regular-seat scenario. The base after extension contains 6,001 enrolments. Upload/demo/browser exercises add persistent synthetic test records, so runtime counts may exceed the base. Seeding twice does not duplicate records.

Institution zero's CSE course has 120 authorized regular seats and 135 countable admissions. NRI, OCI and FN examples are independent boolean attributes. A cross-institution record is flagged for review rather than labelled fraud. Demo credentials and local accounts are synthetic. Imported mixed data includes malformed, missing, duplicate and invalid-date cases.

No actual students, Aadhaar numbers or official APAAR registry data were used. Hold-out anomaly evaluation is a separate numerical synthetic set of 500 training rows and 240 evaluation rows.
