"use client";
import { parseTimestamp } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Finding, User } from "@/lib/types";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input, Label } from "@/components/ui/input";
import { PageHeader, EvidencePanel } from "@/components/portal";
import { RecordTable } from "@/components/record-table";
import { Pagination } from "@/components/pagination";
import { DataTable } from "@/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Card } from "@/components/ui/card";
type Case = {
  cohort_total: number;
  assigned_to: string;
  updated_at: string;
  records: {
    id: string;
    institution: string;
    programme: string;
    academic_year: string;
    masked_apaar: string;
    admission_date: string;
    status: string;
    attested: boolean;
  }[];
  history: {
    id: string;
    actor: string;
    action: string;
    created_at: string;
    metadata: Record<string, unknown>;
  }[];
};
export default function AnomaliesPage() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null),
    [q, setQ] = useState(""),
    [type, setType] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setSelected(p.get("finding"));
    setType(p.get("type") ?? "");
  }, []);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User }>("/auth/me"),
  });
  const query = useQuery({
    queryKey: ["findings"],
    queryFn: () => api<{ items: Finding[] }>("/findings"),
  });
  const run = useMutation({
    mutationFn: () => api("/anomaly/run", { method: "POST" }),
    onSuccess: () => client.invalidateQueries(),
  });
  const canReview = [
    "aicte_admin",
    "system_admin",
    "regional_officer",
  ].includes(me.data?.user.role ?? "");
  const imports = useQuery({
    queryKey: ["validation-import-summary"],
    queryFn: async () => {
      const [identity, duplicates, corrections] = await Promise.all([
        api<{ items: { count: number }[] }>(
          "/reports/analysis?kind=identity-errors&academic_year=2025-26",
        ),
        api<{ items: { count: number }[] }>(
          "/reports/analysis?kind=duplicate-submissions&academic_year=2025-26",
        ),
        api<{ items: { status: string }[] }>("/corrections"),
      ]);
      return {
        identity: identity.items.reduce((sum, r) => sum + r.count, 0),
        duplicates: duplicates.items.reduce((sum, r) => sum + r.count, 0),
        corrections: corrections.items.filter((c) => c.status === "open")
          .length,
      };
    },
  });
  const rows = query.data?.items ?? [],
    filtered = rows.filter(
      (f) =>
        (!type || f.type === type) &&
        (!q ||
          (f.title + f.institution + f.id)
            .toLowerCase()
            .includes(q.toLowerCase())),
    );
  const columns: ColumnDef<Finding>[] = [
    {
      header: "Finding / reference",
      accessorKey: "title",
      cell: ({ row }) => (
        <>
          <button
            className="table-primary"
            style={{
              border: 0,
              background: "none",
              padding: 0,
              textAlign: "left",
              textDecoration: "underline",
            }}
            onClick={() => setSelected(row.original.id)}
          >
            {row.original.title}
          </button>
          <span className="table-secondary">
            {row.original.id.slice(0, 8).toUpperCase()}
          </span>
        </>
      ),
    },
    {
      header: "Institution / year",
      accessorKey: "institution",
      cell: ({ row }) => (
        <>
          {row.original.institution}
          <span className="table-secondary">{row.original.academic_year}</span>
        </>
      ),
    },
    {
      header: "Type / source",
      accessorKey: "type",
      cell: ({ row }) => (
        <>
          {row.original.type.replaceAll("_", " ")}
          <span className="table-secondary">{row.original.source}</span>
        </>
      ),
    },
    {
      header: "Severity",
      accessorKey: "severity",
      cell: ({ row }) => (
        <Badge tone={statusTone(row.original.severity)}>
          {row.original.severity}
        </Badge>
      ),
    },
    {
      header: "Review status",
      accessorKey: "review_state",
      cell: ({ row }) => (
        <Badge tone={statusTone(row.original.review_state)}>
          {row.original.review_state.replaceAll("_", " ")}
        </Badge>
      ),
    },
    {
      header: "Action",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setSelected(row.original.id)}
        >
          Review evidence
        </Button>
      ),
    },
  ];
  return (
    <div className="page">
      <PageHeader
        title="Validation & Compliance Review"
        description="Administrative scrutiny of rule findings and explainable statistical signals. No automated punitive decision is made."
        actions={
          ["aicte_admin", "system_admin"].includes(
            me.data?.user.role ?? "",
          ) && (
            <Button onClick={() => run.mutate()} disabled={run.isPending}>
              {run.isPending ? "Evaluating peers…" : "Run anomaly engine"}
            </Button>
          )
        }
      />
      <Alert title="Human review required">
        Isolation Forest identifies unusual patterns. A match across
        institutions may represent a legitimate transfer or permitted concurrent
        enrolment.
      </Alert>
      {run.error && (
        <Alert tone="danger" title="Evaluation failed">
          {run.error.message}
        </Alert>
      )}
      {imports.error && (
        <Alert tone="danger" title="Validation summary unavailable">
          {imports.error.message}
        </Alert>
      )}
      <div className="metrics-grid metrics-six" style={{ marginTop: 20 }}>
        {[
          [
            "APAAR format errors",
            imports.data?.identity,
            "2025–26 import error occurrences",
          ],
          [
            "Duplicate submission errors",
            imports.data?.duplicates,
            "2025–26 import error occurrences",
          ],
          [
            "Cross-institution conflicts",
            rows.filter((f) => f.type === "cross_institution_conflict").length,
            "All recorded review states",
          ],
          [
            "Approved intake violations",
            rows.filter((f) => /intake/.test(f.type)).length,
            "All recorded review states",
          ],
          [
            "Category allocation findings",
            rows.filter(
              (f) =>
                /category/.test(f.type) ||
                Number(f.evidence.supernumerary_excess ?? 0) > 0,
            ).length,
            "Separate category and seat-policy evidence",
          ],
          [
            "Pending corrections",
            imports.data?.corrections,
            "Requests awaiting a decision",
          ],
        ].map(([label, count, hint]) => (
          <Card key={label} className="metric-card">
            <div>
              <p className="metric-label">{label}</p>
              <p className="metric-value">{count ?? "…"}</p>
              <p className="metric-hint">{hint}</p>
            </div>
          </Card>
        ))}
      </div>
      <div className="filter-bar">
        <div>
          <Label htmlFor="finding-search">Search findings</Label>
          <Input
            id="finding-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Institution, finding or reference"
          />
        </div>
        <div>
          <Label htmlFor="finding-type">Finding type</Label>
          <select
            id="finding-type"
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            {Array.from(new Set(rows.map((f) => f.type))).map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>
      {query.error && <div className="error-panel">{query.error.message}</div>}
      {query.isLoading ? (
        <div className="skeleton" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          pageSize={20}
          caption="Validation and compliance findings"
        />
      )}
      {selected && rows.find((f) => f.id === selected) && (
        <FindingDetail
          key={selected}
          finding={rows.find((f) => f.id === selected)!}
          canReview={canReview}
        />
      )}
    </div>
  );
}
function FindingDetail({
  finding: f,
  canReview,
}: {
  finding: Finding;
  canReview: boolean;
}) {
  const client = useQueryClient(),
    [decision, setDecision] = useState("request_clarification"),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false);
  const [cohortPage, setCohortPage] = useState(1);
  const query = useQuery({
    queryKey: ["finding-case", f.id, cohortPage],
    queryFn: () => api<Case>(`/workspace/findings/${f.id}?page=${cohortPage}`),
  });
  const assign = useMutation({
    mutationFn: () =>
      api(`/workspace/findings/${f.id}/assign`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries(),
  });
  const review = useMutation({
    mutationFn: () =>
      api(`/findings/${f.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          action: ["legitimate_transfer", "permitted_concurrent"].includes(
            decision,
          )
            ? "mark_expected"
            : decision,
          justification: decision.replaceAll("_", " ") + ": " + reason,
        }),
      }),
    onSuccess: () => {
      setConfirm(false);
      client.invalidateQueries();
    },
  });
  const cross = f.type === "cross_institution_conflict";
  const e = f.evidence;
  return (
    <section
      id="finding-detail"
      className="card finding-card"
      style={{ marginTop: 24 }}
      aria-labelledby="finding-detail-title"
    >
      <div className="finding-head">
        <span className="eyebrow">Evidence case · {f.id.slice(0, 8)}</span>
        <Badge tone={statusTone(f.review_state)}>
          {f.review_state.replaceAll("_", " ")}
        </Badge>
      </div>
      <h2 id="finding-detail-title">
        {cross ? "Cross-Institution Enrolment Review" : f.title}
      </h2>
      <p>{f.explanation}</p>
      <p className="record-subtitle">
        {f.institution} · {f.academic_year} · Assigned reviewer:{" "}
        {query.data?.assigned_to ?? "Loading…"}
      </p>
      {/intake/.test(f.type) && (
        <div className="key-values">
          {[
            ["Approved regular intake", e.regular_capacity],
            ["Counted regular admissions", e.regular_enrolment],
            ["Excess admissions", e.regular_excess],
            ["Approval policy", e.policy_reference],
          ].map(([k, v]) => (
            <div className="key-value" key={String(k)}>
              <span>{String(k)}</span>
              <strong>{String(v ?? "See evidence")}</strong>
            </div>
          ))}
        </div>
      )}
      {cross && (
        <>
          <div className="comparison-grid">
            {query.data?.records
              .filter((r) => r.academic_year === f.academic_year)
              .map((r, i) => (
                <article className="comparison-panel" key={r.id}>
                  <span className="eyebrow">
                    Institution {String.fromCharCode(65 + i)}
                  </span>
                  <h3>{r.institution}</h3>
                  <div className="key-values">
                    {[
                      ["Programme", r.programme],
                      ["Academic year", r.academic_year],
                      ["Student identifier", r.masked_apaar],
                      ["Admission date", r.admission_date],
                      ["Current status", r.status],
                      [
                        "Provenance",
                        r.attested
                          ? "Institution attestation recorded"
                          : "Attestation not recorded",
                      ],
                    ].map(([k, v]) => (
                      <div className="key-value" key={k}>
                        <span>{k}</span>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
          </div>
          <Alert title="Matching and overlap evidence">
            The same internal identity links these records. Compare admission
            dates, academic years and status. Transfer documentation or a policy
            permitting concurrent enrolment must be reviewed before recording a
            decision. Only enrolments within your authorized scope are shown.
          </Alert>
        </>
      )}
      {/intake/.test(f.type) && query.data && (
        <section>
          <h3>Affected programme/year cohort</h3>
          <p className="record-subtitle">
            {query.data.cohort_total} stored enrolments. The policy evidence
            specifies which statuses and seat categories contribute to the
            counted admissions; a cohort may also contain excluded records.
          </p>
          <RecordTable
            paginate={false}
            caption="Enrolments supporting the intake review"
            rows={query.data.records}
            fields={[
              "student",
              "masked_apaar",
              "programme",
              "academic_year",
              "status",
              "seat_type",
            ]}
          />
          <Pagination
            page={cohortPage}
            total={query.data.cohort_total}
            onChange={setCohortPage}
          />
        </section>
      )}
      <EvidencePanel
        title="View technical evidence and policy inputs"
        value={f.evidence}
      />
      {query.error && (
        <Alert tone="danger" title="Evidence unavailable">
          {query.error.message}
        </Alert>
      )}
      {canReview && (
        <div style={{ marginTop: 20 }}>
          <h3>Human review decision</h3>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              setConfirm(true);
            }}
          >
            <div className="key-values">
              <div>
                <Label htmlFor="review-decision">Review action</Label>
                <select
                  id="review-decision"
                  className="input"
                  value={decision}
                  onChange={(event) => {
                    setDecision(event.target.value);
                    setConfirm(false);
                  }}
                >
                  <option value="request_clarification">
                    Request Clarification
                  </option>
                  <option value="confirm_discrepancy">
                    {cross ? "Confirm Conflict" : "Confirm Finding"}
                  </option>
                  <option value="mark_expected">Mark Expected</option>
                  {cross && (
                    <>
                      <option value="legitimate_transfer">
                        Record Legitimate Transfer
                      </option>
                      <option value="permitted_concurrent">
                        Mark Permitted Concurrent Enrolment
                      </option>
                    </>
                  )}
                  <option value="resolve">Resolve Finding</option>
                  <option value="reject_finding">Reject Finding</option>
                </select>
              </div>
              <div>
                <Label htmlFor="review-reason">Review justification</Label>
                <Input
                  id="review-reason"
                  required
                  minLength={8}
                  maxLength={900}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setConfirm(false);
                  }}
                  placeholder="Record the evidence and reason for this decision"
                />
              </div>
            </div>
            <div className="page-actions">
              <Button type="submit">Review decision</Button>
              <Button
                type="button"
                variant="secondary"
                disabled={assign.isPending}
                onClick={() => assign.mutate()}
              >
                Assign review to me
              </Button>
            </div>
            {confirm && (
              <div className="alert alert-warning">
                <div>
                  <strong>Confirm this administrative decision</strong>
                  <p>
                    {decision.replaceAll("_", " ")}: {reason}
                  </p>
                  <Button
                    type="button"
                    disabled={review.isPending}
                    onClick={() => review.mutate()}
                  >
                    Confirm and record decision
                  </Button>{" "}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {(review.error || assign.error) && (
              <Alert tone="danger" title="Decision not saved">
                {review.error?.message ?? assign.error?.message}
              </Alert>
            )}
            {review.isSuccess && (
              <Alert tone="success" title="Review persisted">
                The decision and justification are recorded in the audit trail.
              </Alert>
            )}
          </form>
          <p className="record-subtitle">
            Review classification does not rewrite an institution’s enrolment
            history. Authorized lifecycle changes remain a separate audited
            action.
          </p>
        </div>
      )}
      <h3>Review history</h3>
      <ol className="timeline">
        {query.data?.history.map((h) => (
          <li key={h.id}>
            <strong>{h.action.replaceAll(".", " · ")}</strong>
            <time>
              {parseTimestamp(h.created_at).toLocaleString("en-IN")} · {h.actor}
            </time>
            <p>
              {String(
                h.metadata.justification ??
                  (h.action === "finding.assigned"
                    ? "Reviewer assigned"
                    : "Event recorded"),
              )}
            </p>
          </li>
        ))}
      </ol>
      {!query.data?.history.length && (
        <p className="record-subtitle">
          No administrative decisions have been recorded for this finding.
        </p>
      )}
    </section>
  );
}
