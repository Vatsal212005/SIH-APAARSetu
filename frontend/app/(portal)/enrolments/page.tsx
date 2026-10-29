"use client";
import {parseTimestamp} from "@/lib/utils";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import type { User, Paginated } from "@/lib/types";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { WorkflowForm } from "@/features/management";
import { PageHeader, EvidencePanel } from "@/components/portal";
import { AcademicYearSelector } from "@/components/academic-year-selector";
import { DataTable } from "@/components/data-table";
import { Pagination } from "@/components/pagination";
type Enrolment = {
  id: string;
  student: string;
  institution: string;
  programme: string;
  academic_year: string;
  status: string;
  seat_type: string;
  institution_student_id: string;
};
type Version = {
  id: string;
  reason: string;
  created_at: string;
  before: unknown;
  after: unknown;
};
export default function Enrolments() {
  const [selected, setSelected] = useState<Enrolment | null>(null),
    [q, setQ] = useState(""),
    [year, setYear] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [studentId, setStudentId] = useState("");
  useEffect(
    () =>
      setStudentId(
        new URLSearchParams(window.location.search).get("student_id") ?? "",
      ),
    [],
  );
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User }>("/auth/me"),
  });
  const student = me.data?.user.role === "student";
  const params = new URLSearchParams({
    q,
    academic_year: year,
    status,
    page: String(page),
    student_id: studentId,
  });
  const query = useQuery({
    queryKey: ["enrolment-register", student, params.toString()],
    enabled: !!me.data,
    queryFn: () =>
      api<Paginated<Enrolment>>(
        student ? "/enrolments" : "/workspace/enrolments?" + params,
      ),
  });
  const history = useQuery({
    queryKey: ["history", selected?.id],
    enabled: !!selected,
    queryFn: () =>
      api<{ items: Version[] }>(`/enrolments/${selected?.id}/history`),
  });
  const columns: ColumnDef<Enrolment>[] = [
    {
      header: "Student / institutional ID",
      accessorKey: "student",
      cell: ({ row }) => (
        <>
          <strong>{row.original.student}</strong>
          <span className="table-secondary">
            {row.original.institution_student_id}
          </span>
        </>
      ),
    },
    {
      header: "Institution / programme",
      accessorKey: "institution",
      cell: ({ row }) => (
        <>
          {row.original.institution}
          <span className="table-secondary">{row.original.programme}</span>
        </>
      ),
    },
    { header: "Academic year", accessorKey: "academic_year" },
    { header: "Seat category", accessorKey: "seat_type" },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => (
        <Badge tone={statusTone(row.original.status)}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      header: "Action",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setSelected(row.original)}
        >
          Open record
        </Button>
      ),
    },
  ];
  const editable = [
    "aicte_admin",
    "system_admin",
    "institution_admin",
    "institution_operator",
  ].includes(me.data?.user.role ?? "");
  return (
    <div className="page">
      <PageHeader
        title="Enrolment Register & Lifecycle"
        description="Review institution-attested records, permitted status changes and the versioned history of each amendment."
      />
      {!student && (
        <div className="filter-toolbar">
          <div>
            <Label htmlFor="enrolment-search">
              Search student or reference
            </Label>
            <Input
              id="enrolment-search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <AcademicYearSelector
            id="enrolment-year"
            all
            value={year}
            onChange={(v) => {
              setYear(v);
              setPage(1);
            }}
          />
          <div>
            <Label htmlFor="enrolment-status">Status</Label>
            <select
              id="enrolment-status"
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
                "completed",
                "withdrawn",
                "rejected",
                "submitted",
                "validation_pending",
                "draft",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      {query.error && <div className="error-panel">{query.error.message}</div>}
      {query.isLoading ? (
        <div className="skeleton" />
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.items ?? []}
          caption="Authorized enrolment register"
        />
      )}
      {!student && (
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      )}{" "}
      {selected && (
        <section
          style={{ marginTop: 24 }}
          aria-label="Selected enrolment record"
        >
          <h2>
            {selected.student} · {selected.institution_student_id}
          </h2>
          {editable && (
            <WorkflowForm
              key={selected.id}
              title="Update institutional enrolment"
              path={`/enrolments/${selected.id}`}
              method="PATCH"
              fields={[
                {
                  name: "status",
                  options: Array.from(
                    new Set([
                      selected.status,
                      "draft",
                      "submitted",
                      "validation_pending",
                      "flagged",
                      "accepted",
                      "enrolled",
                      "transferred",
                      "withdrawn",
                      "completed",
                      "rejected",
                    ]),
                  ).map((value) => ({ value, label: value })),
                },
                { name: "reason", label: "Reason and supporting evidence" },
                { name: "institution_student_id", required: false },
                {
                  name: "seat_type",
                  options: Array.from(
                    new Set([selected.seat_type, "regular", "supernumerary"]),
                  ).map((value) => ({ value, label: value })),
                },
              ]}
            />
          )}
          <h3>Record change history</h3>
          {history.error && (
            <div className="error-panel">{history.error.message}</div>
          )}
          <ol className="timeline">
            {history.data?.items.map((v) => (
              <li key={v.id}>
                <strong>{v.reason}</strong>
                <time>{parseTimestamp(v.created_at).toLocaleString("en-IN")}</time>
                <EvidencePanel
                  title="Compare before and after values"
                  value={{ before: v.before, after: v.after }}
                />
              </li>
            ))}
          </ol>
          {!history.data?.items.length && (
            <p>No versioned changes recorded for this enrolment.</p>
          )}
        </section>
      )}
    </div>
  );
}
