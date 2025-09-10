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
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Finance Management</h1>
      
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

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <TabsContent value="income">
            <IncomeBalanceView period={activePeriod} />
          </TabsContent>
          <TabsContent value="cashflow">
            <CashFlowView />
          </TabsContent>
          <TabsContent value="upgrades">
            <UpgradesPlaceholder />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
