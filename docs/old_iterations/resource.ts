// src/lib/game/resource.ts
// Remove unused imports
// import { getColorClass } from '@/lib/core/utils/formatUtils';
import { GrapeVariety } from '@/lib/core/constants/vineyardConstants';


// Define the structure for wine characteristics
interface WineCharacteristics {
    acidity: number;
    aroma: number;
    body: number;
    spice: number;
    sweetness: number;
    tannins: number;
}

// Define Resource as an interface
export interface Resource {
    name: GrapeVariety;
    naturalYield: number;
    fragile: number; // Robustness (0-1), lower is more fragile
    proneToOxidation: number; // Susceptibility (0-1), higher is more prone
    grapeColor: 'red' | 'white';
    wineCharacteristics: WineCharacteristics; // Embed characteristics
}

// allResources array with embedded characteristics
export const allResources: Resource[] = [
    {
        name: 'Barbera',
        naturalYield: 1,
        fragile: 1,
        proneToOxidation: 0.4,
        grapeColor: 'red',
        wineCharacteristics: {
            acidity: 0.2, aroma: 0, body: 0.1, spice: 0, sweetness: 0, tannins: 0.1
        }
    },
    {
        name: 'Chardonnay',
        naturalYield: 0.9,
        fragile: 1,
        proneToOxidation: 0.7,
        grapeColor: 'white',
        wineCharacteristics: {
            acidity: -0.1, aroma: 0.15, body: 0.25, spice: 0.0, sweetness: 0, tannins: -0.15
        }
    },
    {
        name: 'Pinot Noir',
        naturalYield: 0.7,
        fragile: 0.4,
        proneToOxidation: 0.8,
        grapeColor: 'red',
        wineCharacteristics: {
            acidity: 0.15, aroma: 0.1, body: -0.15, spice: 0, sweetness: 0, tannins: -0.1
        }
    },
    {
        name: 'Primitivo',
        naturalYield: 0.85,
        fragile: 0.8,
        proneToOxidation: 0.3,
        grapeColor: 'red',
        wineCharacteristics: {
            acidity: 0, aroma: 0.2, body: 0.2, spice: 0, sweetness: 0.2, tannins: 0.2
        }
    },
    {
        name: 'Sauvignon Blanc',
        naturalYield: 0.95,
        fragile: 0.9,
        proneToOxidation: 0.9,
        grapeColor: 'white',
        wineCharacteristics: {
            acidity: 0.3, aroma: 0.25, body: -0.2, spice: 0.1, sweetness: -0.1, tannins: -0.2
        }
    },
];

// getResourceByName function remains the same, but works with the interface
export function getResourceByName(name: GrapeVariety | string): Resource | null {
    // Add type annotation for parameter 'r'
    const resource = allResources.find((r: Resource) => r.name === name);
    return resource || null;
}

// Note: InventoryItem and Inventory classes are not migrated here
// as they seem related to WineBatch management, which is handled differently now. 