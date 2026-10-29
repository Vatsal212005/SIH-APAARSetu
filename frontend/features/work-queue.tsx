"use client";
import {parseTimestamp} from "@/lib/utils";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { Badge, statusTone } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
export type QueueItem = {
  id: string;
  institution: string;
  type: string;
  academic_year: string;
  severity: string;
  review_state: string;
  assigned_to: string;
  updated_at: string;
  title: string;
};
const columns: ColumnDef<QueueItem>[] = [
  {
    header: "Reference / finding",
    accessorKey: "title",
    cell: ({ row }) => (
      <>
        <Link href={`/anomalies?finding=${row.original.id}`}>
          {row.original.title}
        </Link>
        <span className="table-secondary">
          {row.original.id.slice(0, 8).toUpperCase()}
        </span>
      </>
    ),
  },
  { header: "Institution", accessorKey: "institution" },
  {
    header: "Type / year",
    accessorKey: "type",
    cell: ({ row }) => (
      <>
        {row.original.type.replaceAll("_", " ")}
        <span className="table-secondary">{row.original.academic_year}</span>
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
    header: "Status",
    accessorKey: "review_state",
    cell: ({ row }) => (
      <Badge tone={statusTone(row.original.review_state)}>
        {row.original.review_state.replaceAll("_", " ")}
      </Badge>
    ),
  },
  { header: "Assigned officer", accessorKey: "assigned_to" },
  {
    header: "Last updated",
    accessorKey: "updated_at",
    cell: ({ row }) =>
      parseTimestamp(row.original.updated_at).toLocaleDateString("en-IN"),
  },
  {
    header: "Action",
    cell: ({ row }) => (
      <Link href={`/anomalies?finding=${row.original.id}`}>
        Review record →
      </Link>
    ),
  },
];
export function WorkQueue({ items }: { items: QueueItem[] }) {
  const [q, setQ] = useState(""),
    [severity, setSeverity] = useState("");
  const rows = useMemo(
    () =>
      items.filter(
        (i) =>
          (!q ||
            (i.institution + " " + i.title + " " + i.id)
              .toLowerCase()
              .includes(q.toLowerCase())) &&
          (!severity || i.severity === severity),
      ),
    [items, q, severity],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Action centre — regulatory work queue</CardTitle>
        <CardDescription>
          Stored findings and current review assignments. Every decision
          requires a recorded justification.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="filter-bar">
          <div>
            <Label htmlFor="queue-search">Search findings</Label>
            <Input
              id="queue-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Reference, institution or finding"
            />
          </div>
          <div>
            <Label htmlFor="queue-severity">Severity</Label>
            <select
              id="queue-severity"
              className="input"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="">All severities</option>
              {Array.from(new Set(items.map((i) => i.severity))).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={rows}
          caption="Regulatory work queue"
          pageSize={10}
        />
      </CardContent>
    </Card>
  );
}
