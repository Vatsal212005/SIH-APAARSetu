"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, downloadUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader, UploadStepper } from "@/components/portal";
import { AcademicYearSelector } from "@/components/academic-year-selector";
type Programme = {
  id: string;
  institution_id: string;
  institution: string;
  specialization: string;
};
type Result = {
  preview?: boolean;
  batch_id?: string;
  columns?: string[];
  missing_columns?: string[];
  total_rows?: number;
  counts: Record<string, number>;
  rows: {
    row_number: number;
    data: Record<string, string>;
    result: string;
    errors: string[];
  }[];
};
const supported = [
  "apaar_id",
  "full_name",
  "institution_student_id",
  "admission_date",
  "date_of_birth",
  "seat_type",
  "nri_category",
  "oci_status",
  "foreign_national",
];
const maxUploadMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 10);
export default function Imports() {
  const client = useQueryClient();
  const [file, setFile] = useState<File | null>(null),
    [institution, setInstitution] = useState(""),
    [selected, setSelected] = useState(""),
    [year, setYear] = useState("2025-26"),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [result, setResult] = useState<Result | null>(null),
    [ack, setAck] = useState(false);
  const programmes = useQuery({
    queryKey: ["programmes"],
    queryFn: () => api<{ items: Programme[] }>("/programmes"),
  });
  const history = useQuery({
    queryKey: ["imports"],
    queryFn: () =>
      api<{
        items: {
          id: string;
          filename: string;
          accepted: number;
          rejected: number;
        }[];
      }>("/imports"),
  });
  const intake = useQuery({
    queryKey: ["import-impact", selected, year, result?.batch_id],
    enabled: !!selected,
    queryFn: () =>
      api<{
        metrics: {
          regular_capacity: number;
          regular_enrolment: number;
          regular_excess: number;
        };
      }>(`/workspace/overview?academic_year=${year}&programme_id=${selected}`),
  });
  const institutions = Array.from(
    new Map(
      programmes.data?.items.map((p) => [
        p.institution_id,
        { id: p.institution_id, name: p.institution },
      ]),
    ).values(),
  );
  const mutation = useMutation({
    mutationFn: (preview: boolean) => {
      const p = programmes.data?.items.find((p) => p.id === selected);
      if (!file || !p) throw new Error("Choose a programme and file.");
      if (file.size > maxUploadMb * 1024 * 1024)
        throw new Error(`File exceeds the ${maxUploadMb} MB limit.`);
      const body = new FormData();
      body.append("file", file);
      body.append("institution_id", p.institution_id);
      body.append("programme_id", p.id);
      body.append("academic_year", year);
      body.append("mapping", JSON.stringify(mapping));
      body.append("preview", String(preview));
      return api<Result>("/imports", { method: "POST", body });
    },
    onSuccess: (value) => {
      setResult(value);
      setAck(false);
      client.invalidateQueries();
    },
  });
  function chooseFile(value: File | null) {
    setFile(value);
    setResult(null);
    setMapping({});
    setAck(false);
  }
  const step = result?.batch_id
    ? 7
    : result?.preview && !result.missing_columns?.length
      ? 6
      : result?.columns
        ? 3
        : file
          ? 3
          : selected
            ? 2
            : 1;
  return (
    <div className="page">
      <PageHeader
        title="Student Data Submission"
        description="Select the academic context, inspect the file, map fields and review validation before storing accepted records."
        actions={
          <a
            className="btn btn-secondary btn-md"
            href="/student-import-mixed.csv"
            download
          >
            Download sample CSV
          </a>
        }
      />
      <UploadStepper step={step} />
      {programmes.error && (
        <Alert tone="danger" title="Programme list unavailable">
          {programmes.error.message}
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>1. Academic context & 2. Upload file</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="key-values">
            <div>
              <Label htmlFor="upload-institution">Institution</Label>
              <select
                id="upload-institution"
                className="input"
                value={institution}
                onChange={(e) => {
                  setInstitution(e.target.value);
                  setSelected("");
                  setResult(null);
                }}
              >
                <option value="">All institutions in your scope</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <AcademicYearSelector
              id="year"
              value={year}
              onChange={(v) => {
                setYear(v);
                setResult(null);
              }}
            />
            <div style={{ gridColumn: "1/-1" }}>
              <Label htmlFor="programme">Programme</Label>
              <select
                id="programme"
                className="input"
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setResult(null);
                  setAck(false);
                }}
              >
                <option value="">Select programme</option>
                {programmes.data?.items
                  .filter(
                    (p) => !institution || p.institution_id === institution,
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.institution} — {p.specialization}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div
            className="upload-zone"
            style={{ marginTop: 20 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              chooseFile(e.dataTransfer.files[0] ?? null);
            }}
          >
            <Label htmlFor="upload">
              CSV/XLSX file (up to {maxUploadMb} MB)
            </Label>
            <p className="record-subtitle">
              Drop a file here or use the standard file picker. Up to 10,000
              rows; preview shows the first 200.
            </p>
            <input
              id="upload"
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p>
                <strong>{file.name}</strong> · {(file.size / 1024).toFixed(1)}{" "}
                KB
              </p>
            )}
          </div>
          {mutation.error && (
            <Alert title="Import error" tone="danger">
              {mutation.error.message}
            </Alert>
          )}
          <div className="page-actions" style={{ marginTop: 16 }}>
            <Button
              disabled={!selected || !file || mutation.isPending}
              onClick={() => mutation.mutate(true)}
            >
              {mutation.isPending ? "Processing file…" : "Preview and validate"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {result && (
        <Card style={{ marginTop: 20 }}>
          <CardHeader>
            <CardTitle>
              {result.preview
                ? "Validation preview — no records committed"
                : "Persisted submission receipt"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.columns && (
              <details open={!!result.missing_columns?.length}>
                <summary>3. Column mapping</summary>
                <p className="record-subtitle">
                  Map each source column to its intended field, then revalidate
                  the file.
                </p>
                <div className="key-values">
                  {result.columns.map((column, i) => (
                    <div key={column}>
                      <Label htmlFor={`column-${i}`}>{column}</Label>
                      <select
                        id={`column-${i}`}
                        className="input"
                        value={
                          mapping[column] ??
                          (supported.includes(column) ? column : "")
                        }
                        onChange={(e) => {
                          setMapping({ ...mapping, [column]: e.target.value });
                          setResult({
                            ...result,
                            missing_columns: [
                              "Revalidate after mapping change",
                            ],
                          });
                          setAck(false);
                        }}
                      >
                        <option value="">Ignore</option>
                        {supported.map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  style={{ marginTop: 16 }}
                  onClick={() => mutation.mutate(true)}
                  disabled={mutation.isPending}
                >
                  Revalidate mapping
                </Button>
              </details>
            )}
            {!!result.missing_columns?.length && (
              <Alert title="Columns need mapping" tone="warning">
                {result.missing_columns.join(", ")}
              </Alert>
            )}
            <h3>4. Record preview & 5. Validation results</h3>
            <div className="filter-bar">
              {Object.entries(result.counts).map(([key, value]) => (
                <Badge
                  key={key}
                  tone={
                    key === "rejected"
                      ? "red"
                      : key === "flagged"
                        ? "amber"
                        : "blue"
                  }
                >
                  {key}: {value}
                </Badge>
              ))}
              {result.total_rows !== undefined && (
                <span>Total records: {result.total_rows}</span>
              )}
            </div>
            {intake.data && (
              <Alert
                title={
                  result.batch_id
                    ? "Persisted intake impact"
                    : "Current approved intake context"
                }
                tone={intake.data.metrics.regular_excess ? "warning" : "info"}
              >
                Counted regular admissions:{" "}
                {intake.data.metrics.regular_enrolment} /{" "}
                {intake.data.metrics.regular_capacity} approved. Excess:{" "}
                {intake.data.metrics.regular_excess}.{" "}
                {result.preview &&
                  "Preview does not reserve seats; intake is recalculated on submission."}
              </Alert>
            )}
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Parsed rows and validation results"
            >
              <table className="data-table">
                <caption className="sr-only">
                  Masked parsed records with row-level errors
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Row</th>
                    <th scope="col">Student</th>
                    <th scope="col">Result</th>
                    <th scope="col">Validation evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.row_number}>
                      <td>{row.row_number}</td>
                      <td>
                        {row.data.full_name}
                        <span className="table-secondary">
                          {row.data.apaar_id}
                        </span>
                      </td>
                      <td>
                        <Badge tone={statusTone(row.result)}>
                          {row.result}
                        </Badge>
                      </td>
                      <td>
                        {row.errors.join("; ") || "Configured checks passed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.preview && (
              <div style={{ marginTop: 20 }}>
                <h3>6. Review & submit</h3>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                  />
                  I have reviewed the preview and understand that accepted
                  records will be stored and rejected rows retained in the
                  import ledger.
                </label>
                <Button
                  style={{ marginTop: 12 }}
                  disabled={
                    !ack ||
                    !!result.missing_columns?.length ||
                    mutation.isPending
                  }
                  onClick={() => mutation.mutate(false)}
                >
                  Confirm submission
                </Button>
              </div>
            )}
            {result.batch_id && (
              <div style={{ marginTop: 20 }}>
                <Alert title="7. Submission saved" tone="success">
                  Submission reference: {result.batch_id}. The counts above are
                  stored in the persistent receipt.
                </Alert>
                <a
                  className="btn btn-secondary btn-md"
                  href={downloadUrl(`/imports/${result.batch_id}/errors.csv`)}
                >
                  Download error report
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Card style={{ marginTop: 20 }}>
        <CardHeader>
          <CardTitle>Submission history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.error && (
            <div className="error-panel">{history.error.message}</div>
          )}
          {history.data?.items.length ? (
            history.data.items.map((b) => (
              <div className="check-row" key={b.id}>
                <span>
                  <strong>{b.filename}</strong>
                  <span className="table-secondary">
                    Reference {b.id.slice(0, 8)}
                  </span>
                </span>
                <span>
                  {b.accepted} accepted · {b.rejected} rejected ·{" "}
                  <a href={downloadUrl(`/imports/${b.id}/errors.csv`)}>
                    Download validation report
                  </a>
                </span>
              </div>
            ))
          ) : (
            <p>No submission receipts in your authorized scope.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
