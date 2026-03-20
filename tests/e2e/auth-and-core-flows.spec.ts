import { expect, test, type Page } from "@playwright/test";

interface MockTransaction {
  id: string;
  accountId: string;
  categoryId?: string;
  type: "Income" | "Expense" | "Transfer";
  amount: number;
  date: string;
  merchant?: string;
  note?: string;
  paymentMethod?: string;
  transferAccountId?: string;
  tags?: string[];
}

interface MockBudget {
  id: string;
  categoryId: string;
  amount: number;
  spentAmount: number;
  month: number;
  year: number;
}

interface MockGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progressPercent: number;
  status: string;
}

async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "pft-auth",
      JSON.stringify({
        state: {
          accessToken: "demo-token",
          refreshToken: "demo-refresh",
          email: "demo@finance.local",
          displayName: "Demo User"
        },
        version: 0
      })
    );
  });
}

async function mockApi(page: Page) {
  const accounts = [{ id: "11111111-1111-1111-1111-111111111111", name: "ABC", type: "Bank", currentBalance: 5000 }];
  const categories = [
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "Food", type: "Expense" },
    { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "Salary", type: "Income" }
  ];
  const transactions: MockTransaction[] = [];
  const budgets: MockBudget[] = [];
  const goals: MockGoal[] = [];

  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    if (path.endsWith("/api/accounts") && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(accounts) });
    }

    if (path.endsWith("/api/categories") && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(categories) });
    }

    if (path.endsWith("/api/transactions") && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(transactions) });
    }

    if (path.endsWith("/api/transactions") && method === "POST") {
      const payload = req.postDataJSON() as Omit<MockTransaction, "id">;
      const created: MockTransaction = { ...payload, id: `tx-${transactions.length + 1}` };
      transactions.unshift(created);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(created) });
    }

    if (path.endsWith("/api/budgets") && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(budgets) });
    }

    if (path.endsWith("/api/budgets") && method === "POST") {
      const payload = req.postDataJSON() as Omit<MockBudget, "id" | "spentAmount">;
      const created: MockBudget = { ...payload, id: `bg-${budgets.length + 1}`, spentAmount: 0 };
      budgets.unshift(created);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(created) });
    }

    if (path.endsWith("/api/goals") && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(goals) });
    }

    if (path.endsWith("/api/goals") && method === "POST") {
      const payload = req.postDataJSON() as { name: string; targetAmount: number };
      const created: MockGoal = {
        id: `goal-${goals.length + 1}`,
        name: payload.name,
        targetAmount: payload.targetAmount,
        currentAmount: 0,
        progressPercent: 0,
        status: "active"
      };
      goals.unshift(created);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(created) });
    }

    if (path.includes("/api/reports/category-spend") && method === "GET") {
      const totalExpense = transactions.filter((x) => x.type === "Expense").reduce((sum, x) => sum + x.amount, 0);
      const rows = totalExpense > 0 ? [{ category: "Food", amount: totalExpense }] : [];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows) });
    }

    if (path.includes("/api/reports/income-vs-expense") && method === "GET") {
      const income = transactions.filter((x) => x.type === "Income").reduce((sum, x) => sum + x.amount, 0);
      const expense = transactions.filter((x) => x.type === "Expense").reduce((sum, x) => sum + x.amount, 0);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ month: "2026-03", income, expense }])
      });
    }

    if (path.includes("/api/reports/account-balance-trend") && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ date: "2026-03-18", accountName: "ABC", balance: 5000 }])
      });
    }

    if (path.endsWith("/api/recurring") && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    if (path.endsWith("/api/profile") && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email: "demo@finance.local", displayName: "Demo User", phoneNumber: "", profileImageUrl: null })
      });
    }

    if (path.endsWith("/api/profile") && method === "PUT") {
      return route.fulfill({ status: 200, contentType: "application/json", body: req.postData() ?? "{}" });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
});

test("transactions create persists to list and reports", async ({ page }) => {
  await seedAuth(page);
  await mockApi(page);

  await page.goto("/transactions");
  await page.getByLabel("Amount").fill("130");
  await page.getByLabel("Merchant").fill("Zomato");
  await page.getByLabel("Note").fill("Dinner");
  await page.getByRole("button", { name: "+ Add Transaction" }).click();

  await expect(page.getByText("Transaction saved successfully")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Zomato" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "₹130.00" })).toBeVisible();

  await page.goto("/reports");
  await expect(page.getByText("Category Spending")).toBeVisible();
  await expect(page.getByText("Income vs Expense Trend")).toBeVisible();
});

test("create budget and goal are reflected in page lists", async ({ page }) => {
  await seedAuth(page);
  await mockApi(page);

  await page.goto("/budgets");
  await page.getByPlaceholder("Category ID").fill("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  await page.getByPlaceholder("5000").fill("5000");
  await page.getByRole("button", { name: "Create Budget" }).click();
  await expect(page.getByText("Budget created")).toBeVisible();

  await page.goto("/goals");
  await page.getByPlaceholder("Goal Name").fill("Vacation");
  await page.getByPlaceholder("Target Amount").fill("15000");
  await page.getByRole("button", { name: "Add Goal" }).click();
  await expect(page.getByText("Goal created")).toBeVisible();
  await expect(page.getByText("Vacation")).toBeVisible();
});

