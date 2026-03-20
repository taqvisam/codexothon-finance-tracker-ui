export type TransactionType = "Income" | "Expense" | "Transfer";

export interface SummaryMetrics {
  balance: number;
  income: number;
  expense: number;
  savings: number;
}

export interface TransactionItem {
  id: string;
  accountId: string;
  categoryId?: string;
  type: TransactionType;
  amount: number;
  date: string;
  merchant?: string;
  note?: string;
}

export interface BudgetItem {
  id: string;
  categoryId: string;
  month: number;
  year: number;
  amount: number;
  spentAmount: number;
}

export interface GoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progressPercent: number;
  status?: string;
}
