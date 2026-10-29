"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
export default function Settings() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: { role: string } }>("/auth/me"),
  });
  const editable = ["aicte_admin", "system_admin"].includes(
    me.data?.user.role ?? "",
  );
  const providers = useQuery({
    queryKey: ["integrations"],
    queryFn: () =>
      api<{ items: { provider: string; status: string; reason: string }[] }>(
        "/integrations",
      ),
  });
  const policies = useQuery({
    queryKey: ["policies"],
    queryFn: () =>
      api<{
        items: {
          id: string;
          name: string;
          version: string;
          rules: Record<string, unknown>;
        }[];
      }>("/policies"),
  });
  const job = useMutation({
    mutationFn: () =>
      api<Record<string, number>>("/jobs/maintenance", { method: "POST" }),
  });
  return (
    <div className="page">
      <div className="page-title">
        <h1>Policy & integration configuration</h1>
        <p>
          Visible provider availability and versioned demonstration policy
          evidence.
        </p>
      </div>
      <Card style={{ marginTop: 18 }}>
        <CardHeader>
          <CardTitle>External identity providers</CardTitle>
        </CardHeader>
        <CardContent>
          {providers.error && (
            <Alert title="Access unavailable" tone="danger">
              {providers.error.message}
            </Alert>
          )}
          {providers.data?.items.map((p) => (
            <div className="check-row" key={p.provider}>
              <strong>
                {p.provider}: {p.status}
              </strong>
              <span>{p.reason}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card style={{ marginTop: 18 }}>
        <CardHeader>
          <CardTitle>Versioned capacity policies</CardTitle>
        </CardHeader>
        <CardContent>
          {policies.data?.items.map((p) => (
            <details key={p.id}>
              <summary>
                {p.name} ({p.version})
              </summary>
              <pre className="result-panel">
                {JSON.stringify(p.rules, null, 2)}
              </pre>
            </details>
          ))}
          {editable && (
            <a href="/manage?task=policy" className="btn btn-secondary btn-sm">
              Create policy version or authorize intake
            </a>
          )}
        </CardContent>
      </Card>
      <Card style={{ marginTop: 18 }}>
        <CardHeader>
          <CardTitle>Maintenance and retention hooks</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Generate deduplicated reminders for unresolved reviews older than
            seven days and count expired session retention candidates. No
            academic record is deleted.
          </p>
          {editable ? (
            <Button onClick={() => job.mutate()} disabled={job.isPending}>
              Run maintenance job
            </Button>
          ) : (
            <p>
              Read-only audit access. Maintenance requires central
              administrative authority.
            </p>
          )}
          {job.data && (
            <pre className="result-panel">
              {JSON.stringify(job.data, null, 2)}
            </pre>
          )}
          {job.error && (
            <Alert title="Maintenance failed" tone="danger">
              {job.error.message}
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
