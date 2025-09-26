import { useState, useEffect } from 'react';
import { PageProps } from '../ui/UItypes';
import { GrapeVarietiesTab, WineQualityTab, CustomerTypesTab, CountriesTab, WineRegionsTab, WinemakingTab, MathematicalModelsTab, CustomersTab, YieldProjectionTab, DynamicRangeTab, CrossTraitPenaltyTab } from '../winepedia';

interface WinepediaProps extends PageProps {
  view?: string;
}

export default function Winepedia({ view }: WinepediaProps) {
  const [activeTab, setActiveTab] = useState(view === 'customers' ? 'customers' : 'grapeVarieties');

  useEffect(() => {
    if (view === 'customers') {
      setActiveTab('customers');
    }
  }, [view]);

  const tabs = [
    { id: 'grapeVarieties', label: 'Grape Varieties', component: GrapeVarietiesTab },
    { id: 'wineQuality', label: 'Wine Quality', component: WineQualityTab },
    { id: 'dynamicRange', label: 'Dynamic Range', component: DynamicRangeTab },
    { id: 'crossTraitPenalty', label: 'Cross-Trait Penalty', component: CrossTraitPenaltyTab },
    { id: 'customerTypes', label: 'Customer Types', component: CustomerTypesTab },
    { id: 'countries', label: 'Countries', component: CountriesTab },
    { id: 'wineRegions', label: 'Wine Regions', component: WineRegionsTab },
    { id: 'winemaking', label: 'Winemaking', component: WinemakingTab },
    { id: 'mathematicalModels', label: 'Mathematical Models', component: MathematicalModelsTab },
    { id: 'yieldProjection', label: 'Yield Projection', component: YieldProjectionTab },
    { id: 'customers', label: 'Customers', component: CustomersTab }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || GrapeVarietiesTab;

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Wine-Pedia</h1>
      
      <div className="space-y-6">
        {/* Navigation tabs */}
        <div className="flex space-x-1 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <ActiveComponent />
      </div>
    </div>
  );
}
