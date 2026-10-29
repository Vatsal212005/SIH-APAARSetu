"use client";

import {ArrowLeft, Building2, CircleAlert, GraduationCap} from "lucide-react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {api} from "@/lib/api";
import {Badge, statusTone} from "@/components/ui/badge";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {MetricCard} from "@/components/metric-card";

type Detail = {institution: Record<string,string>; programmes: {id:string;code:string;name:string;specialization:string}[]; intakes: {id:string;programme_id:string;academic_year:string;regular_capacity:number;supernumerary_capacity:number;approval_status:string}[]; findings:number; enrolments:number};
export default function InstitutionDetailPage() {
  const {id} = useParams<{id: string}>();
  const query = useQuery({queryKey:["institution",id], queryFn:()=>api<Detail>(`/institutions/${id}`)});
  if (query.isLoading) return <div className="page"><div className="skeleton"/></div>;
  if (!query.data) return <div className="page"><div className="error-panel">{query.error?.message ?? "Institution not found"}</div></div>;
  const {institution,programmes,intakes}=query.data;
  return <div className="page"><div className="page-header"><div className="page-title"><Link href="/institutions" style={{display:"inline-flex",gap:6,alignItems:"center",fontSize:12,color:"#6d7b90",marginBottom:10}}><ArrowLeft size={14}/> Institution registry</Link><h1>{institution.name}</h1><p>{institution.permanent_id} · {institution.city}, {institution.state} · {institution.region} region</p></div><Badge tone={statusTone(institution.approval_status)}>{institution.approval_status}</Badge></div><div className="metrics-grid"><MetricCard label="Programmes" value={programmes.length} icon={GraduationCap}/><MetricCard label="Enrolment records" value={query.data.enrolments} icon={Building2} tone="teal"/><MetricCard label="Open findings" value={query.data.findings} icon={CircleAlert} tone={query.data.findings?"red":"navy"}/></div><div className="detail-grid"><Card><CardHeader><CardTitle>Operational profile</CardTitle><CardDescription>Consolidated synthetic institution record.</CardDescription></CardHeader><CardContent><div className="key-values">{["institution_type","address","city","state","region","contact_email"].map((key)=><div className="key-value" key={key}><span>{key.replaceAll("_"," ")}</span><strong>{institution[key]}</strong></div>)}</div></CardContent></Card><Card><CardHeader><CardTitle>Programme registry</CardTitle></CardHeader><CardContent><div className="grid-list">{programmes.map((p)=><div className="check-row" key={p.id}><span><strong>{p.name}</strong><span className="table-secondary">{p.specialization}</span></span><Badge>{p.code}</Badge></div>)}</div></CardContent></Card></div><Card style={{marginTop:16}}><CardHeader><CardTitle>Approved intake history</CardTitle><CardDescription>Central demonstration approvals cannot be overwritten by institution operators.</CardDescription></CardHeader><CardContent><div className="grid-list">{intakes.map((item)=><div className="check-row" key={item.id}><span><strong>{programmes.find((p)=>p.id===item.programme_id)?.specialization}</strong><span className="table-secondary">{item.academic_year} · Regular {item.regular_capacity} · Supernumerary {item.supernumerary_capacity}</span></span><Badge tone="green">{item.approval_status}</Badge></div>)}</div></CardContent></Card></div>;
}

