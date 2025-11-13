import React, { useState, useMemo, useEffect } from 'react';
import { WineContract } from '@/lib/types/types';
import { rejectContract } from '@/lib/services/sales/contractService';
import { getContractGenerationChance } from '@/lib/services/sales/contractGenerationService';
import { formatNumber, formatGameDateFromObject, formatPercent } from '@/lib/utils/utils';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, UnifiedTooltip } from '../../ui';
import { getFlagIcon } from '@/lib/utils';
import { LoadingProps } from '@/lib/types/UItypes';
import { Info, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import AssignWineModal from './AssignWineModal';

interface ContractsTabProps extends LoadingProps {
  contracts: WineContract[];
  withLoading: (fn: () => Promise<void>) => Promise<void>;
}

const ContractsTab: React.FC<ContractsTabProps> = ({
  contracts,
  isLoading,
  withLoading
}) => {
  const [contractStatusFilter, setContractStatusFilter] = useState<'all' | 'pending' | 'fulfilled' | 'rejected' | 'expired'>('pending');
  const [selectedContract, setSelectedContract] = useState<WineContract | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [contractsPage, setContractsPage] = useState<number>(1);
  const contractsPageSize = 20;
  const [contractChanceInfo, setContractChanceInfo] = useState<{
    baseChance: number;
    finalChance: number;
    pendingContracts: number;
    maxPending: number;
    eligibleCustomers: number;
    totalCustomers: number;
    currentPrestige: number;
    avgCustomerChance: number;
    isBlocked: boolean;
    blockReason?: string;
    customerTypeBreakdown: Record<string, { eligible: number; total: number; avgChance: number }>;
  } | null>(null);

  // Filter contracts by status
  const filteredContracts = useMemo(() => {
    if (contractStatusFilter === 'all') return contracts;
    return contracts.filter(c => c.status === contractStatusFilter);
  }, [contracts, contractStatusFilter]);

  // Pagination
  const paginatedContracts = useMemo(() => {
    const startIdx = (contractsPage - 1) * contractsPageSize;
    return filteredContracts.slice(startIdx, startIdx + contractsPageSize);
  }, [filteredContracts, contractsPage]);

  const totalPages = Math.ceil(filteredContracts.length / contractsPageSize);

  // Load contract generation chance info
  const loadContractChance = async () => {
    try {
      const chanceInfo = await getContractGenerationChance();
      setContractChanceInfo(chanceInfo);
    } catch (error) {
      console.error('Error loading contract generation chance:', error);
    }
  };

  // Load on mount and when contracts change
  useEffect(() => {
    loadContractChance();
  }, [contracts.length]);

  // Handle assigning wine to contract
  const handleAssignWine = (contract: WineContract) => {
    setSelectedContract(contract);
    setShowAssignModal(true);
  };

  // Handle rejecting contract
  const handleRejectContract = async (contractId: string) => {
    await withLoading(async () => {
      const result = await rejectContract(contractId);
      if (!result.success) {
        alert(result.message);
      }
    });
  };

  // Format requirement for display
  const formatRequirement = (req: any): string => {
    switch (req.type) {
      case 'quality':
        return `Quality ≥ ${(req.value * 100).toFixed(0)}%`;
      case 'vintage':
        return `Age ≥ ${req.params?.minAge || 0} years`;
      case 'balance':
        return `Balance ≥ ${(req.value * 100).toFixed(0)}%`;
      case 'landValue':
        return `Land Value ≥ ${req.value.toFixed(2)}`;
      case 'grape':
        return `Grape: ${req.params?.grape || 'Any'}`;
      default:
        return 'Unknown';
    }
  };

  // Get status icon and color
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, color: 'text-blue-500', label: 'Pending' };
      case 'fulfilled':
        return { icon: CheckCircle2, color: 'text-green-500', label: 'Fulfilled' };
      case 'rejected':
        return { icon: XCircle, color: 'text-red-500', label: 'Rejected' };
      case 'expired':
        return { icon: AlertCircle, color: 'text-gray-500', label: 'Expired' };
      default:
        return { icon: Info, color: 'text-gray-500', label: status };
    }
  };

  // Get badge color for customer type
  const getCustomerTypeBadge = (type: string) => {
    switch (type) {
      case 'Restaurant':
        return 'bg-purple-100 text-purple-700';
      case 'Wine Shop':
        return 'bg-blue-100 text-blue-700';
      case 'Private Collector':
        return 'bg-amber-100 text-amber-700';
      case 'Chain Store':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-3">
      {/* Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-600 font-medium">Filter:</span>
        {(['all', 'pending', 'fulfilled', 'rejected', 'expired'] as const).map(status => {
          const count = status === 'all' 
            ? contracts.length 
            : contracts.filter(c => c.status === status).length;
          return (
            <button
              key={status}
              onClick={() => {
                setContractStatusFilter(status);
                setContractsPage(1);
              }}
              className={`px-2 py-1 rounded text-xs ${
                contractStatusFilter === status
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Contract Generation Chance Display */}
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold">Contract Generation</h3>
            <p className="text-gray-500 text-xs">Current chance to receive new contracts</p>
          </div>
          <div className="flex items-center space-x-4">
            <UnifiedTooltip
              content={
                contractChanceInfo ? (
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold">Contract Generation Details</div>
                    <div className="text-[10px] text-gray-400 mb-2">Each tick, every eligible customer rolls for a contract</div>
                    <div className="space-y-1">
                      <div>Company Prestige: <span className="font-medium">{formatNumber(contractChanceInfo.currentPrestige, { decimals: 1, forceDecimals: true })}</span></div>
                      <div>Eligible Customers: <span className="font-medium">{contractChanceInfo.eligibleCustomers} / {contractChanceInfo.totalCustomers}</span></div>
                      <div className="border-t pt-1 mt-1">
                        <div className="font-semibold mb-1">Per-Customer Chances:</div>
                        <div className="text-[10px] ml-2 space-y-0.5">
                          <div>Base: <span className="font-medium">{formatPercent(contractChanceInfo.baseChance, 2, true)}</span> per customer</div>
                          <div>× Modifier: <span className="font-medium">{formatPercent(contractChanceInfo.avgCustomerChance, 1, true)}</span> (avg)</div>
                          <div className="text-gray-400">= {formatPercent(contractChanceInfo.baseChance * contractChanceInfo.avgCustomerChance, 3, true)} per customer/tick</div>
                        </div>
                      </div>
                      <div>Pending Contracts: <span className="font-medium">{contractChanceInfo.pendingContracts} / {contractChanceInfo.maxPending}</span></div>
                      <div className="border-t pt-1 mt-1">
                        <div className="font-semibold mb-1">By Customer Type:</div>
                        {Object.entries(contractChanceInfo.customerTypeBreakdown).map(([type, breakdown]) => (
                          <div key={type} className="text-[10px] ml-2">
                            • {type}: {breakdown.eligible}/{breakdown.total} eligible
                            {breakdown.eligible > 0 && (
                              <span className="text-gray-400">
                                {' '}(modifier: {formatPercent(breakdown.avgChance, 0, true)})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-1 mt-1">
                        {contractChanceInfo.isBlocked && (
                          <div className="text-[10px] text-red-300">⚠️ {contractChanceInfo.blockReason}</div>
                        )}
                        {!contractChanceInfo.isBlocked && (
                          <div className="text-[10px] text-gray-400">
                            With {contractChanceInfo.eligibleCustomers} eligible customer(s), estimated {formatPercent(
                              1 - Math.pow(1 - contractChanceInfo.baseChance * contractChanceInfo.avgCustomerChance, contractChanceInfo.eligibleCustomers),
                              1,
                              true
                            )} chance per tick
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs">
                    <div className="font-semibold">Contract Generation</div>
                    <div>Loading contract generation chance...</div>
                  </div>
                )
              }
              className="max-w-xs"
              variant="default"
            >
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-help ${
                contractChanceInfo?.isBlocked 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-green-50 border-green-200'
              }`}>
                <div className={`text-xs ${contractChanceInfo?.isBlocked ? 'text-red-700' : 'text-green-700'}`}>
                  <span className="font-medium">Contract Chance:</span>
                  <span className={`ml-2 text-sm font-bold ${contractChanceInfo?.isBlocked ? 'text-red-800' : 'text-green-800'}`}>
                    {contractChanceInfo ? (
                      contractChanceInfo.isBlocked ? '0%' : 
                      // Show combined chance per tick (1 - (1 - p)^n formula)
                      formatPercent(
                        1 - Math.pow(
                          1 - contractChanceInfo.baseChance * contractChanceInfo.avgCustomerChance,
                          contractChanceInfo.eligibleCustomers
                        ),
                        1,
                        true
                      )
                    ) : '--'}
                  </span>
                  {contractChanceInfo && !contractChanceInfo.isBlocked && (
                    <span className="text-[10px] ml-1 opacity-70">
                      ({contractChanceInfo.eligibleCustomers} eligible)
                    </span>
                  )}
                </div>
                <div className={contractChanceInfo?.isBlocked ? 'text-red-500' : 'text-green-500'}>ℹ️</div>
              </div>
            </UnifiedTooltip>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-blue-900 mb-1">About Contracts</p>
            <p className="text-blue-800">
              Contracts are special orders from customers with specific requirements (quality, vintage, balance, etc.). 
              They typically offer higher prices than regular orders but require wines that meet all specified criteria.
            </p>
          </div>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Customer</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[80px]">Quantity</TableHead>
              <TableHead className="w-[80px]">Price/Bottle</TableHead>
              <TableHead className="w-[100px]">Total Value</TableHead>
              <TableHead className="w-[180px]">Requirements</TableHead>
              <TableHead className="w-[100px]">Created</TableHead>
              <TableHead className="w-[100px]">Expires</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedContracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                  {contractStatusFilter === 'pending' 
                    ? 'No pending contracts. New contracts appear as customers reach higher relationship levels.'
                    : `No ${contractStatusFilter} contracts.`}
                </TableCell>
              </TableRow>
            ) : (
              paginatedContracts.map((contract) => {
                const statusDisplay = getStatusDisplay(contract.status);
                const StatusIcon = statusDisplay.icon;
                
                return (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className={getFlagIcon(contract.customerCountry)} style={{ width: '16px', height: '12px' }}></span>
                        <span className="font-medium">{contract.customerName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${getCustomerTypeBadge(contract.customerType)}`}>
                        {contract.customerType}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(contract.requestedQuantity)}</TableCell>
                    <TableCell className="text-right">${formatNumber(contract.offeredPrice, { decimals: 2 })}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      ${formatNumber(contract.totalValue, { decimals: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {contract.requirements.slice(0, 2).map((req, idx) => (
                          <div key={idx} className="text-xs text-gray-700">
                            • {formatRequirement(req)}
                          </div>
                        ))}
                        {contract.requirements.length > 2 && (
                          <UnifiedTooltip
                            content={
                              <div className="space-y-1">
                                {contract.requirements.slice(2).map((req, idx) => (
                                  <div key={idx} className="text-xs">
                                    • {formatRequirement(req)}
                                  </div>
                                ))}
                              </div>
                            }
                          >
                            <div className="text-xs text-blue-600 cursor-help flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              +{contract.requirements.length - 2} more
                            </div>
                          </UnifiedTooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatGameDateFromObject({
                        week: contract.createdWeek,
                        season: contract.createdSeason,
                        year: contract.createdYear
                      })}
                    </TableCell>
                    <TableCell>
                      {formatGameDateFromObject({
                        week: contract.expiresWeek,
                        season: contract.expiresSeason,
                        year: contract.expiresYear
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <StatusIcon className={`w-4 h-4 ${statusDisplay.color}`} />
                        <span className="text-xs">{statusDisplay.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contract.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAssignWine(contract)}
                            disabled={isLoading}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded disabled:opacity-50"
                          >
                            Assign Wine
                          </button>
                          <button
                            onClick={() => handleRejectContract(contract.id)}
                            disabled={isLoading}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            onClick={() => setContractsPage(p => Math.max(1, p - 1))}
            disabled={contractsPage === 1}
            className="px-3 py-1 bg-gray-200 rounded text-xs disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-gray-600">
            Page {contractsPage} of {totalPages}
          </span>
          <button
            onClick={() => setContractsPage(p => Math.min(totalPages, p + 1))}
            disabled={contractsPage === totalPages}
            className="px-3 py-1 bg-gray-200 rounded text-xs disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Assign Wine Modal */}
      {selectedContract && (
        <AssignWineModal
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedContract(null);
          }}
          contract={selectedContract}
          isLoading={isLoading}
          withLoading={withLoading}
        />
      )}
    </div>
  );
};

export default ContractsTab;
