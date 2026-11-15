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
  WineAnchorsTab
} from '@/components/pages/winepedia/index';
import { loanLenderFeature } from '@/lib/features/loanLender';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';

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
  const loanLenderTabs = useMemo(() => loanLenderFeature.ui.getWinepediaTabs(), []);
  const tabs = useMemo<WinepediaTab[]>(() => {
    const baseTabs: WinepediaTab[] = [
      { id: 'grapeVarieties', label: 'Grape Variety', component: GrapeVarietiesTab },
      { id: 'customers', label: 'Customers', component: CustomersTab },
      { id: 'yieldProjection', label: 'Yield Production', component: YieldProjectionTab },
      { id: 'landValueModifier', label: 'Wine Quality & Value', component: WineQualityTab },
      { id: 'dynamicRange', label: 'Dynamic Range', component: DynamicRangeTab },
      { id: 'crossTraitPenalty', label: 'Cross-Trait Penalty', component: CrossTraitPenaltyTab },
      { id: 'customerTypes', label: 'Customer Types', component: CustomerTypesTab },
      { id: 'countries', label: 'Countries', component: CountriesTab },
      { id: 'wineRegions', label: 'Wine Regions', component: WineRegionsTab },
      { id: 'wineAnchors', label: 'Wine Anchors', component: WineAnchorsTab },
      { id: 'winemaking', label: 'Winemaking', component: WinemakingTab },
      { id: 'mathematicalModels', label: 'Mathematical Models', component: MathematicalModelsTab },
      { id: 'grapeBuyers', label: 'Grape Buyers', component: GrapeBuyersTab },
      { id: 'economy', label: 'Economy', component: EconomyTab },
      { id: 'weather', label: 'Weather', component: WeatherTab },
      ...loanLenderTabs.map((tab) => ({ id: tab.id, label: tab.label, component: tab.component }))
    ];

    return baseTabs.sort((a, b) => a.label.localeCompare(b.label));
  }, [loanLenderTabs]);

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
    <div className="mx-auto min-w-0 max-w-[1120px] py-4 text-sm break-words [&_input]:min-w-0 [&_select]:min-w-0 [&_.grid>*]:min-w-0">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Wine-Pedia</CardTitle>
            <CardDescription>Mechanics-first reference for formulas, ranges, progression, and market systems.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 px-3 pt-0 sm:px-6">
            <div className="lg:hidden">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="min-h-11 w-full" aria-label="Choose Wine-Pedia section">
                  <SelectValue placeholder="Choose a section" />
                </SelectTrigger>
                <SelectContent className="max-h-[min(60dvh,24rem)]">
                  {tabs.map((tab) => <SelectItem key={tab.id} value={tab.id}>{tab.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden flex-wrap gap-2 lg:flex">
              {orderedTabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  size="sm"
                  className="min-h-11 h-auto whitespace-normal text-left"
                  aria-pressed={activeTab === tab.id}
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
          <CardContent className="min-w-0 px-3 pt-0 sm:px-6">
            <ActiveComponent />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
