import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? "https://finance-tracker-syed-hba2afgqh3bbafeg.centralindia-01.azurewebsites.net";
const onboardingSamplePath = path.resolve(process.cwd(), "public", "sample-onboarding-import.xlsx");
const smokeAuthMode = (process.env.PLAYWRIGHT_SMOKE_AUTH_MODE ?? "signup").toLowerCase();
const smokePassword = process.env.PLAYWRIGHT_SMOKE_PASSWORD ?? "Sanity@123";
const smokeDisplayName = process.env.PLAYWRIGHT_SMOKE_DISPLAY_NAME ?? "V2 Smoke User";
const smokeEmailDomain = process.env.PLAYWRIGHT_SMOKE_EMAIL_DOMAIN ?? "example.com";

const pageChecks = [
  { path: "/", markers: ["Cash Flow Forecast Engine", "Money Pulse Matrix", "Recent Transactions"] },
  { path: "/transactions", markers: ["Transactions", "Import CSV", "Insights"] },
  { path: "/categories", markers: ["Categories", "Create Category"] },
  { path: "/budgets", markers: ["Create Budget", "Category-wise Budgets"] },
  { path: "/goals", markers: ["Savings Goals", "Add Goal"] },
  { path: "/recurring", markers: ["Recurring Transactions", "Create Recurring"] },
  { path: "/rules", markers: ["Rules Builder", "Rules"] },
  { path: "/reports", markers: ["Category Spending", "Net Worth Tracking"] },
  { path: "/insights", markers: ["Financial Health Score", "Insight Highlights"] },
  { path: "/accounts", markers: ["Accounts", "Invite Member"] },
  { path: "/shared-accounts", markers: ["Invite Member", "Members", "Recent Activity"] },
  { path: "/settings", markers: ["Profile Settings", "Security", "Delete Account"] }
] as const;

function isBackendApi(url: string) {
  return url.startsWith(`${backendBaseUrl}/api/`) || url.includes("/api/");
}

async function waitForAnyMarker(page: Page, markers: readonly string[]) {
  for (const marker of markers) {
    const locator = page.getByText(marker, { exact: false }).first();
    try {
      await locator.waitFor({ state: "visible", timeout: 15_000 });
      return marker;
    } catch {
      // Try next marker.
    }
  }

  return null;
}

async function dismissV2IntroIfPresent(page: Page) {
  const button = page.getByRole("button", { name: "Experience V2" });
  if (await button.isVisible().catch(() => false)) {
    await button.click({ force: true });
    await button.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  }
}

async function signupFreshUser(page: Page) {
  const email = `smoke.${Date.now()}@${smokeEmailDomain}`;

  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Display name").fill(smokeDisplayName);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("At least 8 characters").fill(smokePassword);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL((url) => url.pathname === "/onboarding" || url.pathname === "/", { timeout: 60_000 });

  return { email, password: smokePassword, displayName: smokeDisplayName };
}

async function loginExistingUser(page: Page) {
  const email = process.env.PLAYWRIGHT_SMOKE_EMAIL;
  const password = process.env.PLAYWRIGHT_SMOKE_PASSWORD;

  if (!email || !password) {
    throw new Error("PLAYWRIGHT_SMOKE_EMAIL and PLAYWRIGHT_SMOKE_PASSWORD are required when PLAYWRIGHT_SMOKE_AUTH_MODE=login.");
  }

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("At least 8 characters").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL((url) => url.pathname === "/onboarding" || url.pathname === "/", { timeout: 60_000 });

  return { email, password, displayName: process.env.PLAYWRIGHT_SMOKE_DISPLAY_NAME ?? "Smoke User" };
}

async function importOnboardingWorkbook(page: Page) {
  await dismissV2IntroIfPresent(page);

  if (!page.url().includes("/onboarding")) {
    return false;
  }

  await page.locator('input[type="file"]').setInputFiles(onboardingSamplePath);
  await page.getByRole("button", { name: /Load workbook and continue/i }).click({ force: true });
  await page.waitForURL((url) => url.pathname === "/", { timeout: 180_000 });
  await expect(page.getByText("Cash Flow Forecast Engine", { exact: false }).first()).toBeVisible({ timeout: 20_000 });

  return true;
}

async function assertRouteLooksHealthy(page: Page, routePath: string, markers: readonly string[]) {
  await page.goto(routePath, { waitUntil: "domcontentloaded" });
  const marker = await waitForAnyMarker(page, markers);
  const visibleErrors = await page
    .locator('.error, text=/Failed to load|API unavailable|Something went wrong/i')
    .allTextContents()
    .catch(() => []);

  expect(marker, `Expected one of these markers on ${routePath}: ${markers.join(", ")}`).toBeTruthy();
  expect(visibleErrors, `Unexpected visible error text on ${routePath}`).toEqual([]);
}

test.describe("deployed V2 smoke", () => {
  test("auth, onboarding import, and main V2 pages stay healthy", async ({ page }) => {
    const backendFailures: Array<{ url: string; status: number; bodyPreview: string }> = [];
    const pageErrors: string[] = [];
    const requestFailures: Array<{ url: string; error: string }> = [];

    page.on("pageerror", (error) => {
      pageErrors.push(String(error));
    });

    page.on("response", async (response) => {
      if (!isBackendApi(response.url()) || response.status() < 500) {
        return;
      }

      let bodyPreview = "";
      try {
        bodyPreview = (await response.text()).slice(0, 500);
      } catch {
        bodyPreview = "";
      }

      backendFailures.push({
        url: response.url(),
        status: response.status(),
        bodyPreview
      });
    });

    page.on("requestfailed", (request) => {
      if (!isBackendApi(request.url())) {
        return;
      }

      const error = request.failure()?.errorText ?? "unknown";
      if (error.includes("ERR_ABORTED")) {
        return;
      }

      requestFailures.push({ url: request.url(), error });
    });

    const user = smokeAuthMode === "login" ? await loginExistingUser(page) : await signupFreshUser(page);

    await test.step("complete onboarding with sample workbook when needed", async () => {
      await importOnboardingWorkbook(page);
    });

    await test.step("dashboard loads after auth", async () => {
      await expect(page.getByText("Cash Flow Forecast Engine", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    });

    for (const check of pageChecks) {
      await test.step(`route ${check.path}`, async () => {
        await assertRouteLooksHealthy(page, check.path, check.markers);
      });
    }

    await test.step("transactions import modal opens", async () => {
      await page.goto("/transactions", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Import CSV" }).click();
      await expect(page.getByRole("heading", { name: "Import Transactions" })).toBeVisible();
    });

    await test.step("delete account confirmation modal opens", async () => {
      await page.goto("/settings", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Delete Account/i }).first().click();
      await expect(page.getByRole("dialog").getByRole("heading", { name: "Delete account" })).toBeVisible();
    });

    await test.step("login works for the same user", async () => {
      await page.goto("/settings", { waitUntil: "domcontentloaded" });
      await page.getByLabel(`Open user menu for ${user.displayName}`).click();
      await page.getByRole("button", { name: "Logout" }).click();
      await page.waitForURL(/\/login$/, { timeout: 30_000 });

      await page.getByPlaceholder("you@example.com").fill(user.email);
      await page.getByPlaceholder("At least 8 characters").fill(user.password);
      await page.getByRole("button", { name: "Login" }).click();
      await page.waitForURL((url) => url.pathname === "/onboarding" || url.pathname === "/", { timeout: 60_000 });
      await dismissV2IntroIfPresent(page);
      if (page.url().includes("/onboarding")) {
        await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 }).catch(() => {});
      }
      await expect(page.getByText("Cash Flow Forecast Engine", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    });

    expect(pageErrors, "Unhandled frontend runtime errors occurred.").toEqual([]);
    expect(requestFailures, "Non-navigation backend request failures occurred.").toEqual([]);
    expect(backendFailures, "Backend returned 5xx responses during smoke flow.").toEqual([]);
  });
});
