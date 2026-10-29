"use client";

import {useQuery} from "@tanstack/react-query";
import type {ColumnDef} from "@tanstack/react-table";
import {api} from "@/lib/api";
import {DataTable} from "@/components/data-table";
import {Badge} from "@/components/ui/badge";
import {Alert} from "@/components/ui/alert";

type Intake = {id:string;institution:string;programme:string;academic_year:string;regular_capacity:number;regular_enrolment:number;regular_utilization:number;regular_excess:number;supernumerary_capacity:number;supernumerary_enrolment:number;approval_status:string;policy_reference:string};
const columns:ColumnDef<Intake>[]=[
  {header:"Institution & programme",cell:({row})=><><span className="table-primary">{row.original.institution}</span><span className="table-secondary">{row.original.programme}</span></>},
  {header:"Academic year",accessorKey:"academic_year"},
  {header:"Regular",cell:({row})=><><strong>{row.original.regular_enrolment} / {row.original.regular_capacity}</strong><span className="table-secondary">{row.original.regular_utilization}% utilized</span></>},
  {header:"Supernumerary",cell:({row})=><>{row.original.supernumerary_enrolment} / {row.original.supernumerary_capacity}</>},
  {header:"Compliance",cell:({row})=>row.original.regular_excess?<Badge tone="red">Excess {row.original.regular_excess}</Badge>:<Badge tone="green">Within capacity</Badge>},
  {header:"Policy",cell:({row})=><span style={{fontFamily:"monospace",fontSize:10}}>{row.original.policy_reference}</span>},
];
export default function IntakesPage(){const query=useQuery({queryKey:["intakes"],queryFn:()=>api<{items:Intake[]}>("/intakes?academic_year=2025-26")});return <div className="page"><div className="page-header"><div className="page-title"><h1>Programme & intake compliance</h1><p>Explainable separation of regular, supernumerary and category-specific enrolments against centrally authorized demonstration capacity.</p></div></div><Alert title="Category treatment" tone="info">NRI admission category, OCI status and Foreign National status remain independent attributes. Regular and authorized supernumerary seats are counted separately by policy.</Alert><div style={{marginTop:16}}>{query.isLoading?<div className="skeleton"/>:query.error?<div className="error-panel">{query.error.message}</div>:<DataTable columns={columns} data={query.data?.items??[]}/>}</div></div>}

