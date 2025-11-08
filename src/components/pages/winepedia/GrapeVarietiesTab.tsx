import { useState } from 'react';
import { GridCard } from '@/components/ui';
import { generateDefaultCharacteristics } from '@/lib/services/wine/characteristics/defaultCharacteristics';
import { GRAPE_CONST } from '@/lib/constants';
import { calculateGrapeDifficulty } from '@/lib/services';
import { GrapeInfoView } from './GrapeInfoView';
import { GrapeVariety } from '@/lib/types/types';
import { GrapeIcon } from '@/lib/utils/icons';
import { formatNumber, getColorClass } from '@/lib/utils';

export function GrapeVarietiesTab() {
  const [selectedGrape, setSelectedGrape] = useState<GrapeVariety | null>(null);

  const grapeVarieties = Object.values(GRAPE_CONST).map(grape => {
    const variety = grape.name as GrapeVariety;
    const difficulty = calculateGrapeDifficulty(variety);

    return {
      name: variety,
      description: grape.description,
      characteristics: generateDefaultCharacteristics(variety),
      difficulty,
    };
  });

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
                variety={grape.name} 
                size="xl" 
                className="w-16 h-16"
                rounded={true}
              />
            }
            title={grape.name}
            onClick={() => setSelectedGrape(grape.name)}
          >
            <p className="text-gray-600">{grape.description}</p>
            <div className={`text-sm font-semibold ${getColorClass(grape.difficulty.score)} mt-2`}>
              Difficulty: {grape.difficulty.tier.toUpperCase()} · {formatNumber(grape.difficulty.score, { percent: true, percentIsDecimal: true, decimals: 0 })}
            </div>
            <div className="text-sm text-blue-600 font-medium">Click to view details →</div>
          </GridCard>
        ))}
      </div>
    </div>
  );
}
