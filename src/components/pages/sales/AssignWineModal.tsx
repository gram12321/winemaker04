import React, { useState, useMemo, useEffect } from 'react';
import { WineContract, WineBatch } from '@/lib/types/types';
import { fulfillContract, getEligibleWinesForContract } from '@/lib/services/sales/contractService';
import { formatNumber } from '@/lib/utils/utils';
import { formatCompletedWineName } from '@/lib/services/wine/winery/inventoryService';
import { useWinePriceCalculator } from '@/hooks';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { LoadingProps } from '@/lib/types/UItypes';

interface AssignWineModalProps extends LoadingProps {
  isOpen: boolean;
  onClose: () => void;
  contract: WineContract;
  withLoading: (fn: () => Promise<void>) => Promise<void>;
}

interface SelectedWine {
  wineBatchId: string;
  quantity: number;
}

const AssignWineModal: React.FC<AssignWineModalProps> = ({
  isOpen,
  onClose,
  contract,
  isLoading,
  withLoading
}) => {
  const [selectedWines, setSelectedWines] = useState<SelectedWine[]>([]);
  const [eligibleWines, setEligibleWines] = useState<Array<{ wine: WineBatch; validation: any }>>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);

  // Use shared price calculator hook for consistent pricing with prestige bonuses
  const { getAskingPrice: getAskingPriceForWine } = useWinePriceCalculator();

  // Load eligible wines when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingEligible(true);
      getEligibleWinesForContract(contract)
        .then(wines => {
          setEligibleWines(wines);
          setLoadingEligible(false);
        })
        .catch(err => {
          console.error('Error loading eligible wines:', err);
          setLoadingEligible(false);
        });
    } else {
      setSelectedWines([]);
      setEligibleWines([]);
    }
  }, [isOpen, contract]);

  // Calculate total selected quantity
  const totalSelected = useMemo(() => {
    return selectedWines.reduce((sum, sw) => sum + sw.quantity, 0);
  }, [selectedWines]);

  // Check if we have enough quantity selected
  const hasEnoughQuantity = totalSelected >= contract.requestedQuantity;
  const hasExcessQuantity = totalSelected > contract.requestedQuantity;

  // Handle selecting a wine
  const handleSelectWine = (wineBatchId: string, quantity: number) => {
    setSelectedWines(prev => {
      const existing = prev.find(sw => sw.wineBatchId === wineBatchId);
      if (existing) {
        // Update quantity
        return prev.map(sw => 
          sw.wineBatchId === wineBatchId 
            ? { ...sw, quantity } 
            : sw
        ).filter(sw => sw.quantity > 0); // Remove if quantity is 0
      } else {
        // Add new selection
        return [...prev, { wineBatchId, quantity }];
      }
    });
  };

  // Handle fulfilling the contract
  const handleFulfill = async () => {
    if (!hasEnoughQuantity) {
      alert('You must select at least the requested quantity of wine.');
      return;
    }

    if (hasExcessQuantity) {
      const confirmed = confirm(
        `You've selected ${totalSelected} bottles but only ${contract.requestedQuantity} are needed. ` +
        `The excess will not be used. Continue?`
      );
      if (!confirmed) return;
    }

    await withLoading(async () => {
      const result = await fulfillContract(contract.id, selectedWines);
      if (result.success) {
        onClose();
      } else {
        alert(result.message);
      }
    });
  };

  // Format requirement for display
  const formatRequirement = (req: any): string => {
    switch (req.type) {
      case 'quality':
        return `Quality ≥ ${(req.value * 100).toFixed(0)}%`;
      case 'minimumVintage':
        return `Age ≥ ${req.params?.minAge || 0} years`;
      case 'specificVintage':
        return `Vintage: ${req.params?.targetYear || req.value}`;
      case 'balance':
        return `Balance ≥ ${(req.value * 100).toFixed(0)}%`;
      case 'landValue':
        return `Land Value ≥ €${(req.value / 1000).toFixed(0)}k/ha`;
      case 'grape':
        return `Grape: ${req.params?.grape || 'Any'}`;
      case 'grapeColor':
        const color = req.params?.targetGrapeColor || 'any';
        return `Color: ${color.charAt(0).toUpperCase() + color.slice(1)}`;
      case 'altitude':
        return `Altitude ≥ ${(req.value * 100).toFixed(0)}% (regional)`;
      case 'aspect':
        return `Aspect ≥ ${(req.value * 100).toFixed(0)}% (sun exposure)`;
      case 'characteristicMin':
        const minChar = req.params?.targetCharacteristic || 'characteristic';
        return `${minChar.charAt(0).toUpperCase() + minChar.slice(1)} ≥ ${(req.value * 100).toFixed(0)}%`;
      case 'characteristicMax':
        const maxChar = req.params?.targetCharacteristic || 'characteristic';
        return `${maxChar.charAt(0).toUpperCase() + maxChar.slice(1)} ≤ ${(req.value * 100).toFixed(0)}%`;
      case 'characteristicBalance':
        const balChar = req.params?.targetCharacteristic || 'characteristic';
        return `${balChar.charAt(0).toUpperCase() + balChar.slice(1)} Balance ≤ ${(req.value * 100).toFixed(0)}%`;
      default:
        return 'Unknown';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-amber-600 text-white px-4 py-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Assign Wine to Contract</h3>
          <button
            onClick={onClose}
            className="hover:bg-amber-700 rounded p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Contract Details */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900">{contract.customerName}</h4>
                <p className="text-xs text-gray-600">{contract.customerType} • {contract.customerCountry}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">${formatNumber(contract.totalValue, { decimals: 2 })}</p>
                <p className="text-xs text-gray-600">
                  {formatNumber(contract.requestedQuantity)} bottles @ ${formatNumber(contract.offeredPrice, { decimals: 2 })}/bottle
                </p>
              </div>
            </div>

            <div className="border-t border-blue-300 pt-2">
              <p className="text-xs font-semibold text-gray-700 mb-1">Requirements:</p>
              <div className="space-y-1">
                {contract.requirements.map((req, idx) => (
                  <div key={idx} className="text-xs text-gray-700 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    {formatRequirement(req)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Selection Summary */}
          <div className={`border rounded-lg p-3 ${
            hasEnoughQuantity 
              ? 'border-green-300 bg-green-50' 
              : 'border-gray-300 bg-gray-50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Selected: {formatNumber(totalSelected)} bottles</p>
                <p className="text-xs text-gray-600">
                  Required: {formatNumber(contract.requestedQuantity)} bottles
                </p>
              </div>
              {hasEnoughQuantity ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-gray-400" />
              )}
            </div>
            {hasExcessQuantity && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠ Warning: You've selected {totalSelected - contract.requestedQuantity} more bottles than needed.
              </p>
            )}
          </div>

          {/* Eligible Wines */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Eligible Wines</h4>
            {loadingEligible ? (
              <div className="text-center py-8 text-gray-500">Loading eligible wines...</div>
            ) : eligibleWines.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <AlertCircle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm text-gray-700 font-semibold">No wines meet the contract requirements</p>
                <p className="text-xs text-gray-600 mt-1">
                  You may need to produce wine with higher quality, better balance, or from different vineyards.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {eligibleWines.map(({ wine, validation }) => {
                  const selected = selectedWines.find(sw => sw.wineBatchId === wine.id);
                  const selectedQty = selected?.quantity || 0;
                  
                  // Get asking price using helper function (follows OrdersTab pattern)
                  const wineAskingPrice = getAskingPriceForWine(wine);
                  const premiumPercent = ((contract.offeredPrice - wineAskingPrice) / wineAskingPrice) * 100;
                  
                  return (
                    <div
                      key={wine.id}
                      className={`border rounded-lg p-3 ${
                        selectedQty > 0 
                          ? 'border-amber-500 bg-amber-50' 
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm">
                            {formatCompletedWineName(wine)}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                            <span>Available: {formatNumber(wine.quantity)} bottles</span>
                            <span>Quality: {(wine.grapeQuality * 100).toFixed(0)}%</span>
                            <span>Balance: {(wine.balance * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="text-xs">
                              <span className="text-gray-600">
                                {wine.askingPrice ? 'Asking' : 'Est. Value'}: 
                              </span>
                              <span className="font-semibold text-gray-900"> ${formatNumber(wineAskingPrice, { decimals: 2 })}</span>
                              <span className="text-gray-600"> vs </span>
                              <span className="font-semibold text-green-700">${formatNumber(contract.offeredPrice, { decimals: 2 })}</span>
                              <span className={`ml-1 font-medium ${
                                premiumPercent > 0 ? 'text-green-600' : 
                                premiumPercent < 0 ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                ({premiumPercent > 0 ? '+' : ''}
                                {formatNumber(premiumPercent, { decimals: 1 })}%)
                              </span>
                            </div>
                            {validation.isValid && (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-green-600" />
                                <span className="text-xs text-green-700">Meets requirements</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={wine.quantity}
                            value={selectedQty}
                            onChange={(e) => {
                              const qty = Math.min(wine.quantity, Math.max(0, parseInt(e.target.value) || 0));
                              handleSelectWine(wine.id, qty);
                            }}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-600">bottles</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleFulfill}
            disabled={isLoading || !hasEnoughQuantity || eligibleWines.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Fulfilling...' : 'Fulfill Contract'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignWineModal;
