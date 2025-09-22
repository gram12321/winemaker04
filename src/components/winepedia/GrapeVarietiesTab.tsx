import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui';
import { generateDefaultCharacteristics } from '@/lib/services/wine/balanceCalculator';
import { GRAPE_CONST } from '@/lib/constants';
import { GrapeInfoView } from './GrapeInfoView';
import { GrapeVariety } from '@/lib/types';

export function GrapeVarietiesTab() {
  const [selectedGrape, setSelectedGrape] = useState<GrapeVariety | null>(null);

  // Grape varieties with characteristics (using unified constants)
  const grapeVarieties = Object.values(GRAPE_CONST).map(grape => ({
    name: grape.name,
    description: grape.description,
    characteristics: generateDefaultCharacteristics(grape.name)
  }));

  if (selectedGrape) {
    return (
      <GrapeInfoView 
        grapeName={selectedGrape} 
        onClose={() => setSelectedGrape(null)} 
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {grapeVarieties.map((grape, index) => (
        <Card 
          key={index} 
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => setSelectedGrape(grape.name as GrapeVariety)}
        >
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-700 font-bold">{grape.name.charAt(0)}</span>
            </div>
            <CardTitle>{grape.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">{grape.description}</p>
            <div className="text-sm text-blue-600 font-medium">Click to view details →</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
