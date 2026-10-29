"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { WorkflowForm } from "@/features/management";
import type { User } from "@/lib/types";
type Correction = {
  id: string;
  field_name: string;
  requested_value: string;
  reason: string;
  status: string;
};
export default function Corrections() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User }>("/auth/me"),
  });
  const enrolments = useQuery({
    queryKey: ["enrolments"],
    queryFn: () =>
      api<{
        items: {
          id: string;
          institution_student_id: string;
          institution: string;
          academic_year: string;
        }[];
      }>("/enrolments"),
  });
  const query = useQuery({
    queryKey: ["corrections"],
    queryFn: () => api<{ items: Correction[] }>("/corrections"),
  });
  return (
    <div className="page">
      <div className="page-title">
        <h1>Correction requests</h1>
        <p>
          Students request changes; authorized institution administrators review
          and record the decision.
        </p>
      </div>
      {me.data?.user.role === "student" && (
        <WorkflowForm
          title="Request correction"
          path="/corrections"
          fields={[
            {
              name: "enrolment_id",
              options: (enrolments.data?.items ?? []).map((e) => ({
                value: e.id,
                label: `${e.institution_student_id} — ${e.institution} — ${e.academic_year}`,
              })),
            },
            {
              name: "field_name",
              options: ["full_name", "institution_student_id"].map((value) => ({
                value,
                label: value,
              })),
            },
            { name: "requested_value" },
            { name: "reason" },
          ]}
        />
      )}
      <div className="grid-list" style={{ marginTop: 18 }}>
        {query.data?.items.map((c) => (
          <div className="card" style={{ padding: 18 }} key={c.id}>
            <strong>
              {c.field_name}: {c.requested_value}
            </strong>
            <p>
              {c.reason} · {c.status}
            </p>
            {c.status === "open" &&
              ["aicte_admin", "institution_admin", "system_admin"].includes(
                me.data?.user.role ?? "",
              ) && (
                <WorkflowForm
                  title="Review correction"
                  path={`/corrections/${c.id}/review`}
                  fields={[
                    {
                      name: "decision",
                      options: ["approved", "rejected"].map((value) => ({
                        value,
                        label: value,
                      })),
                    },
                    { name: "reason" },
                  ]}
                />
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
