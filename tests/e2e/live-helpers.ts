import fs from "node:fs/promises";
import path from "node:path";
import { expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

export const backendBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "https://finance-tracker-syed-hba2afgqh3bbafeg.centralindia-01.azurewebsites.net";
export const onboardingSamplePath = path.resolve(process.cwd(), "public", "sample-onboarding-import.xlsx");
export const defaultPassword = "Sanity@123";

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

export interface RuntimeGuards {
  assertClean: () => Promise<void>;
}

interface AuthState {
  accessToken: string;
  refreshToken: string | null;
  email: string;
  displayName: string;
  profileImageUrl?: string | null;
  showWelcomeBackMessage?: boolean;
}

export function attachRuntimeGuards(page: Page): RuntimeGuards {
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
      bodyPreview = (await response.text()).slice(0, 400);
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

  return {
    async assertClean() {
      expect(pageErrors, "Unhandled frontend runtime errors occurred.").toEqual([]);
      expect(requestFailures, "Non-navigation backend request failures occurred.").toEqual([]);
      expect(backendFailures, "Backend returned 5xx responses during the browser flow.").toEqual([]);
    }
  };
}

export function isBackendApi(url: string) {
  return url.startsWith(`${backendBaseUrl}/api/`) || url.includes("/api/");
}

export async function waitForAnyMarker(page: Page, markers: readonly string[]) {
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

export async function dismissV2IntroIfPresent(page: Page) {
  const button = page.getByRole("button", { name: "Experience V2" });
  if (await button.isVisible().catch(() => false)) {
    await button.click({ force: true });
    await button.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  }
}

export async function signupFreshUser(
  page: Page,
  options?: { prefix?: string; displayName?: string; password?: string; domain?: string }
): Promise<TestUser> {
  const prefix = options?.prefix ?? "signoff";
  const displayName = options?.displayName ?? "V2 Signoff User";
  const password = options?.password ?? defaultPassword;
  const domain = options?.domain ?? "example.com";
  const email = `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@${domain}`;

  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Display name").fill(displayName);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("At least 8 characters").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL((url) => url.pathname === "/onboarding" || url.pathname === "/", { timeout: 60_000 });

  return { email, password, displayName };
}

export async function loginUser(page: Page, user: TestUser) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("you@example.com").fill(user.email);
  await page.getByPlaceholder("At least 8 characters").fill(user.password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL((url) => url.pathname === "/onboarding" || url.pathname === "/", { timeout: 60_000 });
  await dismissV2IntroIfPresent(page);
  if (page.url().includes("/onboarding")) {
    await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
  }
}

export async function logoutUser(page: Page, displayName: string) {
  await page.getByLabel(`Open user menu for ${displayName}`).click();
  await page.getByRole("button", { name: "Logout" }).click();
  await page.waitForURL(/\/login$/, { timeout: 30_000 });
}

export async function importOnboardingWorkbook(page: Page) {
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

export async function provisionWorkspace(
  page: Page,
  options?: { prefix?: string; displayName?: string; password?: string }
): Promise<TestUser & { auth: AuthState }> {
  const user = await signupFreshUser(page, options);
  await importOnboardingWorkbook(page);
  const auth = await readAuthState(page);
  return { ...user, auth };
}

export async function readAuthState(page: Page): Promise<AuthState> {
  const raw = await page.evaluate(() => localStorage.getItem("pft-auth"));
  const parsed = JSON.parse(raw ?? "{}") as { state?: AuthState };
  const auth = parsed.state;
  expect(auth?.accessToken, "Expected auth state in localStorage after login or signup.").toBeTruthy();
  return auth!;
}

export async function apiGet<T>(request: APIRequestContext, route: string, token?: string): Promise<T> {
  const response = await request.get(`${backendBaseUrl}/api${route}`, {
    headers: authHeaders(token)
  });
  await expect(response, `GET ${route} should succeed`).toBeOK();
  return (await response.json()) as T;
}

export async function apiPost<T>(
  request: APIRequestContext,
  route: string,
  data: unknown,
  token?: string,
  expectedStatus = 200
): Promise<T> {
  const response = await request.post(`${backendBaseUrl}/api${route}`, {
    data,
    headers: authHeaders(token)
  });
  expect(response.status(), `POST ${route} returned unexpected status`).toBe(expectedStatus);
  return (await response.json()) as T;
}

export async function apiPut<T>(
  request: APIRequestContext,
  route: string,
  data: unknown,
  token?: string,
  expectedStatus = 200
): Promise<T> {
  const response = await request.put(`${backendBaseUrl}/api${route}`, {
    data,
    headers: authHeaders(token)
  });
  expect(response.status(), `PUT ${route} returned unexpected status`).toBe(expectedStatus);
  return (await response.json()) as T;
}

export async function apiDelete<T>(
  request: APIRequestContext,
  route: string,
  data: unknown | undefined,
  token?: string,
  expectedStatus = 200
): Promise<T | undefined> {
  const response = await request.delete(`${backendBaseUrl}/api${route}`, {
    data,
    headers: authHeaders(token)
  });
  expect(response.status(), `DELETE ${route} returned unexpected status`).toBe(expectedStatus);
  if (expectedStatus === 204) {
    return undefined;
  }
  return (await response.json()) as T;
}

export async function apiExpectStatus(
  request: APIRequestContext,
  method: "get" | "post" | "put" | "delete",
  route: string,
  token: string | undefined,
  expectedStatus: number,
  data?: unknown
) {
  const response = await request.fetch(`${backendBaseUrl}/api${route}`, {
    method: method.toUpperCase(),
    data,
    headers: authHeaders(token)
  });
  expect(response.status(), `${method.toUpperCase()} ${route} returned unexpected status`).toBe(expectedStatus);
  return response;
}

export async function registerUserViaApi(
  request: APIRequestContext,
  options?: { prefix?: string; displayName?: string; password?: string; domain?: string }
): Promise<TestUser & { auth: AuthState }> {
  const prefix = options?.prefix ?? "signoffapi";
  const displayName = options?.displayName ?? "API Signoff User";
  const password = options?.password ?? defaultPassword;
  const domain = options?.domain ?? "example.com";
  const email = `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@${domain}`;

  const auth = await apiPost<AuthState>(request, "/auth/register", {
    email,
    password,
    displayName
  });

  return {
    email,
    password,
    displayName,
    auth
  };
}

export async function createCsv(testInfo: TestInfo, fileName: string, content: string) {
  const filePath = testInfo.outputPath(fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

export function isoDate(daysOffset = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysOffset);
  return date.toISOString().slice(0, 10);
}

export function monthYearForNow() {
  const now = new Date();
  return { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
}

export function tinyPngFile() {
  return {
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pY2hQAAAABJRU5ErkJggg==",
      "base64"
    )
  };
}

function authHeaders(token?: string) {
  return {
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}
