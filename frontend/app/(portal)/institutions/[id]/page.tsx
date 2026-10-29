"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, GraduationCap, CircleAlert } from "lucide-react";
import { api } from "@/lib/api";
import type { User, Paginated } from "@/lib/types";
import { PageHeader } from "@/components/portal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { Badge, statusTone } from "@/components/ui/badge";
import { RecordTable } from "@/components/record-table";
import { Pagination } from "@/components/pagination";
type Detail = {
  institution: Record<string, string>;
  programmes: {
    id: string;
    code: string;
    name: string;
    specialization: string;
  }[];
  intakes: {
    id: string;
    programme_id: string;
    academic_year: string;
    regular_capacity: number;
    supernumerary_capacity: number;
    approval_status: string;
  }[];
  findings: number;
  enrolments: number;
};
const tabs = [
  { id: "overview", label: "Overview" },
  { id: "programmes", label: "Programmes & Intake" },
  { id: "enrolments", label: "Student Enrolment" },
  { id: "submissions", label: "Submissions" },
  { id: "compliance", label: "Compliance" },
  { id: "verification", label: "Verification Activity" },
  { id: "audit", label: "Audit History" },
];
export default function InstitutionCase() {
  const { id } = useParams<{ id: string }>(),
    [tab, setTab] = useState("overview"),
    [page, setPage] = useState(1);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User }>("/auth/me"),
  });
  const query = useQuery({
    queryKey: ["institution", id],
    queryFn: () => api<Detail>(`/institutions/${id}`),
  });
  const activity = useQuery({
    queryKey: ["institution-activity", id, tab, page],
    enabled: !["overview", "programmes"].includes(tab),
    queryFn: () =>
      api<Paginated<Record<string, unknown>>>(
        `/workspace/institutions/${id}/activity?kind=${tab}&page=${page}`,
      ),
  });
  if (!query.data)
    return (
      <div className="page">
        {query.error ? (
          <div className="error-panel">{query.error.message}</div>
        ) : (
          <div className="skeleton" />
        )}
      </div>
    );
  const d = query.data,
    i = d.institution;
  const fields: Record<string, string[]> = {
    enrolments: [
      "student",
      "institution_student_id",
      "programme",
      "academic_year",
      "status",
      "seat_type",
    ],
    submissions: [
      "reference",
      "filename",
      "academic_year",
      "accepted",
      "rejected",
      "status",
      "created_at",
    ],
    compliance: ["title", "type", "severity", "status", "academic_year"],
    verification: ["recipient", "outcome", "created_at"],
    audit: [
      "created_at",
      "actor",
      "role",
      "action",
      "entity_type",
      "outcome",
      "metadata",
    ],
  };
  return (
    <div className="page">
      <PageHeader
        title={i.name}
        description={`${i.permanent_id} · ${i.city}, ${i.state} · ${i.region} region`}
        actions={
          <>
            <Badge tone={statusTone(i.approval_status)}>
              {i.approval_status}
            </Badge>
            <Link href="/institutions" className="btn btn-secondary btn-sm">
              Registry
            </Link>
          </>
        }
      />
      <div className="metrics-grid">
        <MetricCard
          label="Programmes"
          value={d.programmes.length}
          icon={GraduationCap}
        />
        <MetricCard
          label="Enrolment records"
          value={d.enrolments}
          icon={Building2}
          tone="teal"
        />
        <MetricCard
          label="Findings on record"
          value={d.findings}
          icon={CircleAlert}
          tone="amber"
        />
      </div>
      <div
        className="tabs"
        role="group"
        aria-label="Institution case-file sections"
      >
        {tabs
          .filter(
            (t) =>
              t.id !== "audit" ||
              [
                "aicte_admin",
                "system_admin",
                "auditor",
                "institution_admin",
              ].includes(me.data?.user.role ?? ""),
          )
          .map((t) => (
            <button
              key={t.id}
              aria-pressed={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
            >
              {t.label}
            </button>
          ))}
      </div>
      {tab === "overview" ? (
        <Card>
          <CardHeader>
            <CardTitle>Institution profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="key-values">
              {[
                "permanent_id",
                "institution_type",
                "address",
                "city",
                "state",
                "region",
                "contact_email",
                "approval_status",
              ].map((k) => (
                <div className="key-value" key={k}>
                  <span>{k.replaceAll("_", " ")}</span>
                  <strong>{i[k]}</strong>
                </div>
              ))}
            </div>
            {["aicte_admin", "system_admin", "institution_admin"].includes(
              me.data?.user.role ?? "",
            ) && (
              <Link
                className="btn btn-secondary btn-md"
                style={{ marginTop: 20 }}
                href="/manage?task=edit%20institution"
              >
                Edit authorized profile
              </Link>
            )}
          </CardContent>
        </Card>
      ) : tab === "programmes" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Programme registry</CardTitle>
            </CardHeader>
            <CardContent>
              {d.programmes.map((p) => (
                <div key={p.id} className="check-row">
                  <span>
                    <strong>{p.name}</strong>
                    <span className="table-secondary">{p.specialization}</span>
                  </span>
                  <Badge>{p.code}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card style={{ marginTop: 20 }}>
            <CardHeader>
              <CardTitle>Approved intake history</CardTitle>
            </CardHeader>
            <CardContent>
              <RecordTable
                caption="Institution intake approvals"
                fields={[
                  "programme",
                  "academic_year",
                  "regular_capacity",
                  "supernumerary_capacity",
                  "approval_status",
                ]}
                rows={d.intakes.map((a) => ({
                  ...a,
                  programme: d.programmes.find((p) => p.id === a.programme_id)
                    ?.specialization,
                }))}
              />
            </CardContent>
          </Card>
        </>
      ) : activity.error ? (
        <div className="error-panel">{activity.error.message}</div>
      ) : activity.isLoading ? (
        <div className="skeleton" />
      ) : (
        <>
          <RecordTable
            paginate={false}
            rows={activity.data?.items ?? []}
            fields={fields[tab]}
            caption={
              tabs.find((t) => t.id === tab)?.label ?? "Institution records"
            }
          />
          <Pagination
            page={page}
            total={activity.data?.total ?? 0}
            onChange={setPage}
          />
          {tab === "compliance" && (
            <Link className="btn btn-secondary btn-md" href="/anomalies">
              Open scrutiny and review controls
            </Link>
          )}
        </>
      )}
    </div>
  );
}
