"use client";

import {Search} from "lucide-react";
import Link from "next/link";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import type {ColumnDef} from "@tanstack/react-table";
import {api} from "@/lib/api";
import type {Paginated} from "@/lib/types";
import {DataTable} from "@/components/data-table";
import {Badge, statusTone} from "@/components/ui/badge";
import {Pagination} from "@/components/pagination";
import {Input} from "@/components/ui/input";

type Institution = {id: string; permanent_id: string; name: string; institution_type: string; city: string; state: string; region: string; approval_status: string; synthetic: boolean};
const columns: ColumnDef<Institution>[] = [
  {header: "Institution", cell: ({row}) => <Link href={`/institutions/${row.original.id}`}><span className="table-primary">{row.original.name}</span><span className="table-secondary">{row.original.permanent_id}</span></Link>},
  {header: "Type", accessorKey: "institution_type"}, {header: "Location", cell: ({row}) => <>{row.original.city}, {row.original.state}<span className="table-secondary">{row.original.region} region</span></>},
  {header: "Approval", cell: ({row}) => <Badge tone={statusTone(row.original.approval_status)}>{row.original.approval_status}</Badge>},
  {header: "Provenance", cell: () => <Badge tone="teal">Synthetic</Badge>},
];

export default function InstitutionsPage() {
  const [search, setSearch] = useState("");
  const [page,setPage] = useState(1);
  const query = useQuery({queryKey: ["institutions", search,page], queryFn: () => api<Paginated<Institution>>(`/institutions?q=${encodeURIComponent(search)}&page_size=50&page=${page}`)});
  return <div className="page"><div className="page-header"><div className="page-title"><h1>Institution registry</h1><p>Approved technical institutions, programme coverage, enrolment totals and compliance history.</p></div><a className="btn btn-secondary btn-md" href="/reports">Export authorized view</a></div><div className="filter-bar"><div style={{position:"relative"}}><Search size={15} style={{position:"absolute", left:12, top:14, color:"#6d7b90"}}/><Input value={search} onChange={(e) => (setSearch(e.target.value),setPage(1))} placeholder="Search institution or permanent ID" style={{paddingLeft:34}}/></div><Badge tone="slate">{query.data?.total ?? 0} institutions</Badge></div>{query.isLoading ? <div className="skeleton"/> : query.error ? <div className="error-panel">{query.error.message}</div> : <DataTable columns={columns} data={query.data?.items ?? []}/>}<Pagination page={page} total={query.data?.total??0} onChange={setPage}/></div>;
}

