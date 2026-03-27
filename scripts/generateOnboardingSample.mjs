import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..", "..");
const uiDir = path.resolve(rootDir, "codexothon-finance-tracker-ui");
const outputTargets = [
  path.resolve(uiDir, "public", "sample-onboarding-import.xlsx"),
  path.resolve(rootDir, "sample-data", "sample-onboarding-import.xlsx")
];

const now = new Date();
const monthWindows = Array.from({ length: 6 }, (_, index) => {
  const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    maxDay: new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  };
});

const accounts = [
  {
    name: "Horizon Checking",
    type: "Bank",
    openingBalance: 42000,
    institutionName: "HDFC Bank"
  },
  {
    name: "Reserve Savings",
    type: "Savings",
    openingBalance: 65000,
    institutionName: "ICICI Bank"
  },
  {
    name: "Atlas Credit Card",
    type: "CreditCard",
    openingBalance: -4500,
    institutionName: "Axis Bank"
  },
  {
    name: "Pocket Cash",
    type: "CashWallet",
    openingBalance: 2500,
    institutionName: "Wallet"
  }
];

const budgets = [];
const budgetTemplates = [
  ["Rent", 20000],
  ["Groceries", 9000],
  ["Dining", 5200],
  ["Transport", 4200],
  ["Utilities", 4300],
  ["Shopping", 6200],
  ["Entertainment", 2400]
];

for (const window of monthWindows) {
  for (const [category, amount] of budgetTemplates) {
    budgets.push({
      category,
      amount,
      month: window.month,
      year: window.year,
      alertThresholdPercent: 80
    });
  }
}

const goals = [
  {
    name: "Emergency Fund",
    targetAmount: 150000,
    currentAmount: 86000,
    targetDate: `${monthWindows[5].year}-12-31`,
    linkedAccountName: "Reserve Savings",
    icon: "target",
    color: "#2ea05f",
    status: "active"
  },
  {
    name: "Japan Escape",
    targetAmount: 90000,
    currentAmount: 24000,
    targetDate: `${monthWindows[5].year + 1}-02-28`,
    linkedAccountName: "Reserve Savings",
    icon: "travel",
    color: "#d9a73c",
    status: "active"
  },
  {
    name: "Laptop Upgrade",
    targetAmount: 120000,
    currentAmount: 32000,
    targetDate: `${monthWindows[5].year}-08-15`,
    linkedAccountName: "Horizon Checking",
    icon: "education",
    color: "#2f6fbe",
    status: "active"
  }
];

const salaryTotals = [70000, 70000, 71000, 72000, 72000, 72000];
const freelanceTotals = [8000, 0, 12000, 9500, 0, 18500];
const bonusTotals = [0, 0, 0, 0, 0, 24000];
const rentTotals = [18000, 18000, 18500, 18500, 19000, 19500];
const utilityTotals = [3200, 3300, 3400, 3500, 3400, 3600];
const groceryTotals = [7600, 7900, 8100, 8000, 7800, 7600];
const diningTotals = [5200, 4800, 5300, 4500, 4200, 2600];
const shoppingTotals = [3600, 4200, 5800, 5100, 3800, 2300];
const transportTotals = [2200, 2400, 2500, 2700, 2600, 2300];
const entertainmentTotals = [1198, 1198, 1497, 1497, 1198, 1198];
const healthTotals = [0, 0, 1800, 0, 0, 1500];
const travelTotals = [0, 0, 0, 0, 0, 21000];
const savingsTransfers = [6000, 6500, 7000, 8000, 8500, 9500];
const cashTopUps = [1500, 1500, 1800, 1800, 1800, 1700];
const creditCardPayments = [6800, 7200, 8400, 7900, 7600, 10800];

const transactions = [];

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateString(year, month, day, maxDay) {
  return `${year}-${pad(month)}-${pad(Math.min(day, maxDay))}`;
}

function splitTotal(total, weights) {
  const raw = weights.map((weight) => Math.round(total * weight));
  const diff = total - raw.reduce((sum, value) => sum + value, 0);
  raw[raw.length - 1] += diff;
  return raw;
}

function addTransaction(row) {
  transactions.push({
    accountName: row.accountName,
    type: row.type,
    amount: row.amount,
    date: row.date,
    category: row.category ?? "",
    transferAccountName: row.transferAccountName ?? "",
    merchant: row.merchant ?? "",
    note: row.note ?? "",
    paymentMethod: row.paymentMethod ?? "",
    tags: Array.isArray(row.tags) ? row.tags.join(", ") : (row.tags ?? "")
  });
}

monthWindows.forEach((window, index) => {
  const { year, month, maxDay } = window;
  const groceries = splitTotal(groceryTotals[index], [0.26, 0.24, 0.27, 0.23]);
  const dining = splitTotal(diningTotals[index], [0.38, 0.31, 0.31]);
  const shopping = splitTotal(shoppingTotals[index], [0.56, 0.44]);
  const transport = splitTotal(transportTotals[index], [0.22, 0.28, 0.24, 0.26]);
  const entertainment = splitTotal(entertainmentTotals[index], [0.58, 0.42]);

  addTransaction({
    accountName: "Horizon Checking",
    type: "Income",
    amount: salaryTotals[index],
    date: dateString(year, month, 1, maxDay),
    category: "Salary",
    merchant: "Amiti Labs Payroll",
    note: "Monthly salary credit",
    paymentMethod: "Bank Transfer",
    tags: ["salary", "fixed-income"]
  });

  if (freelanceTotals[index] > 0) {
    addTransaction({
      accountName: "Horizon Checking",
      type: "Income",
      amount: freelanceTotals[index],
      date: dateString(year, month, 16, maxDay),
      category: "Freelance",
      merchant: "Client Retainer",
      note: "Side project invoice settlement",
      paymentMethod: "Bank Transfer",
      tags: ["freelance", "variable-income"]
    });
  }

  if (bonusTotals[index] > 0) {
    addTransaction({
      accountName: "Horizon Checking",
      type: "Income",
      amount: bonusTotals[index],
      date: dateString(year, month, 19, maxDay),
      category: "Bonus",
      merchant: "Annual Performance Bonus",
      note: "Quarter-end reward payout",
      paymentMethod: "Bank Transfer",
      tags: ["bonus", "career"]
    });
  }

  addTransaction({
    accountName: "Horizon Checking",
    type: "Expense",
    amount: rentTotals[index],
    date: dateString(year, month, 3, maxDay),
    category: "Rent",
    merchant: "Skyline Residency",
    note: "Monthly apartment rent",
    paymentMethod: "Bank Transfer",
    tags: ["housing", "fixed"]
  });

  addTransaction({
    accountName: "Horizon Checking",
    type: "Expense",
    amount: utilityTotals[index],
    date: dateString(year, month, 5, maxDay),
    category: "Utilities",
    merchant: "City Power + FiberNet",
    note: "Electricity and internet bundle",
    paymentMethod: "Auto Debit",
    tags: ["utilities", "fixed"]
  });

  [7, 12, 19, 26].forEach((day, groceryIndex) => {
    addTransaction({
      accountName: "Horizon Checking",
      type: "Expense",
      amount: groceries[groceryIndex],
      date: dateString(year, month, day, maxDay),
      category: "Groceries",
      merchant: groceryIndex % 2 === 0 ? "Fresh Basket" : "Green Cart",
      note: groceryIndex % 2 === 0 ? "Weekly household groceries" : "Produce and dairy run",
      paymentMethod: groceryIndex % 2 === 0 ? "UPI" : "Debit Card",
      tags: ["groceries", "household"]
    });
  });

  addTransaction({
    accountName: "Horizon Checking",
    type: "Transfer",
    amount: cashTopUps[index],
    date: dateString(year, month, 6, maxDay),
    transferAccountName: "Pocket Cash",
    merchant: "Pocket Cash",
    note: "Monthly cash wallet top-up",
    paymentMethod: "Transfer",
    tags: ["cash"]
  });

  addTransaction({
    accountName: "Horizon Checking",
    type: "Transfer",
    amount: savingsTransfers[index],
    date: dateString(year, month, 8, maxDay),
    transferAccountName: "Reserve Savings",
    merchant: "Reserve Savings",
    note: "Move money to savings goal bucket",
    paymentMethod: "Transfer",
    tags: ["savings", "goal"]
  });

  addTransaction({
    accountName: "Horizon Checking",
    type: "Transfer",
    amount: creditCardPayments[index],
    date: dateString(year, month, 27, maxDay),
    transferAccountName: "Atlas Credit Card",
    merchant: "Atlas Credit Card",
    note: "Credit card bill payment",
    paymentMethod: "Transfer",
    tags: ["credit-card", "payment"]
  });

  [9, 14, 21, 28].forEach((day, transportIndex) => {
    addTransaction({
      accountName: "Pocket Cash",
      type: "Expense",
      amount: transport[transportIndex],
      date: dateString(year, month, day, maxDay),
      category: "Transport",
      merchant: transportIndex % 2 === 0 ? "Metro Card" : "Ride Now",
      note: transportIndex % 2 === 0 ? "Local commute top-up" : "Auto and cab rides",
      paymentMethod: "Cash",
      tags: ["transport", "commute"]
    });
  });

  [10, 18, 24].forEach((day, diningIndex) => {
    addTransaction({
      accountName: "Atlas Credit Card",
      type: "Expense",
      amount: dining[diningIndex],
      date: dateString(year, month, day, maxDay),
      category: "Dining",
      merchant: ["Swiggy", "Blue Oven", "Late Night Bowl"][diningIndex],
      note: ["Weekend takeout", "Casual dinner with friends", "Quick dining order"][diningIndex],
      paymentMethod: "Credit Card",
      tags: ["food", "lifestyle"]
    });
  });

  [11, 23].forEach((day, shoppingIndex) => {
    addTransaction({
      accountName: "Atlas Credit Card",
      type: "Expense",
      amount: shopping[shoppingIndex],
      date: dateString(year, month, day, maxDay),
      category: "Shopping",
      merchant: shoppingIndex === 0 ? "UrbanCart" : "Daily Mart",
      note: shoppingIndex === 0 ? "Lifestyle and home essentials" : "Personal care and extras",
      paymentMethod: "Credit Card",
      tags: ["shopping"]
    });
  });

  [13, 20].forEach((day, entertainmentIndex) => {
    addTransaction({
      accountName: "Atlas Credit Card",
      type: "Expense",
      amount: entertainment[entertainmentIndex],
      date: dateString(year, month, day, maxDay),
      category: "Entertainment",
      merchant: entertainmentIndex === 0 ? "Netflix + Prime" : "Spotify + YouTube",
      note: "Digital subscription stack",
      paymentMethod: "Credit Card",
      tags: ["subscription", "entertainment"]
    });
  });

  if (healthTotals[index] > 0) {
    addTransaction({
      accountName: "Atlas Credit Card",
      type: "Expense",
      amount: healthTotals[index],
      date: dateString(year, month, 15, maxDay),
      category: "Health",
      merchant: "CarePlus Clinic",
      note: "Preventive checkup and medicines",
      paymentMethod: "Credit Card",
      tags: ["health"]
    });
  }

  if (travelTotals[index] > 0) {
    addTransaction({
      accountName: "Atlas Credit Card",
      type: "Expense",
      amount: travelTotals[index],
      date: dateString(year, month, 12, maxDay),
      category: "Travel",
      merchant: "SkyHop Holidays",
      note: "Advance booking for upcoming international trip",
      paymentMethod: "Credit Card",
      tags: ["travel", "planned"]
    });
  }
});

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(accounts), "Accounts");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(budgets), "Budgets");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(goals), "Goals");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(transactions), "Transactions");

for (const target of outputTargets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  XLSX.writeFile(workbook, target);
}

console.log(`Generated onboarding workbook with ${transactions.length} transactions across ${monthWindows.length} months.`);
