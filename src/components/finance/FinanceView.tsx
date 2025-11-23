import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
  Separator,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Label
} from "@/components/ui";
import { IncomeBalanceView } from './IncomeBalanceView';
import { CashFlowView } from './CashFlowView';
import { ResearchPanel } from './ResearchPanel';
import { StaffWageSummary } from './StaffWageSummary';
import { ShareManagementPanel } from './ShareManagementPanel';
import LoansView from './LoansView';
import { FINANCE_TAB_STYLES, FINANCE_BUTTON_STYLES, SEASONS, WEEKS_PER_SEASON, type SeasonName } from '@/lib/constants';
import { useGameState, useGameStateWithData } from '@/hooks';
import { loadTransactions } from '@/lib/services';

export default function FinanceView() {
  const [activeTab, setActiveTab] = useState('income');
  const [activePeriod, setActivePeriod] = useState<'weekly' | 'season' | 'year' | 'all'>('weekly');
  const gameState = useGameState();
  const transactions = useGameStateWithData(loadTransactions, []);

  const currentYear = gameState.currentYear ?? new Date().getFullYear();
  const currentSeason = useMemo<SeasonName>(() => {
    const candidate = gameState.season as SeasonName | undefined;
    return candidate && SEASONS.includes(candidate) ? candidate : 'Spring';
  }, [gameState.season]);
  const currentWeek = useMemo(() => {
    const rawWeek = gameState.week ?? 1;
    return Math.min(Math.max(rawWeek, 1), WEEKS_PER_SEASON);
  }, [gameState.week]);

  const [selectedYear, setSelectedYear] = useState(() => currentYear);
  const [selectedSeason, setSelectedSeason] = useState<SeasonName>(() => currentSeason);
  const [selectedWeek, setSelectedWeek] = useState(() => currentWeek);

  const previousCurrentRef = useRef({
    year: currentYear,
    season: currentSeason,
    week: currentWeek
  });

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    transactions.forEach(transaction => {
      if (transaction.date.year <= currentYear) {
        years.add(transaction.date.year);
      }
    });

    years.add(currentYear);

    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, currentYear]);

  const availableSeasons = useMemo(() => {
    if (selectedYear === currentYear) {
      const currentIndex = SEASONS.indexOf(currentSeason);
      return SEASONS.slice(0, currentIndex + 1);
    }
    return SEASONS;
  }, [selectedYear, currentYear, currentSeason]);

  const availableWeeks = useMemo(() => {
    const limit = selectedYear === currentYear && selectedSeason === currentSeason
      ? currentWeek
      : WEEKS_PER_SEASON;

    const clampedLimit = Math.min(Math.max(limit, 1), WEEKS_PER_SEASON);

    return Array.from({ length: clampedLimit }, (_, index) => index + 1);
  }, [selectedYear, selectedSeason, currentYear, currentSeason, currentWeek]);

  const periodFilters = useMemo(() => ({
    year: selectedYear,
    season: selectedSeason,
    week: selectedWeek
  }), [selectedYear, selectedSeason, selectedWeek]);

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0] ?? currentYear);
    }
  }, [availableYears, selectedYear, currentYear]);

  useEffect(() => {
    if (!availableSeasons.includes(selectedSeason)) {
      setSelectedSeason(availableSeasons[availableSeasons.length - 1] ?? currentSeason);
    }
  }, [availableSeasons, selectedSeason, currentSeason]);

  useEffect(() => {
    if (selectedYear === currentYear && selectedSeason === currentSeason) {
      if (selectedWeek > currentWeek) {
        setSelectedWeek(currentWeek);
      }
    } else if (selectedWeek > WEEKS_PER_SEASON) {
      setSelectedWeek(WEEKS_PER_SEASON);
    }
  }, [selectedYear, selectedSeason, currentYear, currentSeason, currentWeek, selectedWeek]);

  useEffect(() => {
    const previous = previousCurrentRef.current;
    const isFollowingCurrentSelection =
      selectedYear === previous.year &&
      selectedSeason === previous.season &&
      selectedWeek === previous.week;

    if (isFollowingCurrentSelection) {
      setSelectedYear(currentYear);
      setSelectedSeason(currentSeason);
      setSelectedWeek(currentWeek);
    }

    previousCurrentRef.current = {
      year: currentYear,
      season: currentSeason,
      week: currentWeek
    };
  }, [currentYear, currentSeason, currentWeek, selectedYear, selectedSeason, selectedWeek]);

  const renderPeriodSelectors = () => {
    if (activePeriod === 'all') {
      return null;
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {(activePeriod === 'weekly' || activePeriod === 'season' || activePeriod === 'year') && (
          <div className="flex flex-col space-y-2">
            <Label htmlFor="finance-year-select" className="text-xs uppercase tracking-wide text-gray-600">
              Year
            </Label>
            <Select
              value={String(selectedYear)}
              onValueChange={(value) => setSelectedYear(Number(value))}
            >
              <SelectTrigger id="finance-year-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(activePeriod === 'weekly' || activePeriod === 'season') && (
          <div className="flex flex-col space-y-2">
            <Label htmlFor="finance-season-select" className="text-xs uppercase tracking-wide text-gray-600">
              Season
            </Label>
            <Select
              value={selectedSeason}
              onValueChange={(value) => setSelectedSeason(value as SeasonName)}
            >
              <SelectTrigger id="finance-season-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableSeasons.map(season => (
                  <SelectItem key={season} value={season}>
                    {season}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {activePeriod === 'weekly' && (
          <div className="flex flex-col space-y-2">
            <Label htmlFor="finance-week-select" className="text-xs uppercase tracking-wide text-gray-600">
              Week
            </Label>
            <Select
              value={String(selectedWeek)}
              onValueChange={(value) => setSelectedWeek(Number(value))}
            >
              <SelectTrigger id="finance-week-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableWeeks.map(week => (
                  <SelectItem key={week} value={String(week)}>
                    Week {week}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

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
              {activeTab === 'income' ? 'Income & Balance' : activeTab === 'cashflow' ? 'Cash Flow' : activeTab === 'loans' ? 'Loans' : activeTab === 'shares' ? 'Share Management' : 'Research & Upgrades'}
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
            value="loans"
            className={`${FINANCE_TAB_STYLES.trigger} ${activeTab === 'loans' ? FINANCE_TAB_STYLES.active : FINANCE_TAB_STYLES.inactive}`}>
            Loans
          </TabsTrigger>
          <TabsTrigger
            value="shares"
            className={`${FINANCE_TAB_STYLES.trigger} ${activeTab === 'shares' ? FINANCE_TAB_STYLES.active : FINANCE_TAB_STYLES.inactive}`}>
            Shares
          </TabsTrigger>
          <TabsTrigger
            value="upgrades"
            className={`${FINANCE_TAB_STYLES.trigger} ${activeTab === 'upgrades' ? FINANCE_TAB_STYLES.active : FINANCE_TAB_STYLES.inactive}`}>
            Research and Upgrades
          </TabsTrigger>
        </TabsList>

        {activeTab === 'income' && (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
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
              <Button
                onClick={() => setActivePeriod('all')}
                className={`${FINANCE_BUTTON_STYLES.period} ${activePeriod === 'all' ? FINANCE_BUTTON_STYLES.periodActive : FINANCE_BUTTON_STYLES.periodInactive}`}>
                All Time
              </Button>
            </div>
            {renderPeriodSelectors()}
          </>
        )}

        <Separator className="mb-6 bg-gray-300" />

        <TabsContent value="income">
          <div className="space-y-6">
            <IncomeBalanceView period={activePeriod} filters={periodFilters} />
            <StaffWageSummary />
          </div>
        </TabsContent>
        <TabsContent value="cashflow">
          <CashFlowView />
        </TabsContent>
        <TabsContent value="loans">
          <LoansView />
        </TabsContent>
        <TabsContent value="shares">
          <ShareManagementPanel />
        </TabsContent>
        <TabsContent value="upgrades">
          <ResearchPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
