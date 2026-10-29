"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import type { Paginated, User } from "@/lib/types";
import { DataTable } from "@/components/data-table";
import { Badge, statusTone } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { Input, Label } from "@/components/ui/input";
import { AcademicYearSelector } from "@/components/academic-year-selector";
import { PageHeader } from "@/components/portal";
type Student = {
  id: string;
  full_name: string;
  masked_apaar: string;
  institution_student_id: string;
  institution: string;
  programme: string;
  academic_year: string;
  status: string;
  verification_status: string;
  corrections: number;
};
const columns: ColumnDef<Student>[] = [
  {
    header: "Student / institutional ID",
    accessorKey: "full_name",
    cell: ({ row }) => (
      <>
        <Link href={`/students/${row.original.id}`}>
          {row.original.full_name}
        </Link>
        <span className="table-secondary">
          {row.original.institution_student_id}
        </span>
      </>
    ),
  },
  { header: "Academic identifier", accessorKey: "masked_apaar" },
  {
    header: "Institution / programme",
    accessorKey: "institution",
    cell: ({ row }) => (
      <>
        {row.original.institution}
        <span className="table-secondary">
          {row.original.programme} · {row.original.academic_year}
        </span>
      </>
    ),
  },
  {
    header: "Enrolment",
    accessorKey: "status",
    cell: ({ row }) => (
      <Badge tone={statusTone(row.original.status)}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    header: "Verification provenance",
    accessorKey: "verification_status",
    cell: ({ row }) => (
      <Badge tone={statusTone(row.original.verification_status)}>
        {row.original.verification_status.replaceAll("_", " ")}
      </Badge>
    ),
  },
  {
    header: "Corrections",
    accessorKey: "corrections",
    cell: ({ row }) => (
      <>
        {row.original.corrections
          ? `${row.original.corrections} pending`
          : "None pending"}
      </>
    ),
  },
  {
    header: "Actions",
    cell: ({ row }) => (
      <Link href={`/students/${row.original.id}`}>View record →</Link>
    ),
  },
];
export default function StudentsPage() {
  const [q, setQ] = useState(""),
    [year, setYear] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User }>("/auth/me"),
  });
  const query = useQuery({
    queryKey: ["student-register", q, year, status, page],
    queryFn: () =>
      api<Paginated<Student>>(
        "/workspace/students?" +
          new URLSearchParams({
            q,
            academic_year: year,
            status,
            page: String(page),
          }),
      ),
  });
  return (
    <div className="page">
      <PageHeader
        title="Student Register"
        description="Masked student identities with their latest enrolment in the selected context. Open a record to see all authorized enrolments."
        actions={
          !["auditor", "regional_officer"].includes(
            me.data?.user.role ?? "",
          ) && (
            <Link
              className="btn btn-primary btn-md"
              href="/manage?task=student"
            >
              Add student
            </Link>
          )
        }
      />
      <div className="filter-toolbar">
        <div>
          <Label htmlFor="student-search">Search student</Label>
          <Input
            id="student-search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Fictional student name"
          />
        </div>
        <AcademicYearSelector
          id="student-year"
          all
          value={year}
          onChange={(v) => {
            setYear(v);
            setPage(1);
          }}
        />
        <div>
          <Label htmlFor="student-status">Enrolment status</Label>
          <select
            id="student-status"
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {[
              "enrolled",
              "accepted",
              "flagged",
              "transferred",
              "withdrawn",
              "completed",
              "rejected",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
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
          caption="Student register"
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
