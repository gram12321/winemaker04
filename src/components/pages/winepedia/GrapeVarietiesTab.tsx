import { useState } from 'react';
import { GridCard } from '@/components/ui';
import { generateDefaultCharacteristics } from '@/lib/services/wine/characteristics/defaultCharacteristics';
import { GRAPE_CONST } from '@/lib/constants';
import { GrapeInfoView } from './GrapeInfoView';
import { GrapeVariety } from '@/lib/types/types';
import { GrapeIcon } from '@/lib/utils/icons';

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
        isOpen={true}
        onClose={() => setSelectedGrape(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {grapeVarieties.map((grape, index) => (
          <GridCard
            key={index}
            icon={
              <GrapeIcon 
                variety={grape.name as GrapeVariety} 
                size="xl" 
                className="w-16 h-16"
                rounded={true}
              />
            }
            title={grape.name}
            onClick={() => setSelectedGrape(grape.name as GrapeVariety)}
          >
            <p className="text-gray-600">{grape.description}</p>
            <div className="text-sm text-blue-600 font-medium">Click to view details →</div>
          </GridCard>
        ))}
      </div>
    </div>
  );
}
