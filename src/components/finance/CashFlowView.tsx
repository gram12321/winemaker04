import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadCN/table";
import { SimpleCard } from "@/components/ui";
import { formatCurrency, formatGameDateFromObject, getColorClass } from '@/lib/utils';
import { loadTransactions } from '@/lib/services';
import { Transaction } from '@/lib/types/types';
import { useGameStateWithData } from '@/hooks';

export function CashFlowView() {
  const transactions = useGameStateWithData(
    () => loadTransactions(), 
    [] as Transaction[]
  );

  return (
    <SimpleCard
      title="Cash Flow Statement"
      description="Detailed transaction history and cash flow tracking"
    >
        {transactions.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block border border-gray-300 rounded-md overflow-hidden">
              <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-gray-800">Date</TableHead>
                  <TableHead className="text-gray-800">Type</TableHead>
                  <TableHead className="text-gray-800">Description</TableHead>
                  <TableHead className="text-right text-gray-800">Amount (€)</TableHead>
                  <TableHead className="text-right text-gray-800">Money (€)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-gray-50">
                    <TableCell className="text-sm">{formatGameDateFromObject(transaction.date)}</TableCell>
                    <TableCell>
                      <span className={`text-sm ${getColorClass(transaction.amount >= 0 ? 0.8 : 0.2)}`}>
                        {transaction.amount >= 0 ? "Income" : "Expense"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{transaction.description}</TableCell>
                    <TableCell className={`text-sm text-right ${getColorClass(transaction.amount >= 0 ? 0.8 : 0.2)}`}>
                      {transaction.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {formatCurrency(transaction.money)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                  <div className={`p-4 ${
                    transaction.amount >= 0 ? 'bg-gradient-to-r from-green-50 to-emerald-50' : 'bg-gradient-to-r from-red-50 to-orange-50'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">{formatGameDateFromObject(transaction.date)}</div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          transaction.amount >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.amount >= 0 ? "Income" : "Expense"}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${getColorClass(transaction.amount >= 0 ? 0.8 : 0.2)}`}>
                          {transaction.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 mt-2">{transaction.description}</div>
                  </div>
                  <div className="px-4 py-3 bg-gray-50 border-t flex justify-between items-center">
                    <span className="text-xs text-gray-600">Balance After:</span>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(transaction.money)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-10 text-gray-500 border border-gray-300 rounded-md">
            <p className="text-lg mb-2">📊 No Transaction History</p>
            <p className="text-sm">Your financial transactions will appear here as you play.</p>
          </div>
        )}
    </SimpleCard>
  );
}
