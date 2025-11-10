import { useState } from 'react';
import { GridCard, UnifiedTooltip, tooltipStyles } from '@/components/ui';
import { generateDefaultCharacteristics } from '@/lib/services/wine/characteristics/defaultCharacteristics';
import { GRAPE_CONST } from '@/lib/constants';
import { calculateGrapeDifficulty } from '@/lib/services';
import { GrapeInfoView } from '../../ui/modals/UImodals/winepediaGrapeInfoModal';
import { GrapeVariety } from '@/lib/types/types';
import { GrapeIcon } from '@/lib/utils/icons';
import { formatNumber, getColorClass, getGrapeDifficultyCategory, getGrapeDifficultyDescription } from '@/lib/utils';

export function GrapeVarietiesTab() {
  const [selectedGrape, setSelectedGrape] = useState<GrapeVariety | null>(null);

  const grapeVarieties = Object.values(GRAPE_CONST).map(grape => {
    const variety = grape.name as GrapeVariety;
    const difficulty = calculateGrapeDifficulty(variety);

    const difficultyCategory = getGrapeDifficultyCategory(difficulty.score);
    const difficultyDescription = getGrapeDifficultyDescription(difficulty.score);

    return {
      name: variety,
      description: grape.description,
      characteristics: generateDefaultCharacteristics(variety),
      difficulty,
      difficultyCategory,
      difficultyDescription,
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
              />
            }
            title={grape.name}
            onClick={() => setSelectedGrape(grape.name)}
          >
            <p className="text-gray-600">{grape.description}</p>
            <UnifiedTooltip
              title="Grape Difficulty"
              content={<div className={tooltipStyles.text}>{grape.difficultyDescription}</div>}
              side="top"
              sideOffset={6}
              variant="panel"
              density="compact"
            >
              <div className="text-sm font-semibold mt-2 cursor-help inline-flex items-center gap-2">
                <span>Grape Difficulty:</span>
                <span>{grape.difficultyCategory}</span>
                <span className={getColorClass(grape.difficulty.score)}>
                  {formatNumber(grape.difficulty.score, { percent: true, percentIsDecimal: true, decimals: 0 })}
                </span>
              </div>
            </UnifiedTooltip>
            <div className="text-sm text-blue-600 font-medium">Click to view details →</div>
          </GridCard>
        ))}
      </div>
    </div>
  );
}
