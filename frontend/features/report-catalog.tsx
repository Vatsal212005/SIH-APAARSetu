"use client";
import {parseTimestamp} from "@/lib/utils";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, downloadUrl } from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { AcademicYearSelector } from "@/components/academic-year-selector";
import { RecordTable } from "@/components/record-table";
const groups: Record<string, string[]> = {
  "Institution reports": ["institution-enrolment", "submission-compliance"],
  "Enrolment reports": [
    "year-trends",
    "region-enrolment",
    "state-enrolment",
    "nri-admissions",
    "oci-fn-status",
  ],
  "Intake compliance": [
    "programme-intake",
    "supernumerary",
    "intake-discrepancies",
  ],
  "APAAR validation": ["identity-errors", "duplicate-submissions"],
  "Cross-institution findings": [
    "cross-conflicts",
    "pending-reviews",
    "correction-history",
  ],
  "Verification & consent": [
    "credential-activity",
    "consent-activity",
    "operational-period",
  ],
};
const periodKinds = [
  "submission-compliance",
  "operational-period",
  "correction-history",
  "credential-activity",
  "consent-activity",
];
export function ReportCatalog() {
  const [group, setGroup] = useState("Institution reports"),
    [kind, setKind] = useState("institution-enrolment"),
    [year, setYear] = useState("2025-26"),
    [state, setState] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const params = new URLSearchParams({ kind, academic_year: year });
  if (state) params.set("state", state);
  if (periodKinds.includes(kind)) {
    if (start) params.set("start", start);
    if (end) params.set("end", end);
  }
  const catalog = useQuery({
    queryKey: ["report-catalog"],
    queryFn: () =>
      api<{ items: { id: string; title: string }[] }>("/reports/catalog"),
  });
  const query = useQuery({
    queryKey: ["analysis", params.toString()],
    queryFn: () =>
      api<{ items: Record<string, string | number>[] }>(
        "/reports/analysis?" + params,
      ),
  });
  const title =
    catalog.data?.items.find((r) => r.id === kind)?.title ??
    "Regulatory report";
  return (
    <section aria-labelledby="report-catalog-title">
      <h2 id="report-catalog-title">Report catalogue</h2>
      <div
        className="report-groups"
        role="group"
        aria-label="Report categories"
      >
        {Object.keys(groups).map((g) => (
          <button
            key={g}
            aria-pressed={group === g}
            onClick={() => {
              setGroup(g);
              setKind(groups[g][0]);
            }}
          >
            {g}
          </button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Authorized database aggregates for the selected report and academic
            context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="filter-toolbar">
            <div>
              <Label htmlFor="report-kind">Report</Label>
              <select
                id="report-kind"
                className="input"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {catalog.data?.items
                  .filter((r) => groups[group].includes(r.id))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
              </select>
            </div>
            <AcademicYearSelector
              id="report-year"
              value={year}
              onChange={setYear}
            />
            <div>
              <Label htmlFor="report-state">State filter</Label>
              <Input
                id="report-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="All authorized states"
              />
            </div>
            {periodKinds.includes(kind) && (
              <>
                <div>
                  <Label htmlFor="report-start">From date</Label>
                  <Input
                    id="report-start"
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="report-end">Through date</Label>
                  <Input
                    id="report-end"
                    type="date"
                    min={start || undefined}
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <div className="filter-bar">
            <a
              className="btn btn-secondary btn-md"
              href={downloadUrl("/reports/analysis?" + params + "&format=csv")}
            >
              Export selected CSV
            </a>
            <a
              className="btn btn-secondary btn-md"
              href={downloadUrl("/reports/analysis?" + params + "&format=pdf")}
            >
              Export selected PDF
            </a>
            <span className="badge badge-teal">
              {query.data?.items.length ?? "…"} result groups
            </span>
          </div>
          <p className="record-subtitle">
            Applied filters: {year} · {state || "All authorized states"}
            {periodKinds.includes(kind)
              ? ` · ${start || "Any start date"} → ${end || "Any end date"}`
              : " · Academic-year snapshot"}
            .{" "}
            {query.data &&
              `Generated ${parseTimestamp(query.dataUpdatedAt).toLocaleString("en-IN")}`}
          </p>
          {catalog.error && (
            <div className="error-panel">{catalog.error.message}</div>
          )}
          {query.isLoading ? (
            <div className="skeleton" />
          ) : query.error ? (
            <div role="alert" className="error-panel">
              {query.error.message}
            </div>
          ) : (
            <RecordTable
              rows={query.data?.items ?? []}
              fields={Object.keys(
                query.data?.items[0] ?? { group: 0, count: 0 },
              )}
              caption={title}
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
