"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { AcademicYearSelector } from "@/components/academic-year-selector";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { api, downloadUrl } from "@/lib/api";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { Building2, GraduationCap, CircleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { ReportCatalog } from "@/features/report-catalog";
type Row = {
  institution: string;
  state: string;
  region: string;
  programme: string;
  regular_capacity: number;
  supernumerary_capacity: number;
  regular_enrolment: number;
  supernumerary_enrolment: number;
  nri: number;
  oci: number;
  foreign_national: number;
  regular_excess: number;
};
type Report = {
  academic_year: string;
  synthetic: boolean;
  items: Row[];
  totals: Record<string, number>;
};
const columns: ColumnDef<Row>[] = [
  {
    header: "Institution / programme",
    cell: ({ row }) => (
      <>
        <span className="table-primary">{row.original.institution}</span>
        <span className="table-secondary">{row.original.programme}</span>
      </>
    ),
  },
  {
    header: "Region",
    cell: ({ row }) => (
      <>
        {row.original.state}
        <span className="table-secondary">{row.original.region}</span>
      </>
    ),
  },
  {
    header: "Regular",
    cell: ({ row }) => (
      <>
        {row.original.regular_enrolment} / {row.original.regular_capacity}
      </>
    ),
  },
  {
    header: "Supernumerary",
    cell: ({ row }) => (
      <>
        {row.original.supernumerary_enrolment} /{" "}
        {row.original.supernumerary_capacity}
      </>
    ),
  },
  {
    header: "NRI / OCI / FN",
    cell: ({ row }) => (
      <>
        {row.original.nri} / {row.original.oci} /{" "}
        {row.original.foreign_national}
      </>
    ),
  },
  {
    header: "Excess",
    cell: ({ row }) =>
      row.original.regular_excess ? (
        <Badge tone="red">{row.original.regular_excess}</Badge>
      ) : (
        <Badge tone="green">0</Badge>
      ),
  },
];
export default function ReportsPage() {
  const [year, setYear] = useState("2025-26");
  const query = useQuery({
    queryKey: ["report", year],
    queryFn: () => api<Report>(`/reports/summary?academic_year=${year}`),
  });
  const t = query.data?.totals ?? {};
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Reports & Regulatory Analytics</h1>
          <p>
            Authorized, query-backed summaries reconcile to underlying enrolment
            and centrally approved intake records.
          </p>
        </div>
        <div className="page-actions">
          <a
            className="btn btn-secondary btn-md"
            href={downloadUrl(`/reports/enrolment.csv?academic_year=${year}`)}
          >
            <FileSpreadsheet size={15} /> CSV
          </a>
          <a
            className="btn btn-secondary btn-md"
            href={downloadUrl(`/reports/enrolment.pdf?academic_year=${year}`)}
          >
            <FileText size={15} /> PDF
          </a>
        </div>
      </div>
      <ReportCatalog />
      <details style={{ marginTop: 24 }}>
        <summary>Full academic-year intake reconciliation</summary>
        <AcademicYearSelector
          id="reconciliation-year"
          value={year}
          onChange={setYear}
        />
        <div className="metrics-grid" style={{ marginTop: 20 }}>
          <MetricCard
            label="Regular capacity"
            value={t.regular_capacity}
            icon={Building2}
          />
          <MetricCard
            label="Regular enrolled"
            value={t.regular_enrolment}
            icon={Users}
            tone="teal"
          />
          <MetricCard
            label="Supernumerary"
            value={t.supernumerary_enrolment}
            icon={GraduationCap}
          />
          <MetricCard
            label="Excess admissions"
            value={t.regular_excess}
            icon={CircleAlert}
            tone="red"
          />
        </div>
        {query.isLoading ? (
          <div className="skeleton" />
        ) : query.error ? (
          <div className="error-panel">{query.error.message}</div>
        ) : (
          <DataTable
            columns={columns}
            data={query.data?.items ?? []}
            caption="Full intake reconciliation"
            pageSize={25}
          />
        )}
      </details>
    </div>
  );
}
