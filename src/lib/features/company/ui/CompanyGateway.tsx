import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { Building2, User, UserPlus } from 'lucide-react';
import { Button, Card, CardContent, Input, Label, Switch } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/utils';
import type { CompanyGatewayInput, CompanyRecord } from '../featureTypes';

function formatLastPlayed(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(date);
}

function CompanyCard({ company, deleting, onSelect, onDelete }: {
  company: CompanyRecord;
  deleting: boolean;
  onSelect(company: CompanyRecord): void;
  onDelete(companyId: string, event: MouseEvent<HTMLButtonElement>): void;
}) {
  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardContent className="p-3">
        <div className="flex justify-between items-start">
          <button type="button" className="flex-1 cursor-pointer text-left" onClick={() => onSelect(company)}>
            <h4 className="font-medium">{company.name}</h4>
            <p className="text-xs text-muted-foreground">Week {company.currentWeek}, {company.currentSeason} {company.currentYear}</p>
            <p className="text-xs">{formatNumber(company.money, { currency: true, decimals: 0 })}</p>
          </button>
          <div className="flex items-center gap-2">
            <div className="text-right text-[10px] text-muted-foreground">{formatLastPlayed(company.lastPlayed)}</div>
            <button
              type="button"
              onClick={(event) => onDelete(company.id, event)}
              className={`p-1 rounded hover:bg-destructive/10 transition-colors text-xs ${deleting ? 'text-destructive animate-pulse bg-destructive/10' : 'text-muted-foreground'}`}
              title={deleting ? 'Click again to confirm deletion' : 'Delete company'}
            >
              🗑️
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompanyGateway({
  companies,
  unownedCompanies,
  showUnownedCompanies,
  currentOwnerId,
  isLoading = false,
  onCompanySelected,
  onCompanyCreated,
  onCompanyDeleted,
}: CompanyGatewayInput) {
  const listedCompanies = showUnownedCompanies ? unownedCompanies : companies;
  const [isCreating, setIsCreating] = useState(listedCompanies.length === 0);
  const [companyName, setCompanyName] = useState('');
  const [createPlayer, setCreatePlayer] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const canCreatePlayer = !currentOwnerId && !showUnownedCompanies;

  useEffect(() => {
    if (listedCompanies.length === 0) setIsCreating(true);
  }, [listedCompanies.length]);

  const closeCreate = () => {
    setIsCreating(false);
    setCompanyName('');
    setCreatePlayer(false);
    setPlayerName('');
    setError('');
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const result = await onCompanyCreated({
      name: companyName.trim(),
      createPlayerName: createPlayer ? playerName.trim() : undefined,
    });
    if (!result.success || !result.company) {
      setError(result.error || 'Failed to create company');
      return;
    }
    closeCreate();
  };

  const remove = async (companyId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (deletingCompanyId !== companyId) {
      setDeletingCompanyId(companyId);
      window.setTimeout(() => setDeletingCompanyId(null), 5000);
      return;
    }
    setError('');
    const result = await onCompanyDeleted(companyId);
    if (!result.success) {
      setError(result.error || 'Failed to delete company');
      setDeletingCompanyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {listedCompanies.length > 0 && !isCreating && (
        <div>
          <h3 className="font-medium mb-2">{showUnownedCompanies ? 'Unassigned Companies' : 'Recent Companies'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {listedCompanies.map((company) => (
              <CompanyCard key={company.id} company={company} deleting={deletingCompanyId === company.id} onSelect={onCompanySelected} onDelete={remove} />
            ))}
          </div>
        </div>
      )}

      <div className="pt-3 border-t">
        {!isCreating ? (
          <Button type="button" onClick={() => setIsCreating(true)} className="w-full border-wine text-wine hover:bg-wine hover:text-white text-sm" variant="outline">
            <Building2 className="h-4 w-4 mr-2" />
            {showUnownedCompanies ? 'Create Company Without User' : 'Create New Company'}
          </Button>
        ) : (
          <form onSubmit={create} className="space-y-3">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Enter company name" required />
            </div>
            {canCreatePlayer && (
              <>
                <div className="flex items-center space-x-3 p-2.5 bg-gray-50 rounded-lg border">
                  <Switch id="createUser" checked={createPlayer} onCheckedChange={setCreatePlayer} />
                  <Label htmlFor="createUser" className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                    {createPlayer ? <User className="h-3.5 w-3.5 text-wine" /> : <UserPlus className="h-3.5 w-3.5 text-gray-500" />}
                    Create a user profile?
                  </Label>
                </div>
                {createPlayer && (
                  <div className="p-2.5 bg-wine/5 rounded-lg border border-wine/20">
                    <Label htmlFor="companyOwnerName" className="text-xs font-medium text-wine">User Name</Label>
                    <Input id="companyOwnerName" value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Enter your username" required className="mt-1 border-wine/30 focus:border-wine focus:ring-wine/20 text-sm" />
                  </div>
                )}
              </>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading} className="bg-wine hover:bg-wine-dark text-white text-sm">{isLoading ? 'Creating...' : 'Start'}</Button>
              {(listedCompanies.length > 0 || showUnownedCompanies) && <Button type="button" variant="outline" onClick={closeCreate} className="border-wine text-wine hover:bg-wine hover:text-white text-sm">Cancel</Button>}
            </div>
          </form>
        )}
      </div>
      {error && <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-md">{error}</div>}
    </div>
  );
}
