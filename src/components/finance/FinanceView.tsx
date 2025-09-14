import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { IncomeBalanceView } from './IncomeBalanceView';
import { CashFlowView } from './CashFlowView';
import { UpgradesPlaceholder } from './UpgradesPlaceholder';

export default function FinanceView() {
  // Tab state
  const [activeTab, setActiveTab] = useState('income');
  const [activePeriod, setActivePeriod] = useState<'weekly' | 'season' | 'year'>('weekly');
  
  // Custom styles to match the original look more closely
  const tabTriggerStyle = "px-4 py-2 rounded-md border border-gray-400 text-sm font-medium";
  const activeTabTriggerStyle = "bg-blue-600 text-white border-blue-600";
  const inactiveTabTriggerStyle = "bg-blue-50 text-blue-600 hover:bg-blue-100";

  const periodButtonStyle = "px-4 py-1 rounded-md border border-gray-400 text-sm font-medium";
  const activePeriodButtonStyle = "bg-blue-600 text-white border-blue-600";
  const inactivePeriodButtonStyle = "bg-blue-50 text-blue-600 hover:bg-blue-100";

  return (
    <div className="space-y-6">
      {/* Finance Banner */}
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
            className={`${tabTriggerStyle} ${activeTab === 'income' ? activeTabTriggerStyle : inactiveTabTriggerStyle}`}>
            Income/Balance
          </TabsTrigger>
          <TabsTrigger 
            value="cashflow" 
            className={`${tabTriggerStyle} ${activeTab === 'cashflow' ? activeTabTriggerStyle : inactiveTabTriggerStyle}`}>
            Cash Flow
          </TabsTrigger>
          <TabsTrigger 
            value="upgrades" 
            className={`${tabTriggerStyle} ${activeTab === 'upgrades' ? activeTabTriggerStyle : inactiveTabTriggerStyle}`}>
            Research and Upgrades
          </TabsTrigger>
        </TabsList>

        {/* Period Selection - Only show for Income/Balance */}
        {activeTab === 'income' && (
          <div className="mb-4 flex space-x-2">
            <Button 
              onClick={() => setActivePeriod('weekly')} 
              className={`${periodButtonStyle} ${activePeriod === 'weekly' ? activePeriodButtonStyle : inactivePeriodButtonStyle}`}>
              Weekly
            </Button>
            <Button 
              onClick={() => setActivePeriod('season')} 
              className={`${periodButtonStyle} ${activePeriod === 'season' ? activePeriodButtonStyle : inactivePeriodButtonStyle}`}>
              Season
            </Button>
            <Button 
              onClick={() => setActivePeriod('year')} 
              className={`${periodButtonStyle} ${activePeriod === 'year' ? activePeriodButtonStyle : inactivePeriodButtonStyle}`}>
              Year
            </Button>
          </div>
        )}

        <Separator className="mb-6 bg-gray-300" />

        <TabsContent value="income">
          <IncomeBalanceView period={activePeriod} />
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
