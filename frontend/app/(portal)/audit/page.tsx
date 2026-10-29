"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Paginated } from "@/lib/types";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/portal";
import { RecordTable } from "@/components/record-table";
import { Pagination } from "@/components/pagination";
export default function AuditPage() {
  const [q, setQ] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [page, setPage] = useState(1);
  const params = new URLSearchParams({ q, page: String(page) });
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  const query = useQuery({
    queryKey: ["workspace-audit", q, start, end, page],
    queryFn: () =>
      api<Paginated<Record<string, unknown>>>("/workspace/audit?" + params),
  });
  return (
    <div className="page">
      <PageHeader
        title="Administrative Audit Log"
        description="Recorded actors, events and evidence. Audit entries have no ordinary application edit or delete action."
      />
      <div className="filter-toolbar">
        <div>
          <Label htmlFor="audit-search">Search event or reference</Label>
          <Input
            id="audit-search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Event, record type or identifier"
          />
        </div>
        <div>
          <Label htmlFor="audit-start">From date</Label>
          <Input
            id="audit-start"
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <Label htmlFor="audit-end">Through date</Label>
          <Input
            id="audit-end"
            type="date"
            min={start || undefined}
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      {query.isLoading ? (
        <div className="skeleton" />
      ) : query.error ? (
        <div className="error-panel" role="alert">
          {query.error.message}
        </div>
      ) : (
        <RecordTable
          paginate={false}
          rows={query.data?.items ?? []}
          fields={[
            "created_at",
            "actor",
            "role",
            "action",
            "entity_type",
            "entity_id",
            "outcome",
            "metadata",
          ]}
          caption="Administrative audit events"
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
