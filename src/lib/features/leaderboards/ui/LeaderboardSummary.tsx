import { Card, CardContent } from '@/components/ui';
import { Trophy } from 'lucide-react';
import type { HighscoreEntry } from '@/lib/database';
import { formatNumber } from '@/lib/utils';

export interface LeaderboardSummaryProps {
  entries: HighscoreEntry[];
  title: string;
  isLoading?: boolean;
}

export function LeaderboardSummary({ entries, title, isLoading = false }: LeaderboardSummaryProps) {
  return <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl"><CardContent className="p-3">
    <div className="font-semibold text-sm mb-2 flex items-center gap-1 text-wine"><Trophy className="h-4 w-4" />{title}</div>
    {isLoading ? <div className="text-xs text-muted-foreground">Loading...</div> : entries.length === 0 ? <div className="text-xs text-muted-foreground">No data</div> : <div className="space-y-1">
      {entries.map((entry, index) => <div key={entry.id} className="flex justify-between text-xs"><span className="truncate max-w-[100px]">{index + 1}. {entry.companyName}</span><span className="font-medium">{formatNumber(entry.scoreValue, { currency: true, decimals: 0 })}</span></div>)}
    </div>}
  </CardContent></Card>;
}
