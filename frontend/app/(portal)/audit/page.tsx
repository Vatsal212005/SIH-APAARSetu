"use client";

import {useQuery} from "@tanstack/react-query";
import type {ColumnDef} from "@tanstack/react-table";
import {api} from "@/lib/api";
import {DataTable} from "@/components/data-table";
import {Badge} from "@/components/ui/badge";
import {dateTime} from "@/lib/utils";

type Audit={id:string;action:string;entity_type:string;entity_id:string|null;metadata:Record<string,unknown>;created_at:string};
const columns:ColumnDef<Audit>[]=[{header:"Timestamp",cell:({row})=>dateTime(row.original.created_at)},{header:"Action",cell:({row})=><Badge tone="blue">{row.original.action}</Badge>},{header:"Entity",cell:({row})=><>{row.original.entity_type}<span className="table-secondary">{row.original.entity_id??"—"}</span></>},{header:"Evidence",cell:({row})=><code style={{fontSize:10}}>{JSON.stringify(row.original.metadata).slice(0,120)}</code>}];
export default function AuditPage(){const query=useQuery({queryKey:["audit"],queryFn:()=>api<{items:Audit[]}>("/audit")});return <div className="page"><div className="page-header"><div className="page-title"><h1>Activity audit trail</h1><p>Authentication, submissions, findings, decisions, consent and verification actions are persisted with actor and scope.</p></div></div>{query.isLoading?<div className="skeleton"/>:query.error?<div className="error-panel">{query.error.message}</div>:<DataTable columns={columns} data={query.data?.items??[]}/>}</div>}

