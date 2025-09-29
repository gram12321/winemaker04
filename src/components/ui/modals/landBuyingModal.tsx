import React, { useState, useEffect } from 'react';
import { DialogProps } from '@/lib/types/UItypes';
import { VineyardPurchaseOption } from '@/lib/services/vineyard/vinyardBuyingService';
import { formatCurrency, formatNumber, getBadgeColorClasses } from '@/lib/utils';
import { getCountryFlag } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../shadCN/dialog';
import { Button } from '../shadCN/button';
import { Badge } from '../shadCN/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../shadCN/card';

/**
 * Land Buying Modal
 * Modal for selecting and purchasing vineyard properties
 */

interface LandBuyingModalProps extends DialogProps {
  options: VineyardPurchaseOption[];
  onPurchase: (option: VineyardPurchaseOption) => void;
  currentMoney: number;
}

const LandBuyingModal: React.FC<LandBuyingModalProps> = ({ 
  isOpen, 
  onClose, 
  options, 
  onPurchase, 
  currentMoney 
}) => {
  // State initialization
  const [selectedOption, setSelectedOption] = useState<VineyardPurchaseOption | null>(null);

  // Effects
  useEffect(() => {
    if (!isOpen) {
      setSelectedOption(null);
    }
  }, [isOpen]);

  // Event handlers
  const handlePurchase = () => {
    if (selectedOption) {
      onPurchase(selectedOption);
      onClose();
    }
  };

  // Utility functions
  const canAfford = (option: VineyardPurchaseOption) => currentMoney >= option.totalPrice;

  // Render
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Available Vineyard Properties</DialogTitle>
          <DialogDescription>
            Choose from available vineyard properties. Each property has unique characteristics that affect wine quality and value.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Money Display */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-800">Available Funds:</span>
              <span className="text-lg font-bold text-blue-900">{formatCurrency(currentMoney)}</span>
            </div>
          </div>

          {/* Vineyard Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {options.map((option) => {
              const affordable = canAfford(option);
              const isSelected = selectedOption?.id === option.id;
              
              return (
                <Card 
                  key={option.id} 
                  className={`cursor-pointer transition-all duration-200 ${
                    isSelected 
                      ? 'ring-2 ring-amber-500 bg-amber-50' 
                      : affordable 
                        ? 'hover:shadow-md hover:ring-1 hover:ring-gray-300' 
                        : 'opacity-60 cursor-not-allowed'
                  }`}
                  onClick={() => affordable && setSelectedOption(option)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg leading-tight">{option.name}</CardTitle>
                      <div className="text-right">
                        <div className="text-sm text-gray-500 flex items-center justify-end">
                          <span className={`flag-icon flag-icon-${getCountryFlag(option.country)} mr-1`}></span>
                          {option.country}
                        </div>
                        <div className="text-xs text-gray-400">{option.region}</div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    {/* Size and Price */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Size:</span>
                      <span className="text-sm">{option.hectares} ha</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Price/ha:</span>
                      <span className="text-sm">{formatCurrency(option.landValue)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-sm font-bold">Total Price:</span>
                      <span className={`text-sm font-bold ${affordable ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(option.totalPrice)}
                      </span>
                    </div>

                    {/* Characteristics */}
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Soil:</span>
                        <span className="text-xs text-gray-800">{option.soil.join(', ')}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Altitude:</span>
                        <span className="text-xs text-gray-800">{option.altitude}m</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Aspect:</span>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-800">{option.aspect}</span>
                          {(() => {
                            const colors = getBadgeColorClasses(option.aspectRating);
                            return (
                              <Badge 
                                variant="secondary" 
                                className={`text-xs px-1 py-0 ${colors.text} ${colors.bg}`}
                              >
                                {formatNumber(option.aspectRating, { decimals: 2, forceDecimals: true })}
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Affordability Status */}
                    {!affordable && (
                      <div className="text-xs text-red-600 text-center pt-2 border-t">
                        Insufficient funds
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Purchase Button */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={!selectedOption || !canAfford(selectedOption)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {selectedOption 
                ? `Purchase ${selectedOption.name} - ${formatCurrency(selectedOption.totalPrice)}`
                : 'Select a Property'
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LandBuyingModal;
