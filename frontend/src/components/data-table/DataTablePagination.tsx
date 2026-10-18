"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";

export function DataTablePagination({ totalItems, pageIndex, pageSize, pageCount, canPreviousPage, canNextPage, onPageChange, onPageSizeChange }: {
  totalItems: number;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const safePageCount = Math.max(1, pageCount);
  const activePage = Math.min(pageIndex, safePageCount - 1);
  const visiblePages = Array.from({ length: safePageCount }, (_, index) => index)
    .filter((index) => safePageCount <= 7 || index === 0 || index === safePageCount - 1 || Math.abs(index - activePage) <= 1);
  return <div className="flex flex-col gap-3 px-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
    <p aria-live="polite">{totalItems} {totalItems === 1 ? "record" : "records"} · Page {activePage + 1} of {safePageCount}</p>
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <label className="flex items-center gap-2">Rows per page <SelectField aria-label="Rows per page" value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))} options={[10, 20, 50].map((size) => ({ value: String(size), label: String(size) }))} triggerClassName="h-9 min-w-20 rounded-lg px-3" /></label>
      <nav aria-label="Table pages" className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page" disabled={!canPreviousPage} onClick={() => onPageChange(Math.max(0, pageIndex - 1))}><ChevronLeft aria-hidden className="size-4" /></Button>
        {visiblePages.map((page, index) => {
          const previousPage = visiblePages[index - 1];
          return <span key={page} className="inline-flex items-center gap-1">{previousPage !== undefined && page - previousPage > 1 ? <span aria-hidden className="px-1">…</span> : null}<Button type="button" variant={page === activePage ? "secondary" : "outline"} size="icon-sm" aria-label={`Page ${page + 1}`} aria-current={page === activePage ? "page" : undefined} onClick={() => onPageChange(page)}>{page + 1}</Button></span>;
        })}
        <Button type="button" variant="outline" size="icon-sm" aria-label="Next page" disabled={!canNextPage} onClick={() => onPageChange(Math.min(safePageCount - 1, pageIndex + 1))}><ChevronRight aria-hidden className="size-4" /></Button>
      </nav>
    </div>
  </div>;
}
