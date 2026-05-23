import { useState, useEffect, useMemo, type ComponentType } from 'react';
import { PageProps } from '@/lib/types/UItypes';
import {
  GrapeVarietiesTab,
  WineQualityTab,
  CustomerTypesTab,
  CountriesTab,
  WineRegionsTab,
  WinemakingTab,
  MathematicalModelsTab,
  CustomersTab,
  YieldProjectionTab,
  DynamicRangeTab,
  CrossTraitPenaltyTab,
  EconomyTab,
  WeatherTab,
  GrapeBuyersTab,
  ResearchTab
} from '@/components/pages/winepedia/index';
import { getBoardShareFeature } from '@/lib/features/boardShare';
import { getLoanLenderFeature } from '@/lib/features/loanLender';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';

interface WinepediaTab {
  id: string;
  label: string;
  component: ComponentType;
}

interface WinepediaProps extends PageProps {
  view?: string;
}

export default function Winepedia({ view }: WinepediaProps) {
  const [activeTab, setActiveTab] = useState(view === 'customers' ? 'customers' : 'grapeVarieties');
  const loanLenderTabs = useMemo(() => getLoanLenderFeature().ui.getWinepediaTabs(), []);
  const boardShareTabs = useMemo(() => getBoardShareFeature().ui.getWinepediaTabs(), []);

  const tabs = useMemo<WinepediaTab[]>(() => {
    const baseTabs: WinepediaTab[] = [
      { id: 'grapeVarieties', label: 'Grape Variety', component: GrapeVarietiesTab },
      { id: 'customers', label: 'Customers', component: CustomersTab },
      { id: 'yieldProjection', label: 'Yield Production', component: YieldProjectionTab },
      { id: 'landValueModifier', label: 'Land Value Modifier', component: WineQualityTab },
      { id: 'dynamicRange', label: 'Dynamic Range', component: DynamicRangeTab },
      { id: 'crossTraitPenalty', label: 'Cross-Trait Penalty', component: CrossTraitPenaltyTab },
      { id: 'customerTypes', label: 'Customer Types', component: CustomerTypesTab },
      { id: 'countries', label: 'Countries', component: CountriesTab },
      { id: 'wineRegions', label: 'Wine Regions', component: WineRegionsTab },
      { id: 'winemaking', label: 'Winemaking', component: WinemakingTab },
      { id: 'mathematicalModels', label: 'Mathematical Models', component: MathematicalModelsTab },
      { id: 'research', label: 'Research', component: ResearchTab },
      { id: 'grapeBuyers', label: 'Grape Buyers', component: GrapeBuyersTab },
      { id: 'economy', label: 'Economy', component: EconomyTab },
      { id: 'weather', label: 'Weather', component: WeatherTab },
      ...loanLenderTabs.map((tab) => ({ id: tab.id, label: tab.label, component: tab.component })),
      ...boardShareTabs.map((tab) => ({ id: tab.id, label: tab.label, component: tab.component }))
    ];

    return baseTabs.sort((a, b) => a.label.localeCompare(b.label));
  }, [boardShareTabs, loanLenderTabs]);

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
    } catch {
      // no-op
    }
  }, [view]);

  useEffect(() => {
    const availableTabIds = new Set(tabs.map((tab) => tab.id));
    if (!availableTabIds.has(activeTab)) {
      setActiveTab('grapeVarieties');
    }
  }, [activeTab, tabs]);

  const orderedTabs = useMemo(() => {
    const active = tabs.find((tab) => tab.id === activeTab) || null;
    const inactive = tabs.filter((tab) => tab.id !== activeTab);
    return active ? [active, ...inactive] : tabs;
  }, [activeTab, tabs]);

  const ActiveComponent = tabs.find((tab) => tab.id === activeTab)?.component || GrapeVarietiesTab;

  return (
    <div className="mx-auto max-w-[1120px] py-4 text-sm">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Wine-Pedia</CardTitle>
            <CardDescription>Mechanics-first reference for formulas, ranges, progression, and market systems.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {orderedTabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{tabs.find((tab) => tab.id === activeTab)?.label || 'Wine-Pedia'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ActiveComponent />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
