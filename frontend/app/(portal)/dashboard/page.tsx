"use client";

import {Activity, Building2, CircleAlert, Database, GraduationCap, ShieldCheck, Users, Waypoints} from "lucide-react";
import {useQuery} from "@tanstack/react-query";
import {Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {api} from "@/lib/api";
import {MetricCard} from "@/components/metric-card";
import {Alert} from "@/components/ui/alert";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Badge, statusTone} from "@/components/ui/badge";
import {number} from "@/lib/utils";
import {VerifierEntry} from "@/features/verifier-entry";
import {StudentProfile} from "@/features/student-profile";

type Dashboard = {
  portal: string;
  metrics: Record<string, number>;
  enrolment_trend?: {year: string; count: number}[];
  region_distribution?: {region: string; count: number}[];
  recent_submissions?: {id: string; filename: string; accepted: number; rejected: number; created_at: string}[];
  enrolments?: {id: string; institution: string; programme: string; academic_year: string; status: string}[];
  official_verification_notice: string;
};

export default function DashboardPage() {
  const query = useQuery({queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard")});
  if (query.isLoading) return <div className="page"><div className="loading-grid">{[1,2,3,4].map((i) => <div className="skeleton" key={i}/>)}</div></div>;
  if (query.error || !query.data) return <div className="page"><div className="error-panel">{query.error instanceof Error ? query.error.message : "Unable to load dashboard."}</div></div>;
  const data = query.data;
  if (data.portal === "verifier") return <VerifierEntry/>;
  if (data.portal === "student") return <><StudentProfile/><StudentDashboard data={data}/></>;
  return <div className="page">
    <div className="page-header"><div className="page-title"><h1>{data.portal === "institution" ? "Institution operations" : "National enrolment command center"}</h1><p>Database-backed operational visibility across approved intake, student submissions, verification status and review queues.</p></div><div className="page-actions"><Badge tone="teal">Live database state</Badge></div></div>
    <div className="notice-bar"><ShieldCheck size={16}/>{data.official_verification_notice}</div>
    <div className="metrics-grid">
      <MetricCard label="Institutions" value={data.metrics.institutions} icon={Building2}/>
      <MetricCard label="Student records" value={data.metrics.student_records} icon={Users} tone="teal"/>
      <MetricCard label="Submitted records" value={data.metrics.submitted_records} icon={Database}/>
      <MetricCard label="Unresolved findings" value={data.metrics.unresolved_findings} icon={CircleAlert} tone="red"/>
      <MetricCard label="Pending review" value={data.metrics.pending_review} icon={Activity} tone="amber"/>
      <MetricCard label="NRI admissions" value={data.metrics.nri_admissions} icon={GraduationCap}/>
      <MetricCard label="OCI status" value={data.metrics.oci_students} icon={Waypoints} tone="teal"/>
      <MetricCard label="Foreign nationals" value={data.metrics.foreign_national_students} icon={ShieldCheck}/>
    </div>
    <div className="dashboard-grid">
      <Card><CardHeader><CardTitle>Enrolment trend</CardTitle><CardDescription>Accepted, enrolled, flagged and completed records by academic year.</CardDescription></CardHeader><CardContent><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.enrolment_trend}><defs><linearGradient id="enrolment" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2175a6" stopOpacity={.28}/><stop offset="95%" stopColor="#2175a6" stopOpacity={.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e7edf1"/><XAxis dataKey="year" tick={{fontSize: 11}}/><YAxis tick={{fontSize: 11}}/><Tooltip/><Area type="monotone" dataKey="count" stroke="#1c678f" strokeWidth={2} fill="url(#enrolment)"/></AreaChart></ResponsiveContainer></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Region distribution</CardTitle><CardDescription>Student enrolment across AICTE demonstration regions.</CardDescription></CardHeader><CardContent><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={data.region_distribution} margin={{left: 15}}><CartesianGrid strokeDasharray="3 3" stroke="#e7edf1"/><XAxis type="number" tick={{fontSize: 10}}/><YAxis type="category" dataKey="region" width={72} tick={{fontSize: 10}}/><Tooltip/><Bar dataKey="count" fill="#168b81" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div></CardContent></Card>
    </div>
    <Card style={{marginTop: 16}}><CardHeader><CardTitle>Recent submissions</CardTitle><CardDescription>Latest file-level ingestion activity from the persistent import ledger.</CardDescription></CardHeader><CardContent>{data.recent_submissions?.length ? <div className="grid-list">{data.recent_submissions.map((item) => <div className="check-row" key={item.id}><span><strong>{item.filename}</strong><span className="table-secondary">{new Date(item.created_at).toLocaleString("en-IN")}</span></span><span>{number(item.accepted)} accepted · <span style={{color: item.rejected ? "#b42318" : undefined}}>{number(item.rejected)} rejected</span></span></div>)}</div> : <div className="empty-state">No recent upload batches. Seed records were created directly through the deterministic generator.</div>}</CardContent></Card>
  </div>;
}

function StudentDashboard({data}: {data: Dashboard}) {
  return <div className="page"><div className="page-header"><div className="page-title"><h1>My academic record</h1><p>Review linked enrolments, provenance, correction activity and credentials without changing institution-attested fields.</p></div></div><Alert title="Verification boundary">{data.official_verification_notice} A valid APAARSetu signature proves only that this demonstration issuer signed the displayed credential.</Alert><div className="metrics-grid" style={{marginTop: 18}}><MetricCard label="Linked enrolments" value={data.metrics.enrolments} icon={GraduationCap}/><MetricCard label="Credentials" value={data.metrics.credentials} icon={ShieldCheck} tone="teal"/><MetricCard label="Active consents" value={data.metrics.active_consents} icon={Waypoints}/><MetricCard label="Open corrections" value={data.metrics.open_corrections} icon={CircleAlert} tone="amber"/></div><Card><CardHeader><CardTitle>Institution-linked enrolments</CardTitle><CardDescription>These values are institution-attested and cannot be directly edited by the student.</CardDescription></CardHeader><CardContent><div className="grid-list">{data.enrolments?.map((item) => <div className="check-row" key={item.id}><span><strong>{item.programme}</strong><span className="table-secondary">{item.institution} · {item.academic_year}</span></span><Badge tone={statusTone(item.status)}>{item.status}</Badge></div>)}</div></CardContent></Card></div>;
}

