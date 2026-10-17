"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataColumn<Row> = {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  accessorFn?: (row: Row) => unknown;
  className?: string;
  enableSorting?: boolean;
};

export function DataTable<Row>({
  rows,
  columns,
  getRowId,
  actions,
  empty,
  className,
  enableRowSelection = true,
  enableSearch = false,
  searchPlaceholder = "Search records…",
  bulkActions,
  initialPageSize = 10,
}: {
  rows: Row[];
  columns: DataColumn<Row>[];
  getRowId: (row: Row, index: number) => string;
  actions?: (row: Row) => ReactNode;
  empty: ReactNode;
  className?: string;
  enableRowSelection?: boolean | ((row: Row) => boolean);
  enableSearch?: boolean;
  searchPlaceholder?: string;
  bulkActions?: (context: { selectedRows: Row[]; clearSelection: () => void }) => ReactNode;
  initialPageSize?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const tableColumns = useMemo<ColumnDef<Row, unknown>[]>(() => {
    const selectionColumn: ColumnDef<Row, unknown>[] = enableRowSelection ? [{
      id: "select",
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => <Checkbox aria-label="Select all rows" checked={table.getIsAllRowsSelected()} indeterminate={table.getIsSomeRowsSelected()} onCheckedChange={(checked) => table.toggleAllRowsSelected(checked)} />,
      cell: ({ row }) => <Checkbox aria-label={`Select row ${row.index + 1}`} checked={row.getIsSelected()} disabled={!row.getCanSelect()} onCheckedChange={(checked) => row.toggleSelected(checked === true)} />,
    }] : [];
    const dataColumns = columns.map((column): ColumnDef<Row, unknown> => ({
      id: column.id,
      header: () => column.header,
      accessorFn: column.accessorFn ?? ((row) => {
        const value = (row as Record<string, unknown>)[column.id];
        return value instanceof Date ? value.getTime() : value;
      }),
      cell: ({ row }) => column.cell(row.original),
      enableSorting: column.enableSorting !== false,
      sortingFn: "alphanumeric",
      meta: { className: column.className },
    }));
    const actionColumn: ColumnDef<Row, unknown>[] = actions ? [{
      id: "actions",
      header: () => <span className="block text-right">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => <div className="flex justify-end gap-1">{actions(row.original)}</div>,
      meta: { className: "text-right" },
    }] : [];
    return [...selectionColumn, ...dataColumns, ...actionColumn];
  }, [actions, columns, enableRowSelection]);

  // The table instance is intentionally local: TanStack exposes imperative methods that the React Compiler cannot safely memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { sorting, rowSelection, globalFilter },
    onSortingChange: (updater: Updater<SortingState>) => setSorting(updater),
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row, index) => getRowId(row, index),
    enableRowSelection: typeof enableRowSelection === "function" ? (row) => enableRowSelection(row.original) : enableRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: initialPageSize } },
  });

  const selectedRows = table.getSelectedRowModel().rows.map(({ original }) => original);
  const pageCount = Math.max(table.getPageCount(), 1);
  const selectionContext = { selectedRows, clearSelection: () => table.resetRowSelection() };
  const visibleRows = table.getRowModel().rows;
  function exportSelectedRows() {
    const csvCell = (value: unknown) => {
      const raw = value instanceof Date ? value.toISOString() : value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
      const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const csv = [columns.map(({ header }) => typeof header === "string" ? csvCell(header) : "").join(","), ...selectedRows.map((row) => columns.map((column) => csvCell(column.accessorFn ? column.accessorFn(row) : (row as Record<string, unknown>)[column.id])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "novara-selection.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={cn("space-y-3", className)}>
      {enableSearch || (enableRowSelection && selectedRows.length > 0) ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {enableSearch ? <label className="relative block w-full sm:max-w-sm"><Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="pl-9 pr-10" />{globalFilter ? <button type="button" aria-label="Clear table search" onClick={() => setGlobalFilter("")} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X aria-hidden className="size-4" /></button> : null}</label> : <span />}
          {enableRowSelection && selectedRows.length > 0 ? <div className="flex flex-wrap items-center gap-2" aria-live="polite"><span className="text-xs font-medium text-muted-foreground">{selectedRows.length} selected</span><Button type="button" variant="outline" size="sm" data-control-layout="standard" onClick={exportSelectedRows}><Download aria-hidden className="size-4" />Export selected</Button>{bulkActions?.(selectionContext)}<Button type="button" variant="ghost" size="sm" data-control-layout="standard" onClick={selectionContext.clearSelection}>Clear</Button></div> : null}
        </div>
      ) : null}

      {rows.length === 0 || visibleRows.length === 0 ? empty : <>
        <div className="overflow-x-auto rounded-xl border border-border/75">
          <Table className="min-w-[720px]">
            <TableHeader className="bg-secondary/50 text-[10px] uppercase tracking-wider text-muted-foreground">
              {table.getHeaderGroups().map((headerGroup) => <TableRow key={headerGroup.id} className="hover:bg-transparent">{headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as { className?: string } | undefined;
                const sorted = header.column.getIsSorted();
                return <TableHead key={header.id} className={cn("px-4 py-3 font-semibold", meta?.className)}>{header.isPlaceholder ? null : header.column.getCanSort() ? <button type="button" data-control-layout="content" className="inline-flex h-auto min-h-0 items-center gap-1.5 rounded px-1 py-1 text-inherit hover:bg-muted" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{sorted === "asc" ? <ArrowUp aria-hidden className="size-3" /> : sorted === "desc" ? <ArrowDown aria-hidden className="size-3" /> : <ArrowUpDown aria-hidden className="size-3 opacity-45" />}</button> : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>;
              })}</TableRow>)}
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>{row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                return <TableCell key={cell.id} className={cn("max-w-72 px-4 py-3.5", meta?.className)}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>;
              })}</TableRow>)}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 px-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{table.getFilteredRowModel().rows.length} records · Page {table.getState().pagination.pageIndex + 1} of {pageCount}</p>
          <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2">Rows <SelectField aria-label="Rows per page" value={String(table.getState().pagination.pageSize)} onValueChange={(value) => table.setPageSize(Number(value))} options={[10, 20, 50].map((size) => ({ value: String(size), label: String(size) }))} triggerClassName="h-9 min-w-20 rounded-lg px-3" /></label><Button type="button" variant="outline" size="icon" aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft aria-hidden className="size-4" /></Button><Button type="button" variant="outline" size="icon" aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}><ChevronRight aria-hidden className="size-4" /></Button></div>
        </div>
      </>}
    </div>
  );
}
