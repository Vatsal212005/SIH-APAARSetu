"use client";

import Image from "next/image";

import Link from "next/link";

import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, downloadUrl } from "@/lib/api";

import { Button } from "@/components/ui/button";

import { Alert } from "@/components/ui/alert";

import { Badge } from "@/components/ui/badge";

import { Card } from "@/components/ui/card";

import { PageHeader, EvidencePanel } from "@/components/portal";

type Scenario = { id: string; letter: string; title: string; summary: string };

type State = {
  scenario: string;
  step: number;
  capacity?: Record<string, number>;
  record_count?: number;
  records?: Record<string, string>[];
  counts?: Record<string, number>;
  rows?: { row_number: number; result: string; errors: string[] }[];
  batch_id?: string;
  verification_path?: string;
  token?: string;
  signature_valid?: boolean;
  fields?: string[];
  verification?: { valid: boolean; disclosed_fields: Record<string, string> };
  review_state?: string;
  findings?: number;
  evaluated?: number;
  finding_id?: string;
};

const names: Record<string, string> = {
  "intake-exceeded": "Approved Intake Violation",
  "cross-institution": "Cross-Institution Conflict",
  "consent-verification": "Consent-Based Credential Verification",
  "bulk-validation": "Student Data Upload and Validation",
  "intelligent-anomaly": "Intelligent Enrolment Anomaly",
};

export default function Demo() {
  const client = useQueryClient(),
    [local, setLocal] = useState<Record<string, State>>({}),
    [views, setViews] = useState<Record<string, number>>({}),
    [presentation, setPresentation] = useState(false),
    [focused, setFocused] = useState("");
  useEffect(() => {
    document.body.classList.toggle("presentation-active", presentation);
    return () => document.body.classList.remove("presentation-active");
  }, [presentation]);
  const query = useQuery({
    queryKey: ["scenarios"],
    queryFn: () =>
      api<{
        items: Scenario[];
        sessions: { scenario: string; state: State }[];
      }>("/demo/scenarios"),
  });
  const run = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api<State>(`/demo/scenarios/${id}/run`, {
        method: "POST",
        body: JSON.stringify({ action, token: local[id]?.token }),
      }),
    onSuccess: (value, { id, action }) => {
      setLocal((current) => ({
        ...current,
        [id]: {
          ...value,
          token: value.token ?? current[id]?.token,
          verification_path:
            value.verification_path ?? current[id]?.verification_path,
        },
      }));
      setViews((v) => ({ ...v, [id]: action === "run" ? 2 : 4 }));
      setFocused(id);
      client.invalidateQueries();
    },
  });
  return (
    <div className="page">
      <PageHeader
        title="APAARSetu — Workflow Demonstration Centre"
        description="Explore five synthetic scenarios demonstrating student data integrity, enrolment compliance and secure verification."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setPresentation(!presentation);
              if (!focused) setFocused(query.data?.items[0]?.id ?? "");
            }}
          >
            {presentation ? "Exit presentation" : "Presentation mode"}
          </Button>
        }
      />
      <Alert title="Synthetic training environment">
        Each scenario invokes the application’s actual services. Scenario C
        records explicitly scripted synthetic student consent; ordinary sharing
        remains student-only.
      </Alert>
      {presentation && (
        <div className="filter-bar">
          <label htmlFor="present-scenario">Presentation scenario</label>
          <select
            id="present-scenario"
            className="input"
            value={focused}
            onChange={(e) => setFocused(e.target.value)}
          >
            {query.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.letter}. {names[s.id]}
              </option>
            ))}
          </select>
        </div>
      )}
      {query.error && (
        <Alert title="Demo Centre unavailable" tone="danger">
          {query.error.message}
        </Alert>
      )}
      {run.error && (
        <Alert title="Scenario action failed" tone="danger">
          {run.error.message}
        </Alert>
      )}
      <h2 className="sr-only">Five guided workflow scenarios</h2>
      <div className="scenario-grid" style={{ marginTop: 20 }}>
        {query.data?.items
          .filter((s) => !presentation || s.id === focused)
          .map((item) => {
            const state =
                local[item.id] ??
                query.data.sessions.find((s) => s.scenario === item.id)?.state,
              view = views[item.id] ?? (state ? 2 : 1);
            return (
              <Card className="scenario-card" key={item.id}>
                <div className="finding-head">
                  <span className="scenario-letter">{item.letter}</span>
                  <Badge tone={state ? "teal" : "slate"}>
                    {state ? "Previous evidence available" : "Not run"}
                  </Badge>
                </div>
                <h3>{names[item.id]}</h3>
                <p>{item.summary}</p>
                <p className="record-subtitle">
                  Guided workflow · four sections · persisted service results
                </p>
                <div className="page-actions">
                  <Button
                    size="sm"
                    disabled={run.isPending}
                    onClick={() => run.mutate({ id: item.id, action: "run" })}
                  >
                    {state ? "Repeat / refresh" : "Start Demo"}
                  </Button>
                  {state && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setViews({ ...views, [item.id]: 4 })}
                    >
                      View Previous Results
                    </Button>
                  )}
                </div>
                {state && (
                  <>
                    <div
                      className="tabs"
                      role="group"
                      aria-label={`${names[item.id]} steps`}
                    >
                      {[
                        "Purpose",
                        "Input records",
                        "Service actions",
                        "Outcome",
                      ].map((s, i) => (
                        <button
                          key={s}
                          aria-pressed={view === i + 1}
                          onClick={() =>
                            setViews({ ...views, [item.id]: i + 1 })
                          }
                        >
                          {i + 1}. {s}
                        </button>
                      ))}
                    </div>
                    {view === 1 && (
                      <p>
                        {item.summary} Review the actual inputs, invoke the
                        service and examine the stored outcome before moving to
                        the next scenario.
                      </p>
                    )}
                    {view === 2 && (
                      <>
                        <h4>Actual input and computed evidence</h4>
                        {state.capacity && (
                          <>
                            <div className="check-list">
                              <div className="check-row">
                                <span>Approved regular intake</span>
                                <strong>
                                  {state.capacity.regular_capacity}
                                </strong>
                              </div>
                              <div className="check-row">
                                <span>Counted regular admissions</span>
                                <strong>
                                  {state.capacity.regular_enrolment}
                                </strong>
                              </div>
                              <div className="check-row">
                                <span>Computed excess</span>
                                <Badge tone="red">
                                  {state.capacity.regular_excess}
                                </Badge>
                              </div>
                            </div>
                            <p>
                              The platform found{" "}
                              {state.capacity.regular_enrolment} countable
                              admissions against{" "}
                              {state.capacity.regular_capacity} approved regular
                              seats: an excess of{" "}
                              {state.capacity.regular_excess}.
                            </p>
                          </>
                        )}
                        {state.records?.map((r) => (
                          <div className="check-row" key={r.id}>
                            <span>
                              {r.institution}
                              <span className="table-secondary">
                                {r.academic_year} · {r.admission_date}
                              </span>
                            </span>
                            <Badge>{r.status}</Badge>
                          </div>
                        ))}
                        {state.counts && (
                          <div className="filter-bar">
                            {Object.entries(state.counts).map(([k, v]) => (
                              <Badge key={k}>
                                {k}: {v}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {state.rows?.map((r) => (
                          <div className="check-row" key={r.row_number}>
                            <span>
                              Row {r.row_number}: {r.result}
                            </span>
                            <span>
                              {r.errors.join("; ") ||
                                "Configured checks passed"}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                    {item.id === "consent-verification" && (
                      <>
                        <Alert
                          title="Actual Ed25519 signature"
                          tone={state.signature_valid ? "success" : "danger"}
                        >
                          {state.signature_valid
                            ? "Signature passed"
                            : "Signature unavailable"}{" "}
                          · Shared fields: {state.fields?.join(", ")}
                        </Alert>
                        {local[item.id]?.token && (
                          <>
                            <Image
                              unoptimized
                              alt="Consent-scoped verification QR"
                              width={130}
                              height={130}
                              src={downloadUrl(
                                `/disclosure-qr/${local[item.id].token}`,
                              )}
                            />
                            <div className="page-actions">
                              <a
                                className="btn btn-secondary btn-sm"
                                target="_blank"
                                rel="noreferrer"
                                href={local[item.id].verification_path}
                              >
                                Open verifier
                              </a>
                              <Button
                                size="sm"
                                disabled={run.isPending}
                                onClick={() =>
                                  run.mutate({ id: item.id, action: "verify" })
                                }
                              >
                                Verify signature and consent
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={run.isPending}
                                onClick={() =>
                                  run.mutate({ id: item.id, action: "revoke" })
                                }
                              >
                                Revoke and verify denial
                              </Button>
                            </div>
                          </>
                        )}
                        {state.verification && (
                          <Alert
                            title={
                              state.verification.valid
                                ? "Verification passed"
                                : "Verification denied"
                            }
                            tone={
                              state.verification.valid ? "success" : "warning"
                            }
                          >
                            {state.verification.valid
                              ? JSON.stringify(
                                  state.verification.disclosed_fields,
                                )
                              : "No student fields disclosed."}
                          </Alert>
                        )}
                      </>
                    )}
                    {state.evaluated !== undefined && (
                      <Alert title="Isolation Forest result">
                        Evaluated {state.evaluated} institutions · Found{" "}
                        {state.findings} outlier patterns. Scores describe
                        unusual patterns and are not misconduct probabilities.
                      </Alert>
                    )}
                    {view === 3 && (
                      <p>
                        Use the service controls to verify consent or record a
                        human review. The application persists the resulting
                        event and evidence.
                      </p>
                    )}
                    {!["bulk-validation", "consent-verification"].includes(
                      item.id,
                    ) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={run.isPending}
                        onClick={() =>
                          run.mutate({ id: item.id, action: "review" })
                        }
                      >
                        Record review
                      </Button>
                    )}
                    {state.review_state && view === 4 && (
                      <Alert title="Persisted review state">
                        {state.review_state.replaceAll("_", " ")}
                      </Alert>
                    )}
                    {view === 4 && (
                      <p>
                        Latest persisted service step: {state.step}. Review the
                        technical evidence for the full returned database state.
                      </p>
                    )}
                    {state.batch_id && (
                      <p>
                        <a
                          className="btn btn-secondary btn-sm"
                          href={downloadUrl(
                            `/imports/${state.batch_id}/errors.csv`,
                          )}
                        >
                          Download persisted error report
                        </a>
                      </p>
                    )}
                    <EvidencePanel
                      title="View Technical Evidence — actual inputs and results"
                      value={{
                        ...state,
                        token: undefined,
                        verification_path: undefined,
                      }}
                    />
                    <div className="page-actions" style={{ marginTop: 16 }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={view === 1}
                        onClick={() =>
                          setViews({ ...views, [item.id]: view - 1 })
                        }
                      >
                        Previous Step
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={view === 4}
                        onClick={() =>
                          setViews({ ...views, [item.id]: view + 1 })
                        }
                      >
                        Next Step
                      </Button>
                      <Link
                        className="btn btn-ghost btn-sm"
                        href={
                          state.finding_id
                            ? `/anomalies?finding=${state.finding_id}`
                            : item.id === "bulk-validation"
                              ? "/reports"
                              : "/credentials"
                        }
                      >
                        Open Related Record
                      </Link>
                      <Link className="btn btn-ghost btn-sm" href="/audit">
                        View Audit Trail
                      </Link>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
      </div>
      {presentation && (
        <Button
          variant="secondary"
          style={{ marginTop: 20 }}
          onClick={() => setPresentation(false)}
        >
          Return to Demo Centre
        </Button>
      )}
    </div>
  );
}
