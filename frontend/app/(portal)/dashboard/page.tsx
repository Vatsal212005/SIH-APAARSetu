"use client";
import {parseTimestamp} from "@/lib/utils";
import Link from "next/link";
import {
  Building2,
  Users,
  Database,
  CircleAlert,
  ClipboardCheck,
  Network,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { PageHeader } from "@/components/portal";
import { Label } from "@/components/ui/input";
import { Badge, statusTone } from "@/components/ui/badge";
import { StudentProfile } from "@/features/student-profile";
import { VerifierEntry } from "@/features/verifier-entry";
import { WorkQueue, type QueueItem } from "@/features/work-queue";
type Base = {
  portal: string;
  metrics: Record<string, number>;
  enrolments?: {
    id: string;
    institution: string;
    programme: string;
    academic_year: string;
    status: string;
  }[];
};
type Overview = {
  metrics: Record<string, number>;
  institutions: { id: string; name: string }[];
  capacity: {
    institution: string;
    programme: string;
    academic_year: string;
    regular_capacity: number;
    regular_enrolment: number;
    regular_excess: number;
  }[];
  state_distribution: { state: string; count: number }[];
  enrolment_trend: { year: string; count: number }[];
  verification_distribution: { status: string; count: number }[];
  status_distribution: { status: string; count: number }[];
  work_queue: QueueItem[];
  recent_activity: {
    id: string;
    action: string;
    actor: string;
    created_at: string;
  }[];
  recent_submissions: {
    id: string;
    filename: string;
    accepted: number;
    rejected: number;
    created_at: string;
  }[];
  options: {
    years: string[];
    states: string[];
    regions: string[];
    institution_types: string[];
    programmes: { id: string; name: string; institution: string }[];
  };
  generated_at: string;
};
export default function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Base>("/dashboard"),
  });
  if (query.isLoading)
    return (
      <div className="page" aria-busy="true">
        <div className="skeleton" />
      </div>
    );
  if (!query.data)
    return (
      <div className="page">
        <div className="error-panel" role="alert">
          {query.error?.message}
        </div>
      </div>
    );
  if (query.data.portal === "verifier") return <VerifierEntry />;
  if (query.data.portal === "student")
    return <StudentDashboard data={query.data} />;
  return (
    <AdministrationDashboard
      institution={query.data.portal === "institution"}
    />
  );
}
function AdministrationDashboard({ institution }: { institution: boolean }) {
  const [filters, setFilters] = useState({
    academic_year: "2025-26",
    state: "",
    region: "",
    institution_type: "",
    programme_id: "",
  });
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v),
  );
  const query = useQuery({
    queryKey: ["workspace-overview", filters],
    queryFn: () => api<Overview>("/workspace/overview?" + params),
  });
  const data = query.data,
    m = data?.metrics ?? {};
  const change = (key: string, value: string) =>
    setFilters({ ...filters, [key]: value });
  return (
    <div className="page">
      <PageHeader
        title={
          institution
            ? "Institution Student Data Management"
            : "Student Enrolment Monitoring Dashboard"
        }
        description={
          institution
            ? (data?.institutions[0]?.name ??
                "Your authorized institutional workspace") +
              " · Academic year " +
              (filters.academic_year || "all years")
            : "Centralized institution, enrolment, validation and compliance overview."
        }
        actions={<Badge tone="teal">Live database · synthetic records</Badge>}
      />
      <div className="filter-toolbar" role="group" aria-label="Dashboard filters">
        <div>
          <Label htmlFor="dash-year">Academic year</Label>
          <select
            id="dash-year"
            className="input"
            value={filters.academic_year}
            onChange={(e) => change("academic_year", e.target.value)}
          >
            <option value="">All academic years</option>
            {data?.options.years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="dash-state">State / region</Label>
          <select
            id="dash-state"
            className="input"
            value={filters.region ? `region:${filters.region}` : filters.state}
            onChange={(e) =>
              setFilters({
                ...filters,
                state: e.target.value.startsWith("region:")
                  ? ""
                  : e.target.value,
                region: e.target.value.startsWith("region:")
                  ? e.target.value.slice(7)
                  : "",
              })
            }
          >
            <option value="">All authorized states</option>
            <optgroup label="States">
              {data?.options.states.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </optgroup>
            <optgroup label="Regions">
              {data?.options.regions.map((r) => (
                <option key={r} value={`region:${r}`}>
                  {r} region
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <Label htmlFor="dash-type">Institution type</Label>
          <select
            id="dash-type"
            className="input"
            value={filters.institution_type}
            onChange={(e) => change("institution_type", e.target.value)}
          >
            <option value="">All institution types</option>
            {data?.options.institution_types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="dash-programme">Programme</Label>
          <select
            id="dash-programme"
            className="input"
            value={filters.programme_id}
            onChange={(e) => change("programme_id", e.target.value)}
          >
            <option value="">All programmes</option>
            {data?.options.programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.institution} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-caption">
          <span>
            Filters apply to server queries, metrics, charts and review queue.
          </span>
          <button
            onClick={() =>
              setFilters({
                academic_year: "2025-26",
                state: "",
                region: "",
                institution_type: "",
                programme_id: "",
              })
            }
          >
            Reset filters
          </button>
        </div>
      </div>
      {query.error && (
        <div role="alert" className="error-panel">
          {query.error.message}
        </div>
      )}
      {!data ? (
        <div className="skeleton" aria-label="Loading dashboard" />
      ) : (
        <>
          <div className="metrics-grid metrics-six">
            {institution ? (
              <>
                <MetricCard
                  label="Approved regular intake"
                  value={m.regular_capacity}
                  icon={Building2}
                  href="/intakes"
                />
                <MetricCard
                  label="Counted regular admissions"
                  value={m.regular_enrolment}
                  icon={Users}
                  tone="teal"
                  href="/intakes"
                />
                <MetricCard
                  label="Seat utilization"
                  value={
                    m.regular_capacity
                      ? Math.round(
                          (m.regular_enrolment / m.regular_capacity) * 100,
                        )
                      : 0
                  }
                  hint="Percent of approved regular capacity"
                  icon={GraduationCap}
                />
                <MetricCard
                  label="Submitted records"
                  value={m.submitted_records}
                  icon={Database}
                  href="/enrolments"
                />
                <MetricCard
                  label="Records awaiting review"
                  value={m.pending_review}
                  hint={`${m.pending_review} enrolment records require review`}
                  icon={CircleAlert}
                  tone="amber"
                  href="/anomalies"
                />
                <MetricCard
                  label="Outstanding corrections"
                  value={m.open_corrections}
                  hint={`${m.open_corrections} correction requests require a decision`}
                  icon={ClipboardCheck}
                  href="/corrections"
                />
              </>
            ) : (
              <>
                <MetricCard
                  label="Registered Institutions"
                  value={m.institutions}
                  icon={Building2}
                  href="/institutions"
                />
                <MetricCard
                  label="Student Records"
                  value={m.student_records}
                  icon={Users}
                  tone="teal"
                  href="/students"
                />
                <MetricCard
                  label="Total Enrolments"
                  value={m.submitted_records}
                  icon={Database}
                  href="/enrolments"
                />
                <MetricCard
                  label="Pending Validation"
                  value={m.pending_review}
                  icon={ClipboardCheck}
                  tone="amber"
                  href="/anomalies"
                />
                <MetricCard
                  label="Compliance Findings"
                  value={m.unresolved_findings}
                  icon={CircleAlert}
                  tone="red"
                  href="/anomalies"
                />
                <MetricCard
                  label="Cross-Institution Conflicts"
                  value={m.cross_conflicts}
                  icon={Network}
                  tone="amber"
                  href="/anomalies?type=cross_institution_conflict"
                />
              </>
            )}
          </div>
          {institution && (
            <div className="filter-bar">
              <Link href="/manage" className="btn btn-primary btn-md">
                Add Student
              </Link>
              <Link href="/imports" className="btn btn-secondary btn-md">
                Upload Student Data
              </Link>
              <Link href="/enrolments" className="btn btn-secondary btn-md">
                View Enrolment Register
              </Link>
              <Link href="/anomalies" className="btn btn-secondary btn-md">
                Review Validation Results
              </Link>
              <Link href="/reports" className="btn btn-secondary btn-md">
                Download Reports
              </Link>
              {m.regular_excess > 0 && (
                <span className="badge badge-red">
                  Regular admissions exceed programme approvals by{" "}
                  {m.regular_excess}
                </span>
              )}
            </div>
          )}
          <div className="dashboard-grid">
            <Chart
              title="Approved intake vs actual enrolment"
              description="Highest excess first · up to six programme/year cohorts"
              summary={`Regular capacity ${m.regular_capacity.toLocaleString("en-IN")} · Counted ${m.regular_enrolment.toLocaleString("en-IN")} · Excess ${m.regular_excess}`}
            >
              <BarChart
                data={data.capacity
                  .slice(0, 6)
                  .map((r, i) => ({ ...r, label: `${i + 1}. ${r.programme}` }))}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 13 }} />
                <YAxis tick={{ fontSize: 13 }} />
                <Tooltip
                  labelFormatter={(_, payload) =>
                    payload[0]?.payload.institution ?? "Programme"
                  }
                />
                <Legend />
                <Bar
                  dataKey="regular_capacity"
                  name="Approved regular seats"
                  fill="var(--navy-900)"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="regular_enrolment"
                  name="Counted admissions"
                  fill="var(--teal-600)"
                  isAnimationActive={false}
                />
              </BarChart>
            </Chart>
            <Chart
              title="State-wise enrolment distribution"
              description="Authorized records in the selected academic context"
              summary={data.state_distribution
                .map((s) => `${s.state}: ${s.count}`)
                .join(" · ")}
            >
              <BarChart
                data={data.state_distribution}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 13 }} />
                <YAxis
                  dataKey="state"
                  type="category"
                  width={95}
                  tick={{ fontSize: 13 }}
                />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="Enrolments"
                  fill="var(--teal-600)"
                  isAnimationActive={false}
                />
              </BarChart>
            </Chart>
          </div>
          <WorkQueue items={data.work_queue} />
          <div className="dashboard-grid" style={{ marginTop: 16 }}>
            <Chart
              title="Academic-year submission trend"
              description="Select all academic years to compare cohorts"
              summary={data.enrolment_trend
                .map((r) => `${r.year}: ${r.count}`)
                .join(" · ")}
            >
              <AreaChart data={data.enrolment_trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 13 }} />
                <YAxis tick={{ fontSize: 13 }} />
                <Tooltip />
                <Area
                  dataKey="count"
                  name="Enrolments"
                  type="linear"
                  stroke="var(--navy-900)"
                  fill="var(--teal-light)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </Chart>
            <Card>
              <CardHeader>
                <CardTitle>
                  Institution compliance & identity provenance
                </CardTitle>
                <CardDescription>
                  Administrative findings are review signals. Provenance is
                  separate from official identity verification.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="check-row">
                  <span>Institutions with an unresolved finding</span>
                  <strong>
                    {
                      new Set(
                        data.work_queue
                          .filter(
                            (f) =>
                              ![
                                "resolve",
                                "resolved",
                                "mark_expected",
                                "reject_finding",
                              ].includes(f.review_state),
                          )
                          .map((f) => f.institution),
                      ).size
                    }{" "}
                    / {m.institutions}
                  </strong>
                </div>
                {data.verification_distribution.map((r) => (
                  <div className="check-row" key={r.status}>
                    <span>{r.status.replaceAll("_", " ")}</span>
                    <strong>{r.count.toLocaleString("en-IN")}</strong>
                  </div>
                ))}
                <p className="record-subtitle">
                  Official APAAR identity verification is unavailable.
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="dashboard-grid">
            <Card>
              <CardHeader>
                <CardTitle>Recent submissions</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recent_submissions.length ? (
                  data.recent_submissions.map((s) => (
                    <div key={s.id} className="check-row">
                      <span>
                        <strong>{s.filename}</strong>
                        <span className="table-secondary">
                          {parseTimestamp(s.created_at).toLocaleString("en-IN")}
                        </span>
                      </span>
                      <span>
                        {s.accepted} accepted · {s.rejected} rejected
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="empty-state">
                    No submitted files in this context.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Recent administrative activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="timeline">
                  {data.recent_activity.map((e) => (
                    <li key={e.id}>
                      <strong>{e.action.replaceAll(".", " · ")}</strong>
                      <div>{e.actor}</div>
                      <time>
                        {parseTimestamp(e.created_at).toLocaleString("en-IN")}
                      </time>
                    </li>
                  ))}
                </ol>
                {!data.recent_activity.length && (
                  <p>No recorded activity in this institution context.</p>
                )}
              </CardContent>
            </Card>
          </div>
          <p className="record-subtitle">
            Generated {parseTimestamp(data.generated_at).toLocaleString("en-IN")} ·
            All displayed figures are queried from the synthetic database.
          </p>
        </>
      )}
    </div>
  );
}
function Chart({
  title,
  description,
  summary,
  children,
}: {
  title: string;
  description: string;
  summary: string;
  children: React.ReactElement;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="chart-box"
          role="img"
          aria-label={`${title}. ${summary}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
        <details>
          <summary>View chart values</summary>
          <p className="record-subtitle">
            {summary || "No data in the selected context."}
          </p>
        </details>
      </CardContent>
    </Card>
  );
}
function StudentDashboard({ data }: { data: Base }) {
  return (
    <div className="page">
      <PageHeader
        title="My Academic Records"
        description="Your institution-linked identity, academic records and sharing permissions."
      />
      <StudentProfile />
      <div className="metrics-grid" style={{ marginTop: 20 }}>
        <MetricCard
          label="Linked enrolments"
          value={data.metrics.enrolments}
          icon={GraduationCap}
          href="/enrolments"
        />
        <MetricCard
          label="Available credentials"
          value={data.metrics.credentials}
          icon={ShieldCheck}
          tone="teal"
          href="/credentials"
        />
        <MetricCard
          label="Active sharing permissions"
          value={data.metrics.active_consents}
          icon={Network}
          href="/credentials"
        />
        <MetricCard
          label="Pending corrections"
          value={data.metrics.open_corrections}
          icon={CircleAlert}
          href="/corrections"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Institution enrolment</CardTitle>
        </CardHeader>
        <CardContent>
          {data.enrolments?.map((e) => (
            <div className="check-row" key={e.id}>
              <span>
                <strong>{e.programme}</strong>
                <span className="table-secondary">
                  {e.institution} · {e.academic_year}
                </span>
              </span>
              <Badge tone={statusTone(e.status)}>{e.status}</Badge>
            </div>
          ))}
          <div className="page-actions" style={{ marginTop: 20 }}>
            <Link href="/credentials" className="btn btn-primary btn-md">
              Open Credential Wallet
            </Link>
            <Link href="/corrections" className="btn btn-secondary btn-md">
              Request a correction
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
