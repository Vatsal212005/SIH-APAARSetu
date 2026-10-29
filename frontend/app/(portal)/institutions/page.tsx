"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import type { User, Paginated } from "@/lib/types";
import { DataTable } from "@/components/data-table";
import { Badge, statusTone } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/portal";
type Institution = {
  id: string;
  permanent_id: string;
  name: string;
  institution_type: string;
  state: string;
  region: string;
  approval_status: string;
  enrolments: number;
  findings: number;
};
const columns: ColumnDef<Institution>[] = [
  { header: "Institution ID", accessorKey: "permanent_id" },
  {
    header: "Institution name",
    accessorKey: "name",
    cell: ({ row }) => (
      <Link href={`/institutions/${row.original.id}`}>{row.original.name}</Link>
    ),
  },
  {
    header: "State / region",
    accessorKey: "state",
    cell: ({ row }) => (
      <>
        {row.original.state}
        <span className="table-secondary">{row.original.region}</span>
      </>
    ),
  },
  { header: "Type", accessorKey: "institution_type" },
  {
    header: "Approval status",
    accessorKey: "approval_status",
    cell: ({ row }) => (
      <Badge tone={statusTone(row.original.approval_status)}>
        {row.original.approval_status}
      </Badge>
    ),
  },
  { header: "Enrolment", accessorKey: "enrolments" },
  {
    header: "Compliance",
    accessorKey: "findings",
    cell: ({ row }) => (
      <Badge tone={row.original.findings ? "amber" : "green"}>
        {row.original.findings
          ? `${row.original.findings} findings to review`
          : "No unresolved findings"}
      </Badge>
    ),
  },
  {
    header: "Actions",
    cell: ({ row }) => (
      <Link href={`/institutions/${row.original.id}`}>View case file →</Link>
    ),
  },
];
export default function InstitutionsPage() {
  const [filters, setFilters] = useState({
      q: "",
      state: "",
      region: "",
      institution_type: "",
      approval_status: "",
      academic_year: "2025-26",
    }),
    [page, setPage] = useState(1);
  const params = new URLSearchParams({ ...filters, page: String(page) });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User }>("/auth/me"),
  });
  const options = useQuery({
    queryKey: ["registry-options"],
    queryFn: () =>
      api<{
        options: {
          states: string[];
          regions: string[];
          institution_types: string[];
          years: string[];
        };
      }>("/workspace/overview?academic_year=2025-26"),
  });
  const query = useQuery({
    queryKey: ["institution-register", filters, page],
    queryFn: () =>
      api<Paginated<Institution>>("/workspace/institutions?" + params),
  });
  const change = (k: string, v: string) => {
    setFilters({ ...filters, [k]: v });
    setPage(1);
  };
  return (
    <div className="page">
      <PageHeader
        title="Institution Registry"
        description="Institution profiles, approval context and academic-year enrolment compliance."
        actions={
          <>
            <Link href="/reports" className="btn btn-secondary btn-md">
              Export authorized reports
            </Link>
            {["aicte_admin", "system_admin"].includes(
              me.data?.user.role ?? "",
            ) && (
              <Link
                href="/manage?task=institution"
                className="btn btn-primary btn-md"
              >
                Register institution
              </Link>
            )}
          </>
        }
      />
      <div className="filter-toolbar">
        <div>
          <Label htmlFor="institution-search">Search institution</Label>
          <Input
            id="institution-search"
            value={filters.q}
            onChange={(e) => change("q", e.target.value)}
            placeholder="Name or permanent ID"
          />
        </div>
        {(
          [
            {
              key: "state",
              title: "State",
              items: options.data?.options.states,
            },
            {
              key: "region",
              title: "Region",
              items: options.data?.options.regions,
            },
            {
              key: "institution_type",
              title: "Institution type",
              items: options.data?.options.institution_types,
            },
            {
              key: "approval_status",
              title: "Approval status",
              items: ["approved", "pending", "suspended"],
            },
            {
              key: "academic_year",
              title: "Academic year",
              items: options.data?.options.years,
            },
          ] as const
        ).map((f) => (
          <div key={f.key}>
            <Label htmlFor={`registry-${f.key}`}>{f.title}</Label>
            <select
              id={`registry-${f.key}`}
              className="input"
              value={filters[f.key]}
              onChange={(e) => change(f.key, e.target.value)}
            >
              {f.key !== "academic_year" && <option value="">All</option>}
              {f.items?.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <p className="record-subtitle">
        {query.data?.total ?? "…"} authorized institutions · Academic year{" "}
        {filters.academic_year}
      </p>
      {query.isLoading ? (
        <div className="skeleton" />
      ) : query.error ? (
        <div role="alert" className="error-panel">
          {query.error.message}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.items ?? []}
          caption="Institution registry"
        />
      )}
      <Pagination
        page={page}
        total={query.data?.total ?? 0}
        onChange={setPage}
      />
    </div>
  );
}
