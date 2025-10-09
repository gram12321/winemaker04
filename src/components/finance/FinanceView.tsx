import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button, Separator } from "@/components/ui";
import { IncomeBalanceView } from './IncomeBalanceView';
import { CashFlowView } from './CashFlowView';
import { UpgradesPlaceholder } from './UpgradesPlaceholder';
import { StaffWageSummary } from './StaffWageSummary';
import { FINANCE_TAB_STYLES, FINANCE_BUTTON_STYLES } from '@/lib/constants';

export default function FinanceView() {
  const [activeTab, setActiveTab] = useState('income');
  const [activePeriod, setActivePeriod] = useState<'weekly' | 'season' | 'year'>('weekly');

  return (
    <div className="space-y-6">
      <div 
        className="h-48 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-900 to-transparent p-4">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-white text-2xl font-semibold flex items-center gap-3">
                <span className="text-2xl">💰</span>
                Finance Management
              </h2>
              <p className="text-white/90 text-sm mt-1">Track your financial performance and growth</p>
            </div>
            <div className="text-white/80 text-sm">
              {activeTab === 'income' ? 'Income & Balance' : activeTab === 'cashflow' ? 'Cash Flow' : 'Research & Upgrades'}
            </div>
          </div>
        </div>
      </div>
      
      <Tabs defaultValue="income" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent p-0 mb-4 space-x-2">
          <TabsTrigger 
            value="income" 
            className={`${FINANCE_TAB_STYLES.trigger} ${activeTab === 'income' ? FINANCE_TAB_STYLES.active : FINANCE_TAB_STYLES.inactive}`}>
            Income/Balance
          </TabsTrigger>
          <TabsTrigger 
            value="cashflow" 
            className={`${FINANCE_TAB_STYLES.trigger} ${activeTab === 'cashflow' ? FINANCE_TAB_STYLES.active : FINANCE_TAB_STYLES.inactive}`}>
            Cash Flow
          </TabsTrigger>
          <TabsTrigger 
            value="upgrades" 
            className={`${FINANCE_TAB_STYLES.trigger} ${activeTab === 'upgrades' ? FINANCE_TAB_STYLES.active : FINANCE_TAB_STYLES.inactive}`}>
            Research and Upgrades
          </TabsTrigger>
        </TabsList>

        {activeTab === 'income' && (
          <div className="mb-4 flex space-x-2">
            <Button 
              onClick={() => setActivePeriod('weekly')} 
              className={`${FINANCE_BUTTON_STYLES.period} ${activePeriod === 'weekly' ? FINANCE_BUTTON_STYLES.periodActive : FINANCE_BUTTON_STYLES.periodInactive}`}>
              Weekly
            </Button>
            <Button 
              onClick={() => setActivePeriod('season')} 
              className={`${FINANCE_BUTTON_STYLES.period} ${activePeriod === 'season' ? FINANCE_BUTTON_STYLES.periodActive : FINANCE_BUTTON_STYLES.periodInactive}`}>
              Season
            </Button>
            <Button 
              onClick={() => setActivePeriod('year')} 
              className={`${FINANCE_BUTTON_STYLES.period} ${activePeriod === 'year' ? FINANCE_BUTTON_STYLES.periodActive : FINANCE_BUTTON_STYLES.periodInactive}`}>
              Year
            </Button>
          </div>
        )}

        <Separator className="mb-6 bg-gray-300" />

        <TabsContent value="income">
          <div className="space-y-6">
            <IncomeBalanceView period={activePeriod} />
            <StaffWageSummary />
          </div>
        </TabsContent>
        <TabsContent value="cashflow">
          <CashFlowView />
        </TabsContent>
        <TabsContent value="upgrades">
          <UpgradesPlaceholder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
