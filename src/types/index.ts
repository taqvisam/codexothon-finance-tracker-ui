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
  transferAccountId?: string;
  type: TransactionType;
  amount: number;
  date: string;
  merchant?: string;
  note?: string;
  paymentMethod?: string;
  tags?: string[];
  alerts?: string[];
}

export interface BudgetItem {
  id: string;
  accountId?: string | null;
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
  targetDate?: string | null;
  linkedAccountId?: string | null;
  icon?: string | null;
  color?: string | null;
  progressPercent: number;
  status?: string;
}
