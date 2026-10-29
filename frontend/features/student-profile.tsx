"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BrandMark, EvidencePanel } from "@/components/portal";
import { Badge, statusTone } from "@/components/ui/badge";
export function StudentProfile() {
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: () =>
      api<{
        name: string;
        masked_apaar: string;
        verification_status: string;
        provenance: Record<string, unknown>;
      }>("/profile"),
  });
  const records = useQuery({
    queryKey: ["dashboard"],
    queryFn: () =>
      api<{
        enrolments: {
          institution: string;
          institution_student_id: string;
          programme: string;
          academic_year: string;
        }[];
      }>("/dashboard"),
  });
  if (!query.data)
    return query.error ? (
      <div className="error-panel">{query.error.message}</div>
    ) : (
      <div className="skeleton" />
    );
  const p = query.data,
    e = records.data?.enrolments[0];
  return (
    <section
      className="identity-card"
      aria-label="Demonstration academic record card"
    >
      <div className="identity-card-head">
        <div>
          <span className="eyebrow">
            APAARSetu · Demonstration student record
          </span>
          <h2>{p.name}</h2>
          <strong>{p.masked_apaar}</strong>
        </div>
        <BrandMark />
      </div>
      <div className="key-values">
        {[
          ["Institutional student ID", e?.institution_student_id],
          ["Institution", e?.institution],
          ["Programme", e?.programme],
          ["Academic year", e?.academic_year],
        ].map(([k, v]) => (
          <div className="key-value" key={k}>
            <span>{k}</span>
            <strong>{v ?? "Not recorded"}</strong>
          </div>
        ))}
      </div>
      <p>
        <Badge tone={statusTone(p.verification_status)}>
          {p.verification_status.replaceAll("_", " ")}
        </Badge>
      </p>
      <p className="record-subtitle">
        Original prototype record card. This is not an official
        government-issued APAAR card.
      </p>
      <EvidencePanel
        title="Verification provenance and sources"
        value={p.provenance}
      />
    </section>
  );
}
