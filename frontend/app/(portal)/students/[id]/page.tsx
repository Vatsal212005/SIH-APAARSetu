"use client";
import { parseTimestamp } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, EvidencePanel } from "@/components/portal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
type Case = {
  identity: { name: string; masked_apaar: string; verification_status: string };
  enrolments: {
    id: string;
    institution: string;
    institution_student_id: string;
    programme: string;
    academic_year: string;
    status: string;
    attested: boolean;
  }[];
  credentials: {
    id: string;
    code: string;
    expires_at: string;
    revoked: boolean;
  }[];
  corrections: { field: string; status: string; reason: string }[];
  history: {
    id: string;
    reason: string;
    before: unknown;
    after: unknown;
    created_at: string;
  }[];
};
export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: { role: string } }>("/auth/me"),
  });
  const query = useQuery({
    queryKey: ["student-case", id],
    queryFn: () => api<Case>(`/workspace/students/${id}`),
  });
  const d = query.data;
  if (!d)
    return (
      <div className="page">
        {query.error ? (
          <div role="alert" className="error-panel">
            {query.error.message}
          </div>
        ) : (
          <div className="skeleton" />
        )}
      </div>
    );
  return (
    <div className="page">
      <PageHeader
        title={d.identity.name}
        description="Student academic case file · Fictional demonstration record"
        actions={
          <Link href="/students" className="btn btn-secondary btn-md">
            Return to register
          </Link>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Personal & academic identity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="key-values">
            <div className="key-value">
              <span>Masked academic identifier</span>
              <strong>{d.identity.masked_apaar}</strong>
            </div>
            <div className="key-value">
              <span>Verification provenance</span>
              <Badge tone={statusTone(d.identity.verification_status)}>
                {d.identity.verification_status.replaceAll("_", " ")}
              </Badge>
            </div>
          </div>
          <p className="record-subtitle">
            No official APAAR identity verification has been performed.
          </p>
        </CardContent>
      </Card>
      <h2>Institution enrolment · programme & academic year</h2>
      <div className="grid-list">
        {d.enrolments.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <CardTitle>{e.institution}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="key-values">
                {[
                  ["Institutional student ID", e.institution_student_id],
                  ["Programme", e.programme],
                  ["Academic year", e.academic_year],
                  ["Enrolment status", e.status],
                  [
                    "Institutional attestation",
                    e.attested ? "Recorded" : "Not recorded",
                  ],
                ].map(([k, v]) => (
                  <div className="key-value" key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <Link href={`/enrolments?student_id=${id}`}>
                Open authorized lifecycle controls →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="detail-grid" style={{ marginTop: 20 }}>
        <Card>
          <CardHeader>
            <CardTitle>Validation & correction requests</CardTitle>
          </CardHeader>
          <CardContent>
            {d.corrections.length ? (
              d.corrections.map((c, i) => (
                <div className="check-row" key={i}>
                  <span>
                    {c.field.replaceAll("_", " ")}
                    <span className="table-secondary">{c.reason}</span>
                  </span>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </div>
              ))
            ) : (
              <p>No correction requests in this record scope.</p>
            )}
            <Link href="/corrections">Open corrections →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Academic credentials</CardTitle>
          </CardHeader>
          <CardContent>
            {d.credentials.length ? (
              d.credentials.map((c) => (
                <div className="check-row" key={c.id}>
                  <span>
                    {c.code}
                    <span className="table-secondary">
                      Expires{" "}
                      {parseTimestamp(c.expires_at).toLocaleDateString("en-IN")}
                    </span>
                  </span>
                  <Badge tone={c.revoked ? "red" : "teal"}>
                    {c.revoked ? "Revoked" : "Issued"}
                  </Badge>
                </div>
              ))
            ) : (
              <p>No credentials issued for these enrolments.</p>
            )}
            <p className="record-subtitle">
              Consent is managed by the student. Administrative access does not
              authorize sharing on a student’s behalf.
            </p>
            {["aicte_admin", "system_admin", "institution_admin"].includes(
              me.data?.user.role ?? "",
            ) && <Link href="/credentials">Open credential workspace →</Link>}
          </CardContent>
        </Card>
      </div>
      <Card style={{ marginTop: 20 }}>
        <CardHeader>
          <CardTitle>Record history</CardTitle>
        </CardHeader>
        <CardContent>
          {d.history.length ? (
            <ol className="timeline">
              {d.history.map((v) => (
                <li key={v.id}>
                  <strong>{v.reason}</strong>
                  <time>
                    {parseTimestamp(v.created_at).toLocaleString("en-IN")}
                  </time>
                  <EvidencePanel
                    title="Before and after this change"
                    value={{ before: v.before, after: v.after }}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <p>No versioned amendments have been recorded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
