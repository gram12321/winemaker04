import { useState, useEffect } from 'react';
import { PageProps } from '@/lib/types/UItypes';
import { GrapeVarietiesTab, WineQualityTab, CustomerTypesTab, CountriesTab, WineRegionsTab, WinemakingTab, MathematicalModelsTab, CustomersTab, LendersTab, YieldProjectionTab, DynamicRangeTab, CrossTraitPenaltyTab, EconomyTab } from '@/components/pages/winepedia/index';

interface WinepediaProps extends PageProps {
  view?: string;
}

export default function Winepedia({ view }: WinepediaProps) {
  const [activeTab, setActiveTab] = useState(view === 'customers' ? 'customers' : 'grapeVarieties');

  useEffect(() => {
    if (view === 'customers') {
      setActiveTab('customers');
    }
    try {
      const pendingView = localStorage.getItem('winepedia_view');
      if (pendingView) {
        setActiveTab(pendingView);
        localStorage.removeItem('winepedia_view');
      }
    } catch {}
  }, [view]);

  const tabs = [
    { id: 'grapeVarieties', label: 'Grape Varieties', component: GrapeVarietiesTab },
    { id: 'grapeQuality', label: 'Grape Quality', component: WineQualityTab },
    { id: 'dynamicRange', label: 'Dynamic Range', component: DynamicRangeTab },
    { id: 'crossTraitPenalty', label: 'Cross-Trait Penalty', component: CrossTraitPenaltyTab },
    { id: 'customerTypes', label: 'Customer Types', component: CustomerTypesTab },
    { id: 'countries', label: 'Countries', component: CountriesTab },
    { id: 'wineRegions', label: 'Wine Regions', component: WineRegionsTab },
    { id: 'winemaking', label: 'Winemaking', component: WinemakingTab },
    { id: 'mathematicalModels', label: 'Mathematical Models', component: MathematicalModelsTab },
    { id: 'yieldProjection', label: 'Yield Projection', component: YieldProjectionTab },
    { id: 'customers', label: 'Customers', component: CustomersTab },
    { id: 'lenders', label: 'Lenders', component: LendersTab },
    { id: 'economy', label: 'Economy', component: EconomyTab }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || GrapeVarietiesTab;

  return (
    <div className="mx-auto max-w-[1040px] py-4 text-sm">
      <h1 className="text-xl font-semibold mb-3">Wine-Pedia</h1>
      
      <div className="space-y-3">
        {/* Navigation tabs */}
        <div className="flex space-x-1 border-b text-xs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 font-medium rounded-t-lg ${
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
