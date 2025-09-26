import { useState } from 'react';
import { GridCard } from '../ui';
import { generateDefaultCharacteristics } from '@/lib/services/wine/balanceCalculator';
import { GRAPE_CONST } from '@/lib/constants';
import { GrapeInfoView } from './GrapeInfoView';
import { GrapeVariety } from '@/lib/types/types';

export function GrapeVarietiesTab() {
  const [selectedGrape, setSelectedGrape] = useState<GrapeVariety | null>(null);

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
        <GridCard
          key={index}
          icon={grape.name.charAt(0)}
          title={grape.name}
          onClick={() => setSelectedGrape(grape.name as GrapeVariety)}
          iconBgColor="bg-red-100"
          iconTextColor="text-red-700"
        >
          <p className="text-gray-600">{grape.description}</p>
          <div className="text-sm text-blue-600 font-medium">Click to view details →</div>
        </GridCard>
      ))}
    </div>
  );
}
