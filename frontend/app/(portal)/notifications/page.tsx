"use client";
import {parseTimestamp} from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge, statusTone } from "@/components/ui/badge";
import { PageHeader } from "@/components/portal";
type Notice = {
  id: string;
  title: string;
  body: string;
  severity: string;
  read: boolean;
  deep_link: string | null;
  created_at: string;
};
function category(n: Notice) {
  const s = (n.title + " " + n.body).toLowerCase();
  return /correction|clarification|pending|require/.test(s)
    ? "Action Required"
    : /credential|consent|verif/.test(s)
      ? "Verification"
      : /compliance|finding|review/.test(s)
        ? "Compliance"
        : /import|validat|submit/.test(s)
          ? "Validation"
          : "System Activity";
}
export default function Notifications() {
  const client = useQueryClient(),
    [group, setGroup] = useState("All notifications");
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ items: Notice[] }>("/notifications"),
  });
  const mutation = useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const rows = (query.data?.items ?? []).filter(
    (n) => group === "All notifications" || category(n) === group,
  );
  return (
    <div className="page">
      <PageHeader
        title="Notification Centre"
        description="Submission, correction, compliance and verification messages within your authorized scope."
      />
      <div
        className="report-groups"
        role="group"
        aria-label="Notification categories"
      >
        {[
          "All notifications",
          "Action Required",
          "Validation",
          "Compliance",
          "Verification",
          "System Activity",
        ].map((g) => (
          <button
            key={g}
            aria-pressed={g === group}
            onClick={() => setGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>
      {query.error && (
        <div role="alert" className="error-panel">
          {query.error.message}
        </div>
      )}
      {mutation.error && (
        <div role="alert" className="error-panel">
          {mutation.error.message}
        </div>
      )}
      <div className="grid-list">
        {rows.map((n) => (
          <article className="card notification-card" key={n.id}>
            <div className="finding-head">
              <Badge tone={statusTone(n.severity)}>{category(n)}</Badge>
              <Badge tone={n.read ? "slate" : "blue"}>
                {n.read ? "Read" : "Unread"}
              </Badge>
            </div>
            <h2>{n.title}</h2>
            <p>{n.body}</p>
            <div className="notification-actions">
              <time>{parseTimestamp(n.created_at).toLocaleString("en-IN")}</time>
              <div className="page-actions">
                <Link
                  className="btn btn-secondary btn-sm"
                  href={
                    n.deep_link?.startsWith("/") &&
                    !n.deep_link.startsWith("//")
                      ? n.deep_link
                      : "/dashboard"
                  }
                >
                  Open related workspace
                </Link>
                {!n.read && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => mutation.mutate(n.id)}
                    disabled={mutation.isPending}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {query.isLoading && <div className="skeleton" />}
      {!query.isLoading && !rows.length && (
        <p className="empty-state">No notifications in this category.</p>
      )}
    </div>
  );
}
