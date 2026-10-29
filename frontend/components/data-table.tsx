"use client";

import {flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef} from "@tanstack/react-table";

export function DataTable<T>({columns, data, empty = "No records match the current view."}: {columns: ColumnDef<T>[]; data: T[]; empty?: string}) {
  const table = useReactTable({data, columns, getCoreRowModel: getCoreRowModel(),getSortedRowModel:getSortedRowModel()});
  return <div className="table-wrap"><table className="data-table"><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} onClick={header.column.getToggleSortingHandler()} tabIndex={header.column.getCanSort()?0:undefined} onKeyDown={e=>{if(e.key==="Enter")header.column.getToggleSortingHandler()?.(e);}} style={{cursor:header.column.getCanSort()?"pointer":undefined}}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>) : <tr><td colSpan={columns.length}><div className="empty-state">{empty}</div></td></tr>}</tbody></table></div>;
}

