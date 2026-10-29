"use client";

import {Search} from "lucide-react";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import type {ColumnDef} from "@tanstack/react-table";
import {api} from "@/lib/api";
import type {Paginated} from "@/lib/types";
import {DataTable} from "@/components/data-table";
import {Badge, statusTone} from "@/components/ui/badge";
import {Pagination} from "@/components/pagination";
import {Input} from "@/components/ui/input";

type Student={id:string;full_name:string;masked_apaar:string;verification_status:string;synthetic:boolean};
const columns:ColumnDef<Student>[]=[{header:"Student",cell:({row})=><><span className="table-primary">{row.original.full_name}</span><span className="table-secondary">Internal ID {row.original.id.slice(0,8)}</span></>},{header:"APAAR-linked ID",accessorKey:"masked_apaar"},{header:"Verification provenance",cell:({row})=><Badge tone={statusTone(row.original.verification_status)}>{row.original.verification_status}</Badge>},{header:"Dataset",cell:()=> <Badge tone="teal">Synthetic</Badge>}];
export default function StudentsPage(){const[search,setSearch]=useState("");const[page,setPage]=useState(1);const query=useQuery({queryKey:["students",search,page],queryFn:()=>api<Paginated<Student>>(`/students?q=${encodeURIComponent(search)}&page_size=50&page=${page}`)});return <div className="page"><div className="page-header"><div className="page-title"><h1>Student registry</h1><p>Masked identity views and institution-linked enrolments. Records are never merged solely on similar names.</p></div><a className="btn btn-primary btn-md" href="/manage">Add student</a></div><div className="filter-bar"><div style={{position:"relative"}}><Search size={15} style={{position:"absolute",left:12,top:14,color:"#6d7b90"}}/><Input style={{paddingLeft:34}} value={search} onChange={(e)=>(setSearch(e.target.value),setPage(1))} placeholder="Search fictional student name"/></div><Badge>{query.data?.total??0} records</Badge></div>{query.isLoading?<div className="skeleton"/>:query.error?<div className="error-panel">{query.error.message}</div>:<DataTable columns={columns} data={query.data?.items??[]}/>}<Pagination page={page} total={query.data?.total??0} onChange={setPage}/></div>}

