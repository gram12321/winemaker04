import React, { useState, useEffect } from 'react';
import { VineyardPurchaseOption } from '@/lib/services';
import { formatNumber, getFlagIcon, getBadgeColorClasses } from '@/lib/utils';
import { Button, Badge } from '@/components/ui';
import { X } from 'lucide-react';
import { purchaseVineyard } from '@/lib/services';
import { getGameState } from '@/lib/services';
import { WarningModal } from '@/components/ui';

interface LandSearchResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: VineyardPurchaseOption[];
}

/**
 * Modal displaying land search results
 * Shows all generated properties with option to purchase each
 * Removes properties from list when purchased to prevent duplicate purchases
 */
export const LandSearchResultsModal: React.FC<LandSearchResultsModalProps> = ({
  isOpen,
  onClose,
  options
}) => {
  // Track which properties have been purchased (by ID)
  const [purchasedPropertyIds, setPurchasedPropertyIds] = useState<Set<string>>(new Set());
  // Track which property is selected for preview
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  
  // Filter out properties that have already been purchased
  const availableProperties = options?.filter(p => !purchasedPropertyIds.has(p.id)) || [];
  
  // Get current money for affordability checking
  const gameState = getGameState();
  
  // Auto-select first available property when modal opens or when properties change
  useEffect(() => {
    if (availableProperties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(availableProperties[0].id);
    } else if (availableProperties.length > 0 && selectedPropertyId && !availableProperties.find(p => p.id === selectedPropertyId)) {
      // If currently selected property was purchased, select the first available one
      setSelectedPropertyId(availableProperties[0].id);
    } else if (availableProperties.length === 0) {
      // No properties available, clear selection
      setSelectedPropertyId(null);
    }
  }, [availableProperties, selectedPropertyId]);

  if (!isOpen || !options || options.length === 0) return null;

  const handlePurchase = async (property: VineyardPurchaseOption) => {
    const success = await purchaseVineyard(property);
    if (success) {
      // Mark this property as purchased (remove from available list)
      setPurchasedPropertyIds(prev => new Set([...prev, property.id]));
    }
  };

  const handleClose = () => {
    setPurchasedPropertyIds(new Set()); // Reset purchased list
    setSelectedPropertyId(null); // Reset selected property
    onClose();
  };

  const handlePropertySelect = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
  };

  // Get the selected property for preview
  const selectedProperty = selectedPropertyId 
    ? options.find(p => p.id === selectedPropertyId)
    : null;

  // If all properties have been purchased, show completion message
  if (availableProperties.length === 0 && purchasedPropertyIds.size > 0) {
    return (
      <WarningModal
        isOpen={true}
        onClose={handleClose}
        severity="info"
        title="All Properties Purchased!"
        message={`You've purchased all ${purchasedPropertyIds.size} propert${purchasedPropertyIds.size !== 1 ? 'ies' : 'y'} from this search.`}
        actions={[
          {
            label: 'Close',
            onClick: handleClose,
            variant: 'default'
          }
        ]}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Land Search Results</h2>
            <p className="text-sm text-gray-400 mt-1">
              {availableProperties.length} propert{availableProperties.length !== 1 ? 'ies' : 'y'} available
              {purchasedPropertyIds.size > 0 && ` (${purchasedPropertyIds.size} already purchased)`}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Two Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - Property List */}
          <div className="w-1/2 border-r border-gray-700 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Available Properties</h3>
              <div className="space-y-3">
                {availableProperties.map((property, index) => {
                  const isSelected = selectedPropertyId === property.id;
                  const canAfford = (gameState.money || 0) >= property.totalPrice;
                  
                  return (
                    <div 
                      key={property.id || index} 
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-500' 
                          : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      } ${!canAfford ? 'opacity-60' : ''}`}
                      onClick={() => canAfford && handlePropertySelect(property.id)}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`${getFlagIcon(property.country)} text-lg mt-1`}></span>
                        <div className="flex-1">
                          <div className="font-medium text-white text-sm">{property.name}</div>
                          <div className="text-xs text-gray-400 mb-2">{property.region}, {property.country}</div>

                          {/* Old-style compact details: Size / Price per ha / Total price */}
                          <div className="grid grid-cols-2 gap-y-1 text-xs">
                            <div className="text-gray-400">Size:</div>
                            <div className="text-white">{formatNumber(property.hectares, { smartDecimals: true })} ha</div>

                            <div className="text-gray-400">Price/ha:</div>
                            <div className="text-white">{formatNumber(property.landValue, { currency: true })}/ha</div>

                            <div className="text-gray-400">Total Price:</div>
                            <div className={`${canAfford ? 'text-green-400' : 'text-red-400'} font-medium`}>{formatNumber(property.totalPrice, { currency: true })}</div>
                          </div>

                          {property.soil.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {property.soil.slice(0, 3).map(soil => (
                                <span key={soil} className="text-xs bg-gray-700 text-gray-300 px-1 py-0.5 rounded">
                                  {soil}
                                </span>
                              ))}
                              {property.soil.length > 3 && (
                                <span className="text-xs text-gray-500">+{property.soil.length - 3} more</span>
                              )}
                            </div>
                          )}

                          {!canAfford && (
                            <div className="text-[10px] text-red-400 mt-1">Insufficient funds</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Property Preview */}
          <div className="w-1/2 overflow-y-auto">
            {selectedProperty ? (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Property Preview</h3>
                
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-sm font-medium text-white mb-4">Property Information</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Name:</span>
                        <div className="flex items-center gap-2">
                          <span className={`${getFlagIcon(selectedProperty.country)} text-base`}></span>
                          <span className="text-white font-medium">{selectedProperty.name}</span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Location:</span>
                        <span className="text-white">{selectedProperty.region}, {selectedProperty.country}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Size:</span>
                        <span className="text-white">{selectedProperty.hectares} hectares</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Land Value:</span>
                        <span className="text-white">{formatNumber(selectedProperty.landValue, { currency: true })} per hectare</span>
                      </div>
                    </div>
                  </div>

                  {/* Environmental Characteristics */}
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-sm font-medium text-white mb-4">Environmental Characteristics</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Altitude:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white">{selectedProperty.altitude}m</span>
                          {(() => {
                            const colors = getBadgeColorClasses(selectedProperty.altitudeRating);
                            return (
                              <Badge 
                                variant="secondary" 
                                className={`text-xs px-2 py-0.5 ${colors.text} ${colors.bg}`}
                              >
                                {formatNumber(selectedProperty.altitudeRating * 100, { smartDecimals: true })}%
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Aspect:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white">{selectedProperty.aspect}</span>
                          {(() => {
                            const colors = getBadgeColorClasses(selectedProperty.aspectRating);
                            return (
                              <Badge 
                                variant="secondary" 
                                className={`text-xs px-2 py-0.5 ${colors.text} ${colors.bg}`}
                              >
                                {formatNumber(selectedProperty.aspectRating * 100, { smartDecimals: true })}%
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-2">Soil Types:</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedProperty.soil.map(soil => (
                            <Badge key={soil} variant="secondary" className="text-xs bg-gray-600 text-white">
                              {soil}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Purchase Information (acts as purchase button) */}
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-sm font-medium text-white mb-4">Purchase Information</h4>
                    {(() => {
                      const canAfford = (gameState.money || 0) >= selectedProperty.totalPrice;
                      return (
                        <button
                          className={`w-full rounded-lg p-4 text-center transition-colors ${
                            canAfford
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                          }`}
                          onClick={() => canAfford && handlePurchase(selectedProperty)}
                          disabled={!canAfford}
                          aria-disabled={!canAfford}
                        >
                          <div className="text-3xl font-bold">
                            {formatNumber(selectedProperty.totalPrice, { currency: true })}
                          </div>
                          <div className={`text-sm mt-2 ${canAfford ? 'text-green-100' : 'text-gray-200'}`}>
                            Total purchase price for {selectedProperty.hectares} hectares
                          </div>
                          <div className={`text-xs mt-1 ${canAfford ? 'text-green-200' : 'text-gray-300'}`}>
                            {formatNumber(selectedProperty.landValue, { currency: true })} per hectare
                          </div>
                        </button>
                      );
                    })()}
                  </div>

                  {/* Insufficient funds note */}
                  {(gameState.money || 0) < selectedProperty.totalPrice && (
                    <div className="pt-2">
                      <p className="text-xs text-red-400 text-center">
                        Need {formatNumber(selectedProperty.totalPrice - (gameState.money || 0), { currency: true })} more
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <div className="text-lg mb-2">Select a property</div>
                  <div className="text-sm">Choose a property from the list to view details</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            <span className="font-medium text-white">{availableProperties.length}</span> propert{availableProperties.length !== 1 ? 'ies' : 'y'} remaining
          </div>
          <Button
            variant="outline"
            onClick={handleClose}
            className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
