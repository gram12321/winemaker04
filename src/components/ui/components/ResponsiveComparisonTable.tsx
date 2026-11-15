import type { ReactNode } from 'react';

export interface ResponsiveComparisonRow {
  id: string;
  cells: ReactNode[];
}

export function ResponsiveComparisonTable({
  label,
  columns,
  rows,
  className = '',
}: {
  label: string;
  columns: ReactNode[];
  rows: ResponsiveComparisonRow[];
  className?: string;
}) {
  const metricGrid = columns.length <= 2 ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <div className={`min-w-0 ${className}`}>
      <div role="list" aria-label={label} className="space-y-2 lg:hidden">
        {rows.map((row) => (
          <article key={row.id} className="min-w-0 rounded-lg border bg-muted/20 p-3">
            <h3 className="mb-2 break-words font-semibold">{row.cells[0]}</h3>
            <dl className={`grid ${metricGrid} gap-x-3 gap-y-2`}>
              {columns.slice(1).map((column, index) => (
                <div key={`${row.id}-${index}`} className="min-w-0">
                  <dt className="break-words text-xs leading-tight text-muted-foreground">{column}</dt>
                  <dd className="mt-0.5 break-words text-sm">{row.cells[index + 1]}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden min-w-0 overflow-hidden rounded-lg border lg:block">
        <table className="w-full table-fixed border-collapse text-left text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              {columns.map((column, index) => (
                <th key={index} scope="col" className="break-words px-2 py-2 font-semibold">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-b-0">
                {row.cells.map((cell, index) => index === 0
                  ? <th key={index} scope="row" className="break-words px-2 py-2 font-medium">{cell}</th>
                  : <td key={index} className="break-words px-2 py-2">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
