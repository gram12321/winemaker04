import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from '@/lib/utils/formatUtils';
import { loadTransactions, Transaction } from '@/lib/services/financeService';
import { formatGameDate } from '@/lib/types';

export function CashFlowView() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const loadedTransactions = await loadTransactions();
        setTransactions(loadedTransactions);
      } catch (error) {
        console.error('Error loading transactions:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading transaction history...</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-3">Cash Flow Statement</h2>
      
      {transactions.length > 0 ? (
        <div className="border border-gray-300 rounded-md overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="text-gray-800">Date</TableHead>
                <TableHead className="text-gray-800">Type</TableHead>
                <TableHead className="text-gray-800">Description</TableHead>
                <TableHead className="text-right text-gray-800">Amount (€)</TableHead>
                <TableHead className="text-right text-gray-800">Balance (€)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id} className="hover:bg-gray-50">
                  <TableCell className="text-sm">{formatGameDate(transaction.date)}</TableCell>
                  <TableCell>
                    <span className={`text-sm ${transaction.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {transaction.amount >= 0 ? "Income" : "Expense"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{transaction.description}</TableCell>
                  <TableCell className={`text-sm text-right ${transaction.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {transaction.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                  </TableCell>
                  <TableCell className="text-sm text-right font-medium">
                    {formatCurrency(transaction.balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-10 text-gray-500 border border-gray-300 rounded-md">
          <p className="text-lg mb-2">📊 No Transaction History</p>
          <p className="text-sm">Your financial transactions will appear here as you play.</p>
        </div>
      )}
    </div>
  );
}
