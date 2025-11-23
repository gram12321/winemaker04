import { useState, useEffect } from 'react';
import { GridCard, UnifiedTooltip, tooltipStyles } from '@/components/ui';
import { generateDefaultCharacteristics } from '@/lib/services/wine/characteristics/defaultCharacteristics';
import { GRAPE_CONST } from '@/lib/constants';
import { calculateGrapeDifficulty } from '@/lib/services';
import { GrapeInfoView } from '../../ui/modals/UImodals/winepediaGrapeInfoModal';
import { GrapeVariety } from '@/lib/types/types';
import { GrapeIcon } from '@/lib/utils/icons';
import { formatNumber, getColorClass, getGrapeDifficultyCategory, getGrapeDifficultyDescription, getUnlockedGrapes, getGrapeUnlockResearchId } from '@/lib/utils';

export function GrapeVarietiesTab() {
  const [selectedGrape, setSelectedGrape] = useState<GrapeVariety | null>(null);
  const [unlockedGrapes, setUnlockedGrapes] = useState<GrapeVariety[]>([]);

  // Load unlocked grapes on mount
  useEffect(() => {
    const loadUnlockedGrapes = async () => {
      const unlocked = await getUnlockedGrapes();
      setUnlockedGrapes(unlocked);
    };
    loadUnlockedGrapes();
  }, []);

  const grapeVarieties = Object.values(GRAPE_CONST).map(grape => {
    const variety = grape.name as GrapeVariety;
    const difficulty = calculateGrapeDifficulty(variety);

    const difficultyCategory = getGrapeDifficultyCategory(difficulty.score);
    const difficultyDescription = getGrapeDifficultyDescription(difficulty.score);

    const isUnlocked = unlockedGrapes.includes(variety);
    const unlockResearchId = getGrapeUnlockResearchId(variety);
    
    return {
      name: variety,
      description: grape.description,
      characteristics: generateDefaultCharacteristics(variety),
      difficulty,
      difficultyCategory,
      difficultyDescription,
      isUnlocked,
      unlockResearchId
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
        {grapeVarieties.map((grape, index) => {
          const isLocked = !grape.isUnlocked;
          
          return (
            <GridCard
              key={index}
              icon={
                <GrapeIcon 
                  variety={grape.name} 
                  size="xl" 
                  className={`w-16 h-16 ${isLocked ? 'opacity-50 grayscale' : ''}`}
                />
              }
            title={grape.name}
            description={isLocked ? '🔒 Locked - Complete research to unlock' : undefined}
              onClick={() => setSelectedGrape(grape.name)}
              className={isLocked ? 'opacity-60 cursor-pointer' : ''}
            >
              <p className={`${isLocked ? 'text-gray-400' : 'text-gray-600'}`}>{grape.description}</p>
              {isLocked && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  <strong>Locked:</strong> Complete research project to unlock this grape variety.
                </div>
              )}
              <UnifiedTooltip
                title="Grape Difficulty"
                content={<div className={tooltipStyles.text}>{grape.difficultyDescription}</div>}
                side="top"
                sideOffset={6}
                variant="panel"
                density="compact"
              >
                <div className={`text-sm font-semibold mt-2 cursor-help inline-flex items-center gap-2 ${isLocked ? 'opacity-50' : ''}`}>
                  <span>Grape Difficulty:</span>
                  <span>{grape.difficultyCategory}</span>
                  <span className={getColorClass(grape.difficulty.score)}>
                    {formatNumber(grape.difficulty.score, { percent: true, percentIsDecimal: true, decimals: 0 })}
                  </span>
                </div>
              </UnifiedTooltip>
              <div className={`text-sm font-medium ${isLocked ? 'text-gray-400' : 'text-blue-600'}`}>
                Click to view details →
              </div>
            </GridCard>
          );
        })}
      </div>
    </div>
  );
}
