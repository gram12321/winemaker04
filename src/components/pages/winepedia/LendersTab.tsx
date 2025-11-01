import React, { useState, useEffect } from 'react';
import { SimpleCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@/components/ui';
import { Lender } from '@/lib/types/types';
import { loadLenders } from '@/lib/database/core/lendersDB';
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
      const lendersData = await loadLenders();
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
            className="px-2 py-1 border rounded disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>

        {/* Lenders table */}
        {pagedLenders.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
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
                    <TableCell className="font-medium">{lender.name}</TableCell>
                    <TableCell>
                      <Badge className={getLenderTypeColorClass(lender.type)}>
                        {lender.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatPercent(lender.baseInterestRate, 1, true)}</TableCell>
                    <TableCell>{formatRiskTolerance(lender.riskTolerance)}</TableCell>
                    <TableCell>{formatPercent(lender.flexibility, 1, true)}</TableCell>
                    <TableCell>{formatPercent(lender.marketPresence, 1, true)}</TableCell>
                    <TableCell>{formatNumber(lender.minLoanAmount, { currency: true })}</TableCell>
                    <TableCell>{formatNumber(lender.maxLoanAmount, { currency: true })}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatNumber(lender.minDurationSeasons / 4, { smartDecimals: true })} - {formatNumber(lender.maxDurationSeasons / 4, { smartDecimals: true })} years
                      </div>
                    </TableCell>
                    <TableCell>
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
