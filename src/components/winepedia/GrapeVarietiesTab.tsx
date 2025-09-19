import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, WineCharacteristicsDisplay } from '../ui';
import { generateDefaultCharacteristics } from '@/lib/services/wine/balanceCalculator';
import { GRAPE_VARIETY_INFO } from '@/lib/constants/constants';

export function GrapeVarietiesTab() {
  // Grape varieties with characteristics (using constants)
  const grapeVarieties = GRAPE_VARIETY_INFO.map(grape => ({
    name: grape.name,
    description: grape.description,
    characteristics: generateDefaultCharacteristics(grape.name)
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {grapeVarieties.map((grape, index) => (
        <Card 
          key={index} 
          className="hover:shadow-md transition-shadow cursor-pointer"
        >
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-700 font-bold">{grape.name.charAt(0)}</span>
            </div>
            <CardTitle>{grape.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">{grape.description}</p>
            <WineCharacteristicsDisplay 
              characteristics={grape.characteristics} 
              collapsible={true}
              defaultExpanded={false}
              title="Wine Characteristics"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
