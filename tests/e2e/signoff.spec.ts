import { expect, test } from "@playwright/test";
import {
  apiDelete,
  apiExpectStatus,
  apiGet,
  apiPost,
  attachRuntimeGuards,
  createCsv,
  defaultPassword,
  dismissV2IntroIfPresent,
  importOnboardingWorkbook,
  isoDate,
  loginUser,
  logoutUser,
  monthYearForNow,
  provisionWorkspace,
  readAuthState,
  registerUserViaApi,
  signupFreshUser,
  tinyPngFile,
  waitForAnyMarker,
  type TestUser
} from "./live-helpers";

interface AccountItem {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}

interface CategoryItem {
  id: string;
  name: string;
  type: "Income" | "Expense";
}

interface BudgetItem {
  id: string;
  categoryId: string;
  amount: number;
  spentAmount: number;
  month: number;
  year: number;
  accountId?: string | null;
}

interface GoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progressPercent: number;
  status: string;
}

interface RecurringItem {
  id: string;
  title: string;
  amount: number;
  type: "Income" | "Expense";
  frequency: string;
  startDate: string;
  nextRunDate: string;
  accountId?: string | null;
  categoryId?: string | null;
  autoCreateTransaction: boolean;
  isPaused?: boolean;
}

interface RuleItem {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  condition: { field: string; operator: string; value: string };
  action: { type: string; value: string };
}

interface TransactionItem {
  id: string;
  accountId: string;
  categoryId?: string | null;
  type: "Income" | "Expense" | "Transfer";
  amount: number;
  date: string;
  merchant?: string | null;
  note?: string | null;
  paymentMethod?: string | null;
  transferAccountId?: string | null;
  tags: string[];
  alerts?: string[];
}

interface SharedMember {
  userId: string;
  email: string;
  displayName: string;
  role: "Owner" | "Editor" | "Viewer";
  isOwner: boolean;
}

interface SharedActivity {
  id: string;
  actorName: string;
  entityType: string;
  action: string;
  description: string;
  createdAt: string;
}

interface UserProfile {
  email: string;
  displayName: string;
  phoneNumber?: string | null;
  profileImageUrl?: string | null;
}

test.describe("V2 signoff", () => {
  test("pre-login surfaces and onboarding import work", async ({ page }) => {
    const guards = attachRuntimeGuards(page);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Log In" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();

    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Sign Up" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible();

    await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Forgot Password" })).toBeVisible();
    await page.getByPlaceholder("you@example.com").fill(`forgot.${Date.now()}@example.com`);
    const forgotPasswordResponse = page.waitForResponse(
      (response) => response.url().includes("/api/auth/forgot-password") && response.status() === 200
    );
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await forgotPasswordResponse;
    await expect(page.getByRole("button", { name: "Send Reset Link" })).toBeVisible();

    await page.goto("/reset-password", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset Password" })).toBeVisible();

    const user = await signupFreshUser(page, { prefix: "signoff-prelogin", displayName: "V2 Signoff Prelogin" });
    await expect(page.getByRole("button", { name: "Experience V2" })).toBeVisible();
    await importOnboardingWorkbook(page);
    await expect(page.getByText("Cash Flow Forecast Engine", { exact: false })).toBeVisible();

    await logoutUser(page, user.displayName);
    await loginUser(page, user);
    await expect(page.getByText("Cash Flow Forecast Engine", { exact: false })).toBeVisible();

    await guards.assertClean();
  });

  test("forecasting, health score, reporting, and insights are populated after onboarding", async ({ page, request }) => {
    const guards = attachRuntimeGuards(page);
    const session = await provisionWorkspace(page, { prefix: "signoff-analytics", displayName: "V2 Signoff Analytics" });
    const token = session.auth.accessToken;

    const accounts = await apiGet<AccountItem[]>(request, "/accounts", token);
    expect(accounts.length).toBeGreaterThan(0);

    const monthForecast = await apiGet<{
      forecastedEndBalance: number;
      safeToSpend: number;
      model: string;
      riskWarnings: string[];
    }>(request, "/forecast/month", token);
    expect(monthForecast.model.length).toBeGreaterThan(0);
    expect(typeof monthForecast.forecastedEndBalance).toBe("number");
    expect(typeof monthForecast.safeToSpend).toBe("number");

    const dailyForecast = await apiGet<Array<{ date: string; projectedBalance: number }>>(request, "/forecast/daily", token);
    expect(dailyForecast.length).toBeGreaterThan(0);

    const healthScore = await apiGet<{
      score: number;
      breakdown: Array<{ label: string; score: number }>;
      suggestions: string[];
    }>(request, "/insights/health-score", token);
    expect(healthScore.score).toBeGreaterThanOrEqual(0);
    expect(healthScore.score).toBeLessThanOrEqual(100);
    expect(healthScore.breakdown.length).toBeGreaterThan(0);

    const { month, year } = monthYearForNow();
    const from = `${year}-${String(Math.max(1, month - 5)).padStart(2, "0")}-01`;
    const to = isoDate(0);

    const trends = await apiGet<{
      categoryTrends: unknown[];
      savingsRateTrend: unknown[];
      incomeVsExpense: unknown[];
    }>(request, `/reports/trends?from=${from}&to=${to}`, token);
    expect(trends.categoryTrends.length).toBeGreaterThan(0);
    expect(trends.savingsRateTrend.length).toBeGreaterThan(0);
    expect(trends.incomeVsExpense.length).toBeGreaterThan(0);

    const netWorth = await apiGet<Array<{ month: string; value: number }>>(request, `/reports/net-worth?from=${from}&to=${to}`, token);
    expect(netWorth.length).toBeGreaterThan(0);

    const categorySpend = await apiGet<Array<{ category: string; amount: number }>>(request, `/reports/category-spend?from=${from}&to=${to}`, token);
    expect(categorySpend.length).toBeGreaterThan(0);

    const incomeVsExpense = await apiGet<Array<{ month: string; income: number; expense: number }>>(
      request,
      `/reports/income-vs-expense?from=${from}&to=${to}`,
      token
    );
    expect(incomeVsExpense.length).toBeGreaterThan(0);

    const highlights = await apiGet<Array<{ title: string; description: string }>>(request, `/insights?from=${from}&to=${to}`, token);
    expect(highlights.length).toBeGreaterThan(0);

    await page.goto("/reports", { waitUntil: "domcontentloaded" });
    expect(await waitForAnyMarker(page, ["Category Spending", "Net Worth Tracking"])).toBeTruthy();

    await page.goto("/insights", { waitUntil: "domcontentloaded" });
    expect(await waitForAnyMarker(page, ["Financial Health Score", "Insight Highlights"])).toBeTruthy();

    await guards.assertClean();
  });

  test("transaction import and rules engine execute on create and import", async ({ page, request }, testInfo) => {
    const guards = attachRuntimeGuards(page);
    const session = await provisionWorkspace(page, { prefix: "signoff-rules", displayName: "V2 Signoff Rules" });
    const token = session.auth.accessToken;

    const accounts = await apiGet<AccountItem[]>(request, "/accounts", token);
    const categories = await apiGet<CategoryItem[]>(request, "/categories", token);
    const primaryAccount = accounts.find((account) => account.name.includes("Horizon")) ?? accounts[0];
    const diningCategory = categories.find((category) => category.name === "Dining" && category.type === "Expense");
    const groceriesCategory = categories.find((category) => category.name === "Groceries" && category.type === "Expense");
    const travelCategory = categories.find((category) => category.name === "Travel" && category.type === "Expense");

    expect(primaryAccount).toBeTruthy();
    expect(diningCategory).toBeTruthy();
    expect(groceriesCategory).toBeTruthy();
    expect(travelCategory).toBeTruthy();

    await page.goto("/transactions", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Import CSV" }).click();
    await expect(page.getByRole("heading", { name: "Import Transactions" })).toBeVisible();

    const csvPath = await createCsv(
      testInfo,
      "transactions-signoff-import.csv",
      [
        "date,type,amount,category,merchant,note,paymentMethod,tags",
        `${isoDate(-1)},Expense,455,Dining,Import Merchant 1,CSV import row 1,UPI,import-one`,
        `${isoDate(-2)},Expense,275,Groceries,Import Merchant 2,CSV import row 2,Debit Card,import-two`
      ].join("\n")
    );

    const importResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/transactions/import") && response.status() === 200
    );

    const importModal = page.locator(".import-modal-card");
    await page.locator("#transaction-import-file").setInputFiles(csvPath);
    await importModal.getByLabel("Account").selectOption({ label: primaryAccount.name });
    await importModal.getByRole("button", { name: "Import Transactions" }).click();
    const importResponse = await importResponsePromise;
    const importResult = (await importResponse.json()) as { importedCount: number; alerts: string[] };
    expect(importResult.importedCount).toBe(2);

    const importedTransactions = await apiGet<TransactionItem[]>(
      request,
      `/transactions?search=${encodeURIComponent("Import Merchant")}&page=1&pageSize=20`,
      token
    );
    expect(importedTransactions.length).toBeGreaterThanOrEqual(2);

    const swiggyTransaction = await apiPost<TransactionItem>(
      request,
      "/transactions",
      {
        accountId: primaryAccount.id,
        categoryId: diningCategory!.id,
        type: "Expense",
        amount: 321,
        date: isoDate(0),
        merchant: "Swiggy Pop",
        note: "rules add-tag check",
        paymentMethod: "UPI",
        transferAccountId: null,
        tags: []
      },
      token
    );
    expect(swiggyTransaction.tags).toContain("food-delivery");

    const remappedTransaction = await apiPost<TransactionItem>(
      request,
      "/transactions",
      {
        accountId: primaryAccount.id,
        categoryId: diningCategory!.id,
        type: "Expense",
        amount: 654,
        date: isoDate(0),
        merchant: "Fresh Basket Local",
        note: "rules category remap check",
        paymentMethod: "Debit Card",
        transferAccountId: null,
        tags: []
      },
      token
    );
    expect(remappedTransaction.categoryId).toBe(groceriesCategory!.id);

    const alertTransaction = await apiPost<TransactionItem>(
      request,
      "/transactions",
      {
        accountId: primaryAccount.id,
        categoryId: travelCategory!.id,
        type: "Expense",
        amount: 2100,
        date: isoDate(0),
        merchant: "Travel Rule Probe",
        note: "rules alert check",
        paymentMethod: "Debit Card",
        transferAccountId: null,
        tags: []
      },
      token
    );
    expect(alertTransaction.alerts ?? []).toContain("Review large travel expense");

    await page.getByLabel("Search").fill("Import Merchant 1");
    await expect(page.getByText("Import Merchant 1")).toBeVisible();

    await guards.assertClean();
  });

  test("categories, budgets, goals, recurring items, and rules support CRUD workflows", async ({ page, request }) => {
    const guards = attachRuntimeGuards(page);
    const session = await provisionWorkspace(page, { prefix: "signoff-crud", displayName: "V2 Signoff CRUD" });
    const token = session.auth.accessToken;
    const accounts = await apiGet<AccountItem[]>(request, "/accounts", token);
    const categories = await apiGet<CategoryItem[]>(request, "/categories", token);
    const primaryAccount =
      accounts.find((account) => account.name.includes("Horizon")) ??
      accounts.find((account) => account.currentBalance > 0) ??
      accounts[0];
    const baseExpenseCategory = categories.find((category) => category.type === "Expense");

    expect(primaryAccount).toBeTruthy();
    expect(baseExpenseCategory).toBeTruthy();

    const categoryName = `Signoff Category ${Date.now()}`;
    const updatedCategoryName = `${categoryName} Edited`;
    const goalName = `Signoff Goal ${Date.now()}`;
    const recurringName = `Signoff Recurring ${Date.now()}`;
    const updatedRecurringName = `${recurringName} Edited`;
    const ruleName = `Signoff Rule ${Date.now()}`;
    const ruleMerchant = `Signoff Merchant ${Date.now()}`;
    const ruleTag = `signoff-tag-${Date.now()}`;
    const updatedRuleTag = `${ruleTag}-updated`;
    const { month, year } = monthYearForNow();

    await page.goto("/categories", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Name").fill(categoryName);
    await page.getByLabel("Type").selectOption("Expense");
    await page.getByRole("button", { name: "Create Category" }).click();

    await expect.poll(async () => {
      const items = await apiGet<CategoryItem[]>(request, "/categories", token);
      return items.find((item) => item.name === categoryName) ?? null;
    }).not.toBeNull();
    let category = await apiGet<CategoryItem[]>(request, "/categories", token).then((items) => items.find((item) => item.name === categoryName)!);

    const categoryCard = page.locator("article.category-card").filter({ hasText: categoryName }).first();
    await categoryCard.getByLabel("Edit category").click();
    await page.getByLabel("Name").fill(updatedCategoryName);
    await page.getByRole("button", { name: "Update Category" }).click();

    await expect.poll(async () => {
      const items = await apiGet<CategoryItem[]>(request, "/categories", token);
      return items.find((item) => item.name === updatedCategoryName) ?? null;
    }).not.toBeNull();
    category = await apiGet<CategoryItem[]>(request, "/categories", token).then((items) => items.find((item) => item.name === updatedCategoryName)!);

    await page.goto("/budgets", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Category").selectOption(category.id);
    await page.getByLabel("Budget Amount").fill("4321");
    await page.getByRole("button", { name: "Create Budget" }).click();

    await expect.poll(async () => {
      const items = await apiGet<BudgetItem[]>(request, `/budgets?month=${month}&year=${year}`, token);
      return items.find((item) => item.categoryId === category.id && item.amount === 4321) ?? null;
    }).not.toBeNull();
    let budget = await apiGet<BudgetItem[]>(request, `/budgets?month=${month}&year=${year}`, token).then((items) =>
      items.find((item) => item.categoryId === category.id && item.amount === 4321)!
    );

    const budgetRow = page.locator("article.budget-row").filter({ hasText: updatedCategoryName }).first();
    await budgetRow.getByLabel("Edit budget").click();
    await page.getByLabel("Budget Amount").fill("5432");
    await page.getByRole("button", { name: "Update Budget" }).click();

    await expect.poll(async () => {
      const items = await apiGet<BudgetItem[]>(request, `/budgets?month=${month}&year=${year}`, token);
      return items.find((item) => item.id === budget.id && item.amount === 5432) ?? null;
    }).not.toBeNull();

    await page.goto("/goals", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Goal Name").fill(goalName);
    await page.getByLabel("Target Amount").fill("10000");
    await page.getByLabel("Linked Account").selectOption(primaryAccount.id);
    await page.getByRole("button", { name: "Add Goal" }).click();

    await expect.poll(async () => {
      const items = await apiGet<GoalItem[]>(request, "/goals", token);
      return items.find((item) => item.name === goalName) ?? null;
    }).not.toBeNull();
    let goal = await apiGet<GoalItem[]>(request, "/goals", token).then((items) => items.find((item) => item.name === goalName)!);

    let goalCard = page.locator("article.goal-card").filter({ hasText: goalName }).first();
    await goalCard.getByRole("button", { name: "Contribute" }).click();
    await expect(page.getByRole("heading", { name: "Contribute to goal" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await apiPost(
      request,
      `/goals/${goal.id}/contribute`,
      { amount: 500 },
      token
    );

    await expect.poll(async () => {
      const items = await apiGet<GoalItem[]>(request, "/goals", token);
      return items.find((item) => item.id === goal.id && item.currentAmount >= 500) ?? null;
    }).not.toBeNull();

    await apiPost(
      request,
      `/goals/${goal.id}/hold`,
      { onHold: true },
      token
    );
    await expect.poll(async () => {
      const items = await apiGet<GoalItem[]>(request, "/goals", token);
      return items.find((item) => item.id === goal.id)?.status ?? "";
    }).toBe("on-hold");

    await apiPost(
      request,
      `/goals/${goal.id}/hold`,
      { onHold: false },
      token
    );
    await expect.poll(async () => {
      const items = await apiGet<GoalItem[]>(request, "/goals", token);
      return items.find((item) => item.id === goal.id)?.status ?? "";
    }).not.toBe("on-hold");

    await page.goto("/recurring", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Title").fill(recurringName);
    await page.getByLabel("Amount").fill("299");
    await page.getByLabel("Account").selectOption(primaryAccount.id);
    await page.getByLabel("Category").selectOption(baseExpenseCategory!.id);
    await page.getByRole("button", { name: "Create Recurring" }).click();

    await expect.poll(async () => {
      const items = await apiGet<RecurringItem[]>(request, "/recurring", token);
      return items.find((item) => item.title === recurringName) ?? null;
    }).not.toBeNull();
    let recurring = await apiGet<RecurringItem[]>(request, "/recurring", token).then((items) =>
      items.find((item) => item.title === recurringName)!
    );

    let recurringRow = page.locator("tr").filter({ hasText: recurringName }).first();
    await recurringRow.getByRole("button", { name: "Pause" }).click();
    await expect.poll(async () => {
      const items = await apiGet<RecurringItem[]>(request, "/recurring", token);
      return items.find((item) => item.id === recurring.id)?.isPaused ?? false;
    }).toBe(true);

    recurringRow = page.locator("tr").filter({ hasText: recurringName }).first();
    await recurringRow.getByRole("button", { name: "Resume" }).click();
    await expect.poll(async () => {
      const items = await apiGet<RecurringItem[]>(request, "/recurring", token);
      return items.find((item) => item.id === recurring.id)?.isPaused ?? true;
    }).toBe(false);

    recurringRow = page.locator("tr").filter({ hasText: recurringName }).first();
    await recurringRow.getByLabel("Edit recurring item").click();
    await page.getByLabel("Title").fill(updatedRecurringName);
    await page.getByRole("button", { name: "Update Recurring" }).click();

    await expect.poll(async () => {
      const items = await apiGet<RecurringItem[]>(request, "/recurring", token);
      return items.find((item) => item.title === updatedRecurringName) ?? null;
    }).not.toBeNull();
    recurring = await apiGet<RecurringItem[]>(request, "/recurring", token).then((items) =>
      items.find((item) => item.title === updatedRecurringName)!
    );

    await page.goto("/rules", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Rule Name").fill(ruleName);
    await page.getByLabel("Condition Field").selectOption("Merchant");
    await page.getByLabel("Operator").selectOption("Contains");
    await page.getByLabel("Condition Value").fill(ruleMerchant);
    await page.getByLabel("Action Type").selectOption("AddTag");
    await page.getByLabel("Action Value").fill(ruleTag);
    await page.getByLabel("Priority").fill("77");
    await page.getByRole("button", { name: "Create Rule" }).click();

    await expect.poll(async () => {
      const items = await apiGet<RuleItem[]>(request, "/rules", token);
      return items.find((item) => item.name === ruleName) ?? null;
    }).not.toBeNull();
    let rule = await apiGet<RuleItem[]>(request, "/rules", token).then((items) => items.find((item) => item.name === ruleName)!);

    const ruleRow = page.locator("article.budget-row").filter({ hasText: ruleName }).first();
    await ruleRow.getByRole("button", { name: "Disable" }).click();
    await expect.poll(async () => {
      const items = await apiGet<RuleItem[]>(request, "/rules", token);
      return items.find((item) => item.id === rule.id)?.isActive ?? true;
    }).toBe(false);

    await ruleRow.getByLabel("Edit rule").click();
    await page.getByLabel("Action Value").fill(updatedRuleTag);
    await page.getByLabel("Status").selectOption("true");
    await page.getByRole("button", { name: "Update Rule" }).click();

    await expect.poll(async () => {
      const items = await apiGet<RuleItem[]>(request, "/rules", token);
      return items.find((item) => item.id === rule.id && item.action.value === updatedRuleTag && item.isActive) ?? null;
    }).not.toBeNull();

    const taggedTransaction = await apiPost<TransactionItem>(
      request,
      "/transactions",
      {
        accountId: primaryAccount.id,
        categoryId: baseExpenseCategory!.id,
        type: "Expense",
        amount: 199,
        date: isoDate(0),
        merchant: `${ruleMerchant} order`,
        note: "custom rule trigger",
        paymentMethod: "UPI",
        transferAccountId: null,
        tags: []
      },
      token
    );
    expect(taggedTransaction.tags).toContain(updatedRuleTag);

    await page.goto("/goals", { waitUntil: "domcontentloaded" });
    await page.once("dialog", (dialog) => dialog.accept());
    goalCard = page.locator("article.goal-card").filter({ hasText: goalName }).first();
    await goalCard.getByLabel("Delete goal").click();
    await expect.poll(async () => {
      const items = await apiGet<GoalItem[]>(request, "/goals", token);
      return items.some((item) => item.id === goal.id);
    }).toBe(false);

    await page.goto("/recurring", { waitUntil: "domcontentloaded" });
    recurringRow = page.locator("tr").filter({ hasText: updatedRecurringName }).first();
    await recurringRow.getByLabel("Delete recurring item").click();
    await expect.poll(async () => {
      const items = await apiGet<RecurringItem[]>(request, "/recurring", token);
      return items.some((item) => item.id === recurring.id);
    }).toBe(false);

    await page.goto("/rules", { waitUntil: "domcontentloaded" });
    const updatedRuleRow = page.locator("article.budget-row").filter({ hasText: ruleName }).first();
    await updatedRuleRow.getByLabel("Delete rule").click();
    await expect.poll(async () => {
      const items = await apiGet<RuleItem[]>(request, "/rules", token);
      return items.some((item) => item.id === rule.id);
    }).toBe(false);

    await page.goto("/budgets", { waitUntil: "domcontentloaded" });
    const updatedBudgetRow = page.locator("article.budget-row").filter({ hasText: updatedCategoryName }).first();
    await updatedBudgetRow.getByLabel("Delete budget").click();
    await expect.poll(async () => {
      const items = await apiGet<BudgetItem[]>(request, `/budgets?month=${month}&year=${year}`, token);
      return items.some((item) => item.id === budget.id);
    }).toBe(false);

    await page.goto("/categories", { waitUntil: "domcontentloaded" });
    const updatedCategoryCard = page.locator("article.category-card").filter({ hasText: updatedCategoryName }).first();
    await updatedCategoryCard.getByLabel("Delete category").click();
    await expect.poll(async () => {
      const items = await apiGet<CategoryItem[]>(request, "/categories", token);
      return items.some((item) => item.id === category.id);
    }).toBe(false);

    await guards.assertClean();
  });

  test("shared accounts, settings, role access, and preserved delete flow work", async ({ page, request }) => {
    const guards = attachRuntimeGuards(page);
    const session = await provisionWorkspace(page, { prefix: "signoff-shared", displayName: "V2 Signoff Shared" });
    const token = session.auth.accessToken;
    const accounts = await apiGet<AccountItem[]>(request, "/accounts", token);
    const primaryAccount = accounts[0];
    expect(primaryAccount).toBeTruthy();

    const collaborator = await registerUserViaApi(request, {
      prefix: "signoff-collab",
      displayName: "Signoff Collaborator",
      password: defaultPassword
    });

    await page.goto("/shared-accounts", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Invite Member" }).click();
    await page.getByLabel("Email").fill(collaborator.email);
    await page.getByLabel("Role").selectOption("Editor");
    await page.getByRole("button", { name: "Send Invite" }).click();

    const collaboratorRow = page.locator("article.budget-row").filter({ hasText: collaborator.email }).first();
    await expect(collaboratorRow).toBeVisible();

    const collaboratorAccounts = await apiGet<AccountItem[]>(request, "/accounts", collaborator.auth.accessToken);
    expect(collaboratorAccounts.some((account) => account.id === primaryAccount.id)).toBe(true);

    const collaboratorCategories = await apiGet<CategoryItem[]>(request, "/categories", collaborator.auth.accessToken);
    const collaboratorExpenseCategory = collaboratorCategories.find((category) => category.type === "Expense");
    expect(collaboratorExpenseCategory).toBeTruthy();

    const { month, year } = monthYearForNow();
    await apiPost<BudgetItem>(
      request,
      "/budgets",
      {
        accountId: primaryAccount.id,
        categoryId: collaboratorExpenseCategory!.id,
        month,
        year,
        amount: 999,
        alertThresholdPercent: 80
      },
      collaborator.auth.accessToken
    );

    await collaboratorRow.locator("select").selectOption("Viewer");
    await expect.poll(async () => {
      const members = await apiGet<SharedMember[]>(request, `/accounts/${primaryAccount.id}/members`, token);
      return members.find((member) => member.email === collaborator.email)?.role ?? "";
    }).toBe("Viewer");

    await apiExpectStatus(
      request,
      "post",
      "/budgets",
      collaborator.auth.accessToken,
      403,
      {
        accountId: primaryAccount.id,
        categoryId: collaboratorExpenseCategory!.id,
        month,
        year,
        amount: 1200,
        alertThresholdPercent: 80
      }
    );

    const activity = await apiGet<SharedActivity[]>(request, `/accounts/${primaryAccount.id}/activity`, token);
    expect(activity.some((item) => item.description.toLowerCase().includes("invited"))).toBe(true);
    expect(activity.some((item) => item.description.toLowerCase().includes("role"))).toBe(true);

    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    const updatedName = `V2 Signoff Shared ${Date.now()}`;
    const updatedPhone = `98${Date.now().toString().slice(-8)}`;
    await page.getByLabel("Full Name").fill(updatedName);
    await page.getByLabel("Phone Number").fill(updatedPhone);
    await page.locator("input[type='file']").setInputFiles(tinyPngFile());
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect.poll(async () => {
      const profile = await apiGet<UserProfile>(request, "/profile", token);
      return {
        displayName: profile.displayName,
        phoneNumber: profile.phoneNumber ?? "",
        hasImage: Boolean(profile.profileImageUrl)
      };
    }).toEqual({
      displayName: updatedName,
      phoneNumber: updatedPhone,
      hasImage: true
    });

    const darkModeSwitch = page.getByRole("switch", { name: "Dark Mode" });
    await darkModeSwitch.click();
    await expect(page.locator("body")).toHaveClass(/dark-theme/);

    const newPassword = "Sanity@456";
    await page.getByLabel("Current Password", { exact: true }).fill(session.password);
    await page.getByLabel("New Password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm New Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Change Password" }).click();
    await page.waitForURL(/\/login$/, { timeout: 60_000 });

    const updatedUser: TestUser = { ...session, displayName: updatedName, password: newPassword };
    await loginUser(page, updatedUser);
    await expect(page.getByText("Cash Flow Forecast Engine", { exact: false })).toBeVisible();

    const accountsBeforeDelete = await apiGet<AccountItem[]>(request, "/accounts", (await readAuthState(page)).accessToken);
    expect(accountsBeforeDelete.length).toBeGreaterThan(0);

    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Delete Account" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete Account" }).click();
    await page.waitForURL(/\/login$/, { timeout: 60_000 });

    await loginUser(page, updatedUser);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByText("Cash Flow Forecast Engine", { exact: false })).toBeVisible();

    const accountsAfterRestore = await apiGet<AccountItem[]>(request, "/accounts", (await readAuthState(page)).accessToken);
    expect(accountsAfterRestore.length).toBe(accountsBeforeDelete.length);

    await guards.assertClean();
  });

  test("permanent delete removes the user and prevents re-login", async ({ page, request }) => {
    const guards = attachRuntimeGuards(page);
    const user = await signupFreshUser(page, { prefix: "signoff-permanent", displayName: "V2 Signoff Permanent" });

    await dismissV2IntroIfPresent(page);
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: "Skip" }).click();
      await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
    }

    const auth = await readAuthState(page);
    await apiPost<AccountItem>(
      request,
      "/accounts",
      {
        name: "Delete Me Account",
        type: "Bank",
        openingBalance: 1000
      },
      auth.accessToken
    );

    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Delete Account" }).click();
    await page.getByLabel("Delete my data permanently").check();
    await page.getByRole("dialog").getByRole("button", { name: "Delete Account" }).click();
    await page.waitForURL(/\/login$/, { timeout: 60_000 });

    await apiExpectStatus(
      request,
      "post",
      "/auth/login",
      undefined,
      401,
      {
        email: user.email,
        password: user.password
      }
    );

    await guards.assertClean();
  });
});
