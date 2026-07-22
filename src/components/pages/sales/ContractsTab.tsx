import React, { useState, useMemo, useEffect } from 'react';
import { GrapeForwardContract, WineContract } from '@/lib/types/types';
import { acceptWinePresaleContract, rejectContract } from '@/lib/services/sales/contractService';
import { getContractGenerationChance } from '@/lib/services/sales/contractGenerationService';
import { acceptForwardContract, autoDeliverForwardContract, getForwardContracts, rejectForwardContract } from '@/lib/services/sales/forwardContractService';
import { researchUpgradeFeature } from '@/lib/features/researchUpgrade';
import { RESEARCH_PROJECTS } from '@/lib/features/researchUpgrade/constants/researchCatalog';
import { FORWARD_CONTRACT_CONFIG } from '@/lib/constants/contractConstants';
import { formatNumber, formatGameDateFromObject, formatPercent } from '@/lib/utils/utils';
import { NormalizeScrewed1000To01WithTail } from '@/lib/utils/calculator';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, UnifiedTooltip } from '../../ui';
import { getFlagIcon } from '@/lib/utils';
import { LoadingProps } from '@/lib/types/UItypes';
import { Info } from 'lucide-react';
import AssignWineModal from './AssignWineModal';
import { useTableSortWithAccessors, SortableColumn } from '@/hooks';
import { useGameStateWithData } from '@/hooks';

interface ContractsTabProps extends LoadingProps {
  contracts: WineContract[];
  withLoading: (fn: () => Promise<void>) => Promise<void>;
}

const CUSTOMER_CONTRACT_TYPES = ['Wine Shop', 'Restaurant', 'Private Collector', 'Chain Store'] as const;

type ContractTypeAccessRow = {
  customerType: typeof CUSTOMER_CONTRACT_TYPES[number];
  unlocked: boolean;
  requiredResearchTitle?: string;
  requirementLabel: string;
};

function normalizeUnlockValue(value: string | number): string {
  return String(value).trim().toLowerCase().replace(/_/g, ' ');
}

function getRequiredResearchTitleForCustomerType(customerType: string): string | undefined {
  const normalizedTarget = normalizeUnlockValue(customerType);
  const project = RESEARCH_PROJECTS.find((candidate) =>
    (candidate.unlocks || []).some((unlock) => {
      if (unlock.type !== 'contract_type') return false;
      return normalizeUnlockValue(unlock.value) === normalizedTarget;
    })
  );

  return project?.title;
}

const ContractsTab: React.FC<ContractsTabProps> = ({
  contracts,
  isLoading,
  withLoading
}) => {
  const [contractStatusFilter, setContractStatusFilter] = useState<'all' | 'offered' | 'pending' | 'fulfilled' | 'defaulted' | 'rejected' | 'expired'>('pending');
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
  const [contractTypeAccess, setContractTypeAccess] = useState<ContractTypeAccessRow[]>([]);

  const forwardContracts = useGameStateWithData(
    () => getForwardContracts(),
    [],
    { topic: 'contracts' }
  ) as GrapeForwardContract[];

  const presaleChanceInfo = useMemo(() => {
    const prestige = contractChanceInfo?.currentPrestige ?? 0;
    const prestigeNormalized = NormalizeScrewed1000To01WithTail(prestige);
    const perTickOfferChance = Math.min(
      FORWARD_CONTRACT_CONFIG.baseGenerationChance * (1 + prestigeNormalized),
      FORWARD_CONTRACT_CONFIG.baseGenerationChance * FORWARD_CONTRACT_CONFIG.prestigeOfferCountMultiplierCap
    );

    const openForwardCount = forwardContracts.filter(contract => ['offered', 'accepted'].includes(contract.status)).length;
    const blockedByCap = openForwardCount >= FORWARD_CONTRACT_CONFIG.maxActiveOpenContracts;

    return {
      prestige,
      perTickOfferChance,
      isBlocked: blockedByCap,
      blockReason: blockedByCap ? `Max active forward pre-sale contracts reached (${FORWARD_CONTRACT_CONFIG.maxActiveOpenContracts})` : undefined,
      openForwardCount
    };
  }, [contractChanceInfo, forwardContracts]);

  const getForwardUnitLabel = (contract: GrapeForwardContract): string =>
    contract.targetState === 'bottled' ? 'bottles' : 'kg';

  // Filter contracts by status
  const filteredContracts = useMemo(() => {
    if (contractStatusFilter === 'all') return contracts;
    return contracts.filter(c => c.status === contractStatusFilter);
  }, [contracts, contractStatusFilter]);

  // Get pending contracts for bulk actions
  const pendingContracts = useMemo(() => 
    contracts.filter(c => c.status === 'pending' || c.status === 'offered'),
    [contracts]
  );

  // Define sortable columns for contracts
  const contractColumns: SortableColumn<WineContract>[] = [
    { key: 'customerName', label: 'Customer', sortable: true },
    { key: 'customerType', label: 'Customer Type', sortable: true },
    { key: 'requestedQuantity', label: 'Quantity', sortable: true },
    { key: 'offeredPrice', label: 'Price/Bottle', sortable: true },
    { key: 'totalValue', label: 'Total Value', sortable: true },
    { 
      key: 'createdWeek' as keyof WineContract, 
      label: 'Created', 
      sortable: true,
      accessor: (contract) => `${contract.createdYear}-${contract.createdSeason}-${contract.createdWeek}`
    },
    { 
      key: 'expiresWeek' as keyof WineContract, 
      label: 'Expires', 
      sortable: true,
      accessor: (contract) => `${contract.expiresYear}-${contract.expiresSeason}-${contract.expiresWeek}`
    }
  ];

  // Use sorting hooks
  const {
    sortedData: sortedContracts,
    handleSort: handleContractSort,
    getSortIndicator: getContractSortIndicator,
    isColumnSorted: isContractColumnSorted
  } = useTableSortWithAccessors(filteredContracts, contractColumns);

  // Pagination
  const paginatedContracts = useMemo(() => {
    const startIdx = (contractsPage - 1) * contractsPageSize;
    return sortedContracts.slice(startIdx, startIdx + contractsPageSize);
  }, [sortedContracts, contractsPage]);

  const totalPages = Math.ceil(sortedContracts.length / contractsPageSize);

  // Load contract generation chance info
  const loadContractChance = async () => {
    try {
      const chanceInfo = await getContractGenerationChance();
      setContractChanceInfo(chanceInfo);
    } catch (error) {
      console.error('Error loading contract generation chance:', error);
    }
  };

  const loadContractTypeAccess = async () => {
    try {
      const unlocksService = researchUpgradeFeature.unlocks;
      const legacyUnlocks = await unlocksService.getUnlockedItems('contract_type');

      const unlockedSet = new Set<string>([
        ...legacyUnlocks.map(normalizeUnlockValue),
        normalizeUnlockValue('Wine Shop') // baseline access
      ]);

      const rows: ContractTypeAccessRow[] = CUSTOMER_CONTRACT_TYPES.map((customerType) => {
        const normalized = normalizeUnlockValue(customerType);
        const unlocked = unlockedSet.has(normalized);
        const requiredResearchTitle = unlocked ? undefined : getRequiredResearchTitleForCustomerType(customerType);

        return {
          customerType,
          unlocked,
          requiredResearchTitle,
          requirementLabel: unlocked ? 'Available' : (requiredResearchTitle ? `Requires: ${requiredResearchTitle}` : 'Requires research unlock')
        };
      });

      setContractTypeAccess(rows);
    } catch (error) {
      console.error('Error loading contract type access:', error);
      setContractTypeAccess([]);
    }
  };

  // Load on mount and when contracts change
  useEffect(() => {
    loadContractChance();
    loadContractTypeAccess();
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

  const handleAcceptPresaleContract = async (contractId: string) => {
    await withLoading(async () => {
      const result = await acceptWinePresaleContract(contractId);
      if (!result.success) {
        alert(result.message);
      }
    });
  };

  const handleAcceptForwardContract = async (contractId: string) => {
    await withLoading(async () => {
      const result = await acceptForwardContract(contractId);
      if (!result.success) alert(result.message);
    });
  };

  const handleRejectForwardContract = async (contractId: string) => {
    await withLoading(async () => {
      const result = await rejectForwardContract(contractId);
      if (!result.success) alert(result.message);
    });
  };

  const handleAutoDeliverForwardContract = async (contractId: string) => {
    await withLoading(async () => {
      const result = await autoDeliverForwardContract(contractId);
      if (!result.success) alert(result.message);
    });
  };

  // Handle rejecting all pending contracts
  const handleRejectAll = () => withLoading(async () => {
    if (pendingContracts.length === 0) return;

    await Promise.all(pendingContracts.map(contract => rejectContract(contract.id)));
    // Data will be automatically refreshed by the reactive hooks
  });

  // Format requirement for display
  const formatRequirement = (req: any): string => {
    switch (req.type) {
      case 'tasteQuality':
        return `Taste Quality >= ${(req.value * 100).toFixed(0)}%`;
      case 'minimumVintage':
        return `Age >= ${req.params?.minAge || 0} years`;
      case 'specificVintage':
        return `Vintage: ${req.params?.targetYear || req.value}`;
      case 'structureIndex':
        return `Structure >= ${(req.value * 100).toFixed(0)}%`;
      case 'landValue':
        return `Land Value >= ${formatNumber(req.value / 1000, { currency: true, decimals: 0 })}k/ha`;
      case 'country':
        return `Country: ${req.params?.targetCountry || 'Any'}`;
      case 'region':
        return `Region: ${req.params?.targetRegion || 'Any'}`;
      case 'grape':
        return `Grape: ${req.params?.targetGrape || 'Any'}`;
      case 'grapeColor':
        const color = req.params?.targetGrapeColor || 'any';
        return `Color: ${color.charAt(0).toUpperCase() + color.slice(1)}`;
      case 'altitude':
        return `Altitude >= ${(req.value * 100).toFixed(0)}% (regional)`;
      case 'aspect':
        return `Aspect >= ${(req.value * 100).toFixed(0)}% (sun exposure)`;
      case 'characteristicMin':
        const minChar = req.params?.targetCharacteristic || 'characteristic';
        return `${minChar.charAt(0).toUpperCase() + minChar.slice(1)} >= ${(req.value * 100).toFixed(0)}%`;
      case 'characteristicMax':
        const maxChar = req.params?.targetCharacteristic || 'characteristic';
        return `${maxChar.charAt(0).toUpperCase() + maxChar.slice(1)} <= ${(req.value * 100).toFixed(0)}%`;
      case 'characteristicDeviation':
        const balChar = req.params?.targetCharacteristic || 'characteristic';
        return `${balChar.charAt(0).toUpperCase() + balChar.slice(1)} deviation <= ${(req.value * 100).toFixed(0)}%`;
      default:
        return 'Unknown';
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
        {(['all', 'offered', 'pending', 'fulfilled', 'defaulted', 'rejected', 'expired'] as const).map(status => {
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
          <div className="flex items-center space-x-2">
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
            <UnifiedTooltip
              content={
                <div className="space-y-2 text-xs">
                  <div className="font-semibold">Pre-sale Offer Details (Bulk Buyer Flow)</div>
                  <div className="text-[10px] text-gray-400 mb-2">Generated from bulk buyer NPCs and can target grapes, must, or bottled stock.</div>
                  <div className="space-y-1">
                    <div>Company Prestige: <span className="font-medium">{formatNumber(presaleChanceInfo.prestige, { decimals: 1, forceDecimals: true })}</span></div>
                    <div>Per Tick Offer Chance: <span className="font-medium">{formatPercent(presaleChanceInfo.perTickOfferChance, 1, true)}</span></div>
                    <div className="text-[10px] text-gray-400">Base {formatPercent(FORWARD_CONTRACT_CONFIG.baseGenerationChance, 1, true)} scaled by prestige</div>
                    <div>
                      Estimated Per Tick:{' '}
                      <span className="font-medium">
                        {presaleChanceInfo.isBlocked
                          ? 'Blocked (N/A)'
                          : formatPercent(presaleChanceInfo.perTickOfferChance, 2, true)}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400">Offer size and pricing scale using the same market context as bulk grape trade (company value + prestige + buyer market profile).</div>
                    <div>Open Forward Pre-sales: <span className="font-medium">{presaleChanceInfo.openForwardCount} / {FORWARD_CONTRACT_CONFIG.maxActiveOpenContracts}</span></div>
                    <div>Economics: <span className="font-medium">{Math.round(FORWARD_CONTRACT_CONFIG.upfrontPercent * 100)}% upfront</span>, <span className="font-medium">{Math.round(FORWARD_CONTRACT_CONFIG.defaultPenaltyPercentOnAdvance * 100)}% default penalty on advance</span></div>
                    {presaleChanceInfo.isBlocked && (
                      <div className="text-[10px] text-red-300">Blocked: {presaleChanceInfo.blockReason}</div>
                    )}
                    <div className="text-[10px] text-gray-400 border-t pt-1 mt-1">Includes bottled pre-sale offers alongside grape/must targets.</div>
                  </div>
                </div>
              }
              className="max-w-xs"
              variant="default"
            >
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-help ${
                presaleChanceInfo.isBlocked
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-indigo-50 border-indigo-200'
              }`}>
                <div className={`text-xs ${presaleChanceInfo.isBlocked ? 'text-amber-700' : 'text-indigo-700'}`}>
                  <span className="font-medium">Natural Pre-sale Chance:</span>
                  <span className={`ml-2 text-sm font-bold ${presaleChanceInfo.isBlocked ? 'text-amber-800' : 'text-indigo-800'}`}>
                    {presaleChanceInfo.isBlocked
                      ? 'Blocked'
                      : formatPercent(presaleChanceInfo.perTickOfferChance, 1, true)}
                  </span>
                </div>
                <div className={presaleChanceInfo.isBlocked ? 'text-amber-500' : 'text-indigo-500'}>i</div>
              </div>
            </UnifiedTooltip>
          </div>
        </div>
      </div>

      {/* Contract Type Access Surface */}
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="text-sm font-semibold">Contract Type Access</h3>
            <p className="text-gray-500 text-xs">Visible progression state for contract type unlocks.</p>
          </div>
          {contractChanceInfo?.isBlocked && contractChanceInfo.blockReason && (
            <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
              {contractChanceInfo.blockReason}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {contractTypeAccess.map((row) => (
            <div key={row.customerType} className={`rounded border px-3 py-2 ${row.unlocked ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-800">{row.customerType}</span>
                <span className={`px-1.5 py-0.5 rounded ${row.unlocked ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                  {row.unlocked ? 'Unlocked' : 'Locked'}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-700">{row.requirementLabel}</div>
            </div>
          ))}
        </div>

        <p className="mt-2 text-[11px] text-gray-500">
          Wine Shop contracts are baseline available. Other contract types unlock through research progression.
        </p>
      </div>

      {/* Contract Management */}
      {pendingContracts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold">Contract Management</h3>
              <p className="text-gray-500 text-xs">Manage pending contracts</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleRejectAll}
                disabled={isLoading}
                className="bg-red-600 text-white px-2.5 py-1.5 rounded hover:bg-red-700 disabled:bg-gray-400 text-xs"
              >
                Reject All ({pendingContracts.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-blue-900 mb-1">About Contracts</p>
            <p className="text-blue-800">
              Contracts are special orders from customers with specific requirements (taste quality, vintage, structure, site parameters, etc.). 
              They typically offer higher prices than regular orders but require wines that meet all specified criteria.
            </p>
          </div>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead 
                className="w-[140px]"
                sortable 
                onSort={() => handleContractSort('customerName')}
                sortIndicator={getContractSortIndicator('customerName')}
                isSorted={isContractColumnSorted('customerName')}
              >
                Customer
              </TableHead>
              <TableHead 
                className="w-[100px]"
                sortable 
                onSort={() => handleContractSort('customerType')}
                sortIndicator={getContractSortIndicator('customerType')}
                isSorted={isContractColumnSorted('customerType')}
              >
                Type
              </TableHead>
              <TableHead 
                className="w-[80px]"
                sortable 
                onSort={() => handleContractSort('requestedQuantity')}
                sortIndicator={getContractSortIndicator('requestedQuantity')}
                isSorted={isContractColumnSorted('requestedQuantity')}
              >
                Quantity
              </TableHead>
              <TableHead 
                className="w-[80px]"
                sortable 
                onSort={() => handleContractSort('offeredPrice')}
                sortIndicator={getContractSortIndicator('offeredPrice')}
                isSorted={isContractColumnSorted('offeredPrice')}
              >
                Price/Bottle
              </TableHead>
              <TableHead 
                className="w-[100px]"
                sortable 
                onSort={() => handleContractSort('totalValue')}
                sortIndicator={getContractSortIndicator('totalValue')}
                isSorted={isContractColumnSorted('totalValue')}
              >
                Total Value
              </TableHead>
              <TableHead className="w-[180px]">Requirements</TableHead>
              <TableHead 
                className="w-[100px]"
                sortable 
                onSort={() => handleContractSort('createdWeek' as keyof WineContract)}
                sortIndicator={getContractSortIndicator('createdWeek' as keyof WineContract)}
                isSorted={isContractColumnSorted('createdWeek' as keyof WineContract)}
              >
                Created
              </TableHead>
              <TableHead 
                className="w-[100px]"
                sortable 
                onSort={() => handleContractSort('expiresWeek' as keyof WineContract)}
                sortIndicator={getContractSortIndicator('expiresWeek' as keyof WineContract)}
                isSorted={isContractColumnSorted('expiresWeek' as keyof WineContract)}
              >
                Expires
              </TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedContracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                  {contractStatusFilter === 'pending' 
                    ? 'No pending contracts. New contracts appear as customers reach higher relationship levels.'
                    : `No ${contractStatusFilter} contracts.`}
                </TableCell>
              </TableRow>
            ) : (
              paginatedContracts.map((contract) => {
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
                      {contract.contractMode === 'wine_presale' && (
                        <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700">
                          Pre-sale
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(contract.requestedQuantity)}</TableCell>
                    <TableCell className="text-right">{formatNumber(contract.offeredPrice, { currency: true, decimals: 2 })}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {formatNumber(contract.totalValue, { currency: true, decimals: 2 })}
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
                      {contract.status === 'offered' && contract.contractMode === 'wine_presale' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAcceptPresaleContract(contract.id)}
                            disabled={isLoading}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded disabled:opacity-50"
                          >
                            Accept
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

      {/* Forward Contracts */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Harvest Forward Contracts</h3>
          <p className="text-xs text-gray-500">Bulk grape/must pre-sale agreements with upfront payment and later delivery.</p>
        </div>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Buyer</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forwardContracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-6">
                  No forward contracts available yet.
                </TableCell>
              </TableRow>
            ) : (
              forwardContracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">{contract.buyerName}</TableCell>
                  <TableCell>
                    {contract.targetState}{contract.targetGrape ? ` / ${contract.targetGrape}` : ''}
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(contract.quantityKg)} {getForwardUnitLabel(contract)}</TableCell>
                  <TableCell className="text-right">{formatNumber(contract.deliveredKg)} {getForwardUnitLabel(contract)}</TableCell>
                  <TableCell className="text-right">{formatNumber(contract.totalValue, { currency: true, decimals: 2 })}</TableCell>
                  <TableCell>{formatGameDateFromObject({ week: contract.dueWeek, season: contract.dueSeason, year: contract.dueYear })}</TableCell>
                  <TableCell>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700">{contract.status}</span>
                  </TableCell>
                  <TableCell>
                    {contract.status === 'offered' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAcceptForwardContract(contract.id)}
                          disabled={isLoading}
                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectForwardContract(contract.id)}
                          disabled={isLoading}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {contract.status === 'accepted' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAutoDeliverForwardContract(contract.id)}
                          disabled={isLoading}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded disabled:opacity-50"
                        >
                          Auto Deliver
                        </button>
                        <button
                          onClick={() => handleRejectForwardContract(contract.id)}
                          disabled={isLoading}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {sortedContracts.length > contractsPageSize && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 text-xs bg-white rounded-b-lg">
          <div className="text-gray-500">
            Showing {((contractsPage - 1) * contractsPageSize) + 1} to {Math.min(contractsPage * contractsPageSize, sortedContracts.length)} of {sortedContracts.length} contracts
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-2.5 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={contractsPage <= 1}
              onClick={() => setContractsPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span>
              Page {contractsPage} of {totalPages}
            </span>
            <button
              className="px-2.5 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={contractsPage >= totalPages}
              onClick={() => setContractsPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
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
