"use client";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
export function DataTable<T>({
  columns,
  data,
  empty = "No records match the current view.",
  caption = "Authorized records",
  pageSize,
}: {
  columns: ColumnDef<T>[];
  data: T[];
  empty?: string;
  caption?: string;
  pageSize?: number;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: pageSize ? getPaginationRowModel() : undefined,
    initialState: { pagination: { pageSize: pageSize ?? 50 } },
  });
  return (
    <>
      <div
        className="table-wrap"
        tabIndex={0}
        role="region"
        aria-label={`${caption} — scrollable table`}
      >
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted(),
                    Icon =
                      sorted === "asc"
                        ? ArrowUp
                        : sorted === "desc"
                          ? ArrowDown
                          : ArrowUpDown;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <Icon size={12} aria-hidden="true" />
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  <div className="empty-state">{empty}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pageSize && data.length > pageSize && (
        <div
          className="filter-bar"
          style={{ justifyContent: "flex-end", marginTop: 12 }}
        >
          <button
            className="btn btn-secondary btn-sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Previous results
          </button>
          <span>
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next results
          </button>
        </div>
      )}
    </>
  );
}
