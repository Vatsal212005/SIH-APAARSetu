"use client";
import {parseTimestamp} from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { Badge, statusTone } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";
export function RecordTable({
  rows,
  fields,
  caption,
  paginate = true,
}: {
  rows: Record<string, unknown>[];
  fields: string[];
  caption: string;
  paginate?: boolean;
}) {
  const columns: ColumnDef<Record<string, unknown>>[] = fields.map((key) => ({
    id: key,
    header: titleCase(key),
    accessorFn: (row) => String(row[key] ?? "—"),
    cell: ({ row }) =>
      /status|severity|outcome/.test(key) ? (
        <Badge tone={statusTone(String(row.original[key] ?? ""))}>
          {String(row.original[key] ?? "—").replaceAll("_", " ")}
        </Badge>
      ) : key === "metadata" ? (
        <details>
          <summary>View evidence</summary>
          <pre className="finding-evidence">
            {JSON.stringify(row.original[key], null, 2)}
          </pre>
        </details>
      ) : key.endsWith("_at") ? (
        parseTimestamp(String(row.original[key])).toLocaleString("en-IN")
      ) : (
        String(row.original[key] ?? "—")
      ),
  }));
  return (
    <DataTable
      caption={caption}
      data={rows}
      pageSize={paginate ? 20 : undefined}
      columns={columns}
    />
  );
}
