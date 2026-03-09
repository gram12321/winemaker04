import { addTransaction } from './financeService';

export async function recordCashflowEntry(
  amount: number,
  description: string,
  category: string,
  recurring = false,
  companyId?: string
): Promise<string> {
  return addTransaction(amount, description, category, recurring, companyId);
}

export async function recordCashflowDeduction(
  amount: number,
  description: string,
  category: string,
  recurring = false,
  companyId?: string
): Promise<string> {
  return addTransaction(-Math.abs(amount), description, category, recurring, companyId);
}

export async function recordCashflowCredit(
  amount: number,
  description: string,
  category: string,
  recurring = false,
  companyId?: string
): Promise<string> {
  return addTransaction(Math.abs(amount), description, category, recurring, companyId);
}
