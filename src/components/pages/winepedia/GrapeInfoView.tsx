import { useState } from 'react';
import { GrapeVariety } from '@/lib/types/types';
import { GRAPE_CONST, COUNTRY_REGION_MAP, REGION_GRAPE_SUITABILITY } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, Button, WineCharacteristicsDisplay } from '@/components/ui';
import { DialogProps } from '@/lib/types/UItypes';
import { formatNumber, getColorClass } from '@/lib/utils/utils';

// Utility function for formatting percentage
const formatPercentage = (value: number): string => `${formatNumber(value * 100, { smartDecimals: true })}%`;

interface GrapeInfoViewProps extends DialogProps {
  grapeName: GrapeVariety;
}

export const GrapeInfoView: React.FC<GrapeInfoViewProps> = ({ grapeName, onClose }) => {
  const grapeMetadata = GRAPE_CONST[grapeName];
  const [selectedCountry, setSelectedCountry] = useState<string>(Object.keys(COUNTRY_REGION_MAP)[0]);

  if (!grapeMetadata) {
    return (
      <div className="p-4 text-center text-red-600">
        Error: Grape variety "{grapeName}" not found.
        <Button onClick={onClose} variant="outline" size="sm" className="ml-4">Close</Button>
      </div>
    );
  }

  const baseInfo = [
    { 
      label: 'Grape Color', 
      value: grapeMetadata.grapeColor, 
      valueClass: 'capitalize' 
    },
    { 
      label: 'Natural Yield', 
      value: formatPercentage(grapeMetadata.naturalYield), 
      valueClass: getColorClass(grapeMetadata.naturalYield) 
    },
    { 
      label: 'Grape Fragility', 
      value: formatPercentage(grapeMetadata.fragile), 
      valueClass: getColorClass(1 - grapeMetadata.fragile) // Invert for fragility display
    },
    { 
      label: 'Oxidation Prone', 
      value: formatPercentage(grapeMetadata.proneToOxidation), 
      valueClass: getColorClass(1 - grapeMetadata.proneToOxidation) // Invert for resistance display
    },
  ];

  const suitabilityData = REGION_GRAPE_SUITABILITY[selectedCountry as keyof typeof REGION_GRAPE_SUITABILITY] || {};
  const regions = COUNTRY_REGION_MAP[selectedCountry as keyof typeof COUNTRY_REGION_MAP] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader className="flex flex-row justify-between items-center border-b pb-4">
        <div className="flex items-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
            grapeMetadata.grapeColor === 'red' ? 'bg-red-100' : 'bg-yellow-100'
          }`}>
            <span className={`font-bold ${
              grapeMetadata.grapeColor === 'red' ? 'text-red-700' : 'text-yellow-700'
            }`}>
              {grapeMetadata.name.charAt(0)}
            </span>
          </div>
          <CardTitle className="text-2xl font-bold text-wine">{grapeMetadata.name}</CardTitle>
        </div>
        <Button onClick={onClose} variant="ghost" size="sm">✕</Button>
        </CardHeader>
        
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Base Information */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold mb-2 text-wine-dark">Base Information</h3>
          <table className="w-full text-sm">
            <tbody>
              {baseInfo.map(info => (
                <tr key={info.label} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 text-gray-600">{info.label}</td>
                  <td className={`py-2 font-medium ${info.valueClass || ''}`}>{info.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Grape Characteristics */}
        <div className="space-y-1">
          <h3 className="text-lg font-semibold mb-2 text-wine-dark">Grape Characteristics</h3>
          <WineCharacteristicsDisplay 
            characteristics={grapeMetadata.baseCharacteristics} 
            collapsible={false}
            defaultExpanded={true}
            title=""
          />
        </div>

        {/* Regional Suitability */}
        <div className="md:col-span-2 space-y-3">
          <h3 className="text-lg font-semibold text-wine-dark">Regional Suitability</h3>
          <div className="flex flex-wrap gap-2 border-b pb-3 mb-3">
            {Object.keys(COUNTRY_REGION_MAP).map(country => (
              <Button 
                key={country} 
                variant={selectedCountry === country ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setSelectedCountry(country)}
                className={selectedCountry === country ? 'bg-wine hover:bg-wine-dark' : ''}
              >
                {country}
              </Button>
            ))}
          </div>
          <table className="w-full text-sm">
            <tbody>
              {regions.map(region => {
                const regionSuitability = suitabilityData[region as keyof typeof suitabilityData];
                const suitabilityValue = regionSuitability ? (regionSuitability[grapeName as keyof typeof regionSuitability] ?? 0) : 0;
                return (
                  <tr key={region} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 w-2/3">{region}</td>
                    <td className={`py-2 font-medium text-right ${getColorClass(suitabilityValue)}`}>
                      {formatPercentage(suitabilityValue)}
                    </td>
                  </tr>
                );
              })}
              {(regions as readonly string[]).length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center text-gray-500 py-4">
                    No regions found for {selectedCountry}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GrapeInfoView;
