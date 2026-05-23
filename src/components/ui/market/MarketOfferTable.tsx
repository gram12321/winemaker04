import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/shadCN/table';

export interface MarketOfferTableColumn<RowType> {
  key: string;
  header: string;
  className?: string;
  sortable?: boolean;
  render: (row: RowType) => React.ReactNode;
}

interface MarketOfferTableProps<RowType> {
  rows: RowType[];
  columns: MarketOfferTableColumn<RowType>[];
  rowKey: (row: RowType) => string;
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
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} className={column.className}>
              {column.sortable && onSort ? (
                <button
                  type="button"
                  onClick={() => onSort(column.key)}
                  className="inline-flex items-center gap-1 hover:text-gray-900"
                >
                  <span>{column.header}</span>
                  <span className="text-[10px] text-gray-500">{getSortIndicator(column.key)}</span>
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
            className={onRowClick ? 'cursor-pointer hover:bg-slate-800/60' : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((column) => (
              <TableCell key={column.key} className={column.className}>{column.render(row)}</TableCell>
            ))}
          </TableRow>
        )})}
      </TableBody>
    </Table>
  );
}
