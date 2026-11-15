import React, { useState, useEffect } from 'react';
import { SimpleCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@/components/ui';
import { Lender } from '@/lib/types/types';
import { getAllLenders } from '@/lib/features/loanLender/services/finance/lenderService';
import { formatNumber, formatPercent, getLenderTypeColorClass, getColorClass } from '@/lib/utils/utils';

export function LendersTab() {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{key: keyof Lender; direction: 'asc' | 'desc'} | null>(null);
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  useEffect(() => {
    loadLendersData();
  }, []);

  const loadLendersData = async () => {
    try {
      setLoading(true);
      const lendersData = await getAllLenders();
      setLenders(lendersData);
    } catch (error) {
      console.error('Error loading lenders data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLenders = React.useMemo(() => {
    let filtered = lenders;
    
    // Apply sorting
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' 
            ? aValue - bValue
            : bValue - aValue;
        }
        
        return 0;
      });
    }
    
    return filtered;
  }, [lenders, sortConfig]);

  const pagedLenders = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLenders.slice(start, start + pageSize);
  }, [filteredLenders, page]);

  const handleSort = (key: keyof Lender) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof Lender) => {
    if (!sortConfig || sortConfig.key !== key) return ' ↕️';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const formatRiskTolerance = (value: number) => {
    const normalizedValue = Math.min(value, 1);
    const colorClass = getColorClass(normalizedValue);
    
    return (
      <span className={colorClass}>
        {formatPercent(value, 1, true)}
      </span>
    );
  };

  const totalPages = Math.max(1, Math.ceil(filteredLenders.length / pageSize));

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading lenders...</p>
      </div>
    );
  }

  return (
    <SimpleCard
      title="Financial Lenders Directory"
      description={`All available lenders and their characteristics. Showing ${pagedLenders.length} of ${filteredLenders.length} (Total: ${lenders.length})`}
    >
      <div className="space-y-6">
        {/* Pagination controls */}
        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            className="min-h-11 px-3 py-2 border rounded disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            className="min-h-11 px-3 py-2 border rounded disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>

        <div className="flex flex-wrap gap-2 lg:hidden" aria-label="Sort lenders">
          {([
            ['name', 'Name'], ['type', 'Type'], ['baseInterestRate', 'Interest rate'],
            ['riskTolerance', 'Risk tolerance'], ['flexibility', 'Flexibility'],
            ['marketPresence', 'Market presence'], ['minLoanAmount', 'Minimum loan'], ['maxLoanAmount', 'Maximum loan'],
          ] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => handleSort(key)}
              aria-pressed={sortConfig?.key === key}
              className="min-h-11 rounded border px-3 py-2 text-xs">
              {label}{getSortIndicator(key)}
            </button>
          ))}
        </div>
        {/* Lenders table */}
        {pagedLenders.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className=" max-lg:block max-lg:[&_tbody]:block max-lg:[&_tbody>tr]:mb-3 max-lg:[&_tbody>tr]:block max-lg:[&_tbody>tr]:rounded-lg max-lg:[&_tbody>tr]:border max-lg:[&_tbody>tr]:border-gray-200 max-lg:[&_tbody>tr]:p-3 max-lg:[&_td]:block max-lg:[&_td]:w-full max-lg:[&_td]:break-words max-lg:[&_td]:text-left">
              <TableHeader className="hidden lg:table-header-group">
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('name')}
                  >
                    Name{getSortIndicator('name')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('type')}
                  >
                    Type{getSortIndicator('type')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('baseInterestRate')}
                  >
                    Interest Rate{getSortIndicator('baseInterestRate')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('riskTolerance')}
                  >
                    Risk Tolerance{getSortIndicator('riskTolerance')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('flexibility')}
                  >
                    Flexibility{getSortIndicator('flexibility')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('marketPresence')}
                  >
                    Market Presence{getSortIndicator('marketPresence')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('minLoanAmount')}
                  >
                    Min Loan{getSortIndicator('minLoanAmount')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('maxLoanAmount')}
                  >
                    Max Loan{getSortIndicator('maxLoanAmount')}
                  </TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedLenders.map((lender) => (
                  <TableRow key={lender.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium"><span className="mb-1 block text-xs font-medium text-gray-500 lg:hidden">Name</span>{lender.name}</TableCell>
                    <TableCell><span className="mb-1 block text-xs font-medium text-gray-500 lg:hidden">Type</span>
                      <Badge className={getLenderTypeColorClass(lender.type)}>
                        {lender.type}
                      </Badge>
                    </TableCell>
                    <TableCell><span className="mb-1 block text-xs font-medium text-gray-500 lg:hidden">Interest rate</span>{formatPercent(lender.baseInterestRate, 1, true)}</TableCell>
                    <TableCell><span className="mb-1 block text-xs font-medium text-gray-500 lg:hidden">Risk tolerance</span>{formatRiskTolerance(lender.riskTolerance)}</TableCell>
                    <TableCell><span className="mb-1 block text-xs font-medium text-gray-500 lg:hidden">Flexibility</span>{formatPercent(lender.flexibility, 1, true)}</TableCell>
                    <TableCell><span className="mb-1 block text-xs font-medium text-gray-500 lg:hidden">Market presence</span>{formatPercent(lender.marketPresence, 1, true)}</TableCell>
                    <TableCell><span className="mb-1 block text-xs font-medium text-gray-500 lg:hidden">Minimum loan</span>{formatNumber(lender.minLoanAmount, { currency: true })}</TableCell>
                    <TableCell><span className="mb-1 block text-xs font-medium text-gray-500 lg:hidden">Maximum loan</span>{formatNumber(lender.maxLoanAmount, { currency: true })}</TableCell>
                    <TableCell><span className="mb-1 block text-xs font-medium text-gray-500 lg:hidden">Duration</span>
                      <div className="text-sm">
                        {formatNumber(lender.minDurationSeasons / 4, { smartDecimals: true })} - {formatNumber(lender.maxDurationSeasons / 4, { smartDecimals: true })} years
                      </div>
                    </TableCell>
                    <TableCell><span className="mb-1 block text-xs font-medium text-gray-500 lg:hidden">Status</span>
                      {lender.blacklisted ? (
                        <Badge variant="destructive">Blacklisted</Badge>
                      ) : (
                        <Badge variant="secondary">Available</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {lenders.length === 0 ? 'Loading lenders...' : 'No lenders found.'}
          </div>
        )}
      </div>
    </SimpleCard>
  );
}
