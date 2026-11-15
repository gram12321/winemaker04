import React from 'react';
import { Button } from '@/components/ui/shadCN/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/shadCN/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/shadCN/table';

export interface MarketOfferTableColumn<RowType> {
  key: string;
  header: React.ReactNode;
  className?: string;
  sortable?: boolean;
  mobileSummary?: boolean;
  mobileSortLabel?: string;
  render: (row: RowType) => React.ReactNode;
}

interface MarketOfferTableProps<RowType> {
  rows: RowType[];
  columns: MarketOfferTableColumn<RowType>[];
  rowKey: (row: RowType) => string;
  className?: string;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: (columnKey: string) => void;
  selectedRowKey?: string | null;
  onRowClick?: (row: RowType) => void;
}

export function MarketOfferTable<RowType>({
  rows,
  columns,
  rowKey,
  className,
  sortKey,
  sortDirection,
  onSort,
  selectedRowKey,
  onRowClick,
}: MarketOfferTableProps<RowType>) {
  const getSortIndicator = (columnKey: string): string => {
    if (!sortKey || sortKey !== columnKey || !sortDirection) {
      return '↑↓';
    }
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <>
    <div className="space-y-3 p-3 lg:hidden">
      {onSort && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2" aria-label="Sort offers">
          <label className="grid min-w-0 gap-1 text-xs text-gray-400">
            Sort offers by
            <Select value={sortKey ?? columns.find((column) => column.sortable)?.key ?? ''} onValueChange={onSort}>
              <SelectTrigger className="min-h-11 min-w-0 border-gray-600 bg-gray-800 text-white" aria-label="Sort offers by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.filter((column) => column.sortable).map((column) => (
                  <SelectItem key={column.key} value={column.key}>{column.mobileSortLabel ?? column.key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 border-gray-600 bg-gray-800 text-white"
            onClick={() => sortKey && onSort(sortKey)}
            aria-label={`Change sort direction, currently ${sortDirection ?? 'off'}`}
            title={`Sort ${sortDirection ?? 'off'}`}
          >
            {getSortIndicator(sortKey ?? '')}
          </Button>
        </div>
      )}
      {rows.map((row, index) => {
        const key = rowKey(row);
        const isSelected = selectedRowKey === key;
        const summaryColumns = columns.filter((column, columnIndex) => columnIndex === 0 || column.mobileSummary);
        const detailColumns = columns.filter((column, columnIndex) => columnIndex > 0 && !column.mobileSummary);
        return (
          <article key={key} className={`min-w-0 rounded-lg border p-3 ${isSelected ? 'border-amber-500 bg-slate-700/55' : 'border-gray-600 bg-gray-900/50'}`}>
            {onRowClick && (
              <button type="button" onClick={() => onRowClick(row)} aria-pressed={isSelected}
                className="mb-2 flex min-h-11 w-full min-w-0 items-start justify-between gap-2 rounded border border-gray-500 px-3 py-2 text-left text-sm font-medium text-white">
                <span className="min-w-0 flex-1">{columns[0]?.render(row) ?? `Offer ${index + 1}`}</span>
                <span className="shrink-0 text-xs text-amber-300">{isSelected ? 'Selected' : 'Select'}</span>
              </button>
            )}
            {!onRowClick && <div className="mb-2 min-w-0">{columns[0]?.render(row)}</div>}
            <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2">
              {summaryColumns.slice(1).map((column) => (
                <div key={column.key} className="min-w-0 space-y-1">
                  <dt className="text-xs font-medium text-gray-400">{column.header}</dt>
                  <dd className="min-w-0 break-words text-sm text-gray-100">{column.render(row)}</dd>
                </div>
              ))}
            </dl>
            {detailColumns.length > 0 && (
              <details className="mt-2 border-t border-gray-700 pt-2">
                <summary className="min-h-10 cursor-pointer py-2 text-xs font-medium text-gray-300">More offer details</summary>
                <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 pt-1">
                  {detailColumns.map((column) => (
                    <div key={column.key} className="min-w-0 space-y-1">
                      <dt className="text-xs font-medium text-gray-400">{column.header}</dt>
                      <dd className="min-w-0 break-words text-sm text-gray-200">{column.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </article>
        );
      })}
    </div>
    <div className="hidden lg:block">
    <Table className={className}>
      <TableHeader className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm">
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} className={column.className}>
              {column.sortable && onSort ? (
                <div className="inline-flex items-center gap-1 text-gray-200">
                  <span>{column.header}</span>
                  <button type="button" onClick={() => onSort(column.key)} aria-label={`Sort by ${column.key}`}
                    className="min-h-11 min-w-11 text-xs text-gray-400 hover:text-white">{getSortIndicator(column.key)}</button>
                </div>
              ) : (
                column.header
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const key = rowKey(row);
          const isSelected = selectedRowKey === key;

          return (
            <TableRow
              key={key}
              data-state={isSelected ? 'selected' : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-slate-800/60 data-[state=selected]:bg-slate-700/55 data-[state=selected]:hover:bg-slate-700/70' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <TableCell key={column.key} className={column.className}>{column.render(row)}</TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
    </>
  );
}
