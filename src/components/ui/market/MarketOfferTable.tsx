import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/shadCN/table';

export interface MarketOfferTableColumn<RowType> {
  key: string;
  header: React.ReactNode;
  className?: string;
  sortable?: boolean;
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
    <Table className={className}>
      <TableHeader className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm">
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} className={column.className}>
              {column.sortable && onSort ? (
                <button
                  type="button"
                  onClick={() => onSort(column.key)}
                  className="inline-flex items-center gap-1 text-gray-200 hover:text-white"
                >
                  <span>{column.header}</span>
                  <span className="text-[10px] text-gray-400">{getSortIndicator(column.key)}</span>
                </button>
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
  );
}
