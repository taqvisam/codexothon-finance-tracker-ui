import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import * as XLSX from "xlsx";
import { Dropdown } from "../../components/Dropdown";
import { TextInput } from "../../components/TextInput";
import { apiClient } from "../../services/apiClient";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import {
  CUSTOM_INSTITUTION_VALUE,
  INSTITUTION_OPTIONS,
  resolveInstitutionName
} from "../../constants/institutions";

interface AccountItem {
  id: string;
  name: string;
}

interface CategoryItem {
  id: string;
  name: string;
  type: "Income" | "Expense";
}

interface OnboardingInput {
  accountName: string;
  accountType: "Bank" | "CreditCard" | "CashWallet" | "Savings";
  openingBalance: number;
  institutionName?: string;
  customInstitution?: string;
  budgetCategoryId?: string;
  budgetAmount?: number;
}

interface WorkbookAccountRow {
  name: string;
  type: string;
  openingBalance: number;
  institutionName?: string;
}

interface WorkbookBudgetRow {
  category: string;
  amount: number;
  month: number;
  year: number;
  alertThresholdPercent?: number;
  accountName?: string;
}

interface WorkbookGoalRow {
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  linkedAccountName?: string;
  icon?: string;
  color?: string;
  status?: string;
}

interface WorkbookTransactionRow {
  accountName: string;
  type: string;
  amount: number;
  date: string;
  category?: string;
  transferAccountName?: string;
  merchant?: string;
  note?: string;
  paymentMethod?: string;
  tags?: string[];
}

interface WorkbookRecurringRow {
  title: string;
  type: string;
  amount: number;
  category?: string;
  accountName: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  nextRunDate: string;
  autoCreateTransaction: boolean;
  isPaused: boolean;
}

interface WorkbookRuleRow {
  name: string;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  actionType: string;
  actionValue: string;
  priority: number;
  isActive: boolean;
}

interface WorkbookImportPayload {
  accounts: WorkbookAccountRow[];
  budgets: WorkbookBudgetRow[];
  goals: WorkbookGoalRow[];
  transactions: WorkbookTransactionRow[];
  recurring: WorkbookRecurringRow[];
  rules: WorkbookRuleRow[];
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return ["true", "yes", "y", "1", "on"].includes(normalized);
}

function toIsoDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 102.4) / 10)} KB`;
  }

  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function mapRows(sheet: XLSX.WorkSheet | undefined) {
  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false
  });
}

function getSheet(workbook: XLSX.WorkBook, name: string) {
  const match = workbook.SheetNames.find((sheetName) => normalizeHeader(sheetName) === normalizeHeader(name));
  return match ? workbook.Sheets[match] : undefined;
}

function parseWorkbook(file: File): Promise<WorkbookImportPayload> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

    const accountRows = mapRows(getSheet(workbook, "Accounts")).map((row) => {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
      );

      return {
        name: String(normalized.accountname ?? normalized.name ?? "").trim(),
        type: String(normalized.accounttype ?? normalized.type ?? "Bank").trim(),
        openingBalance: toNumber(normalized.openingbalance),
        institutionName: toText(normalized.institution ?? normalized.institutionname ?? normalized.provider)
      } satisfies WorkbookAccountRow;
    }).filter((row) => row.name);

    const budgetRows = mapRows(getSheet(workbook, "Budgets")).map((row) => {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
      );

      return {
        category: String(normalized.category ?? "").trim(),
        amount: toNumber(normalized.amount),
        month: Math.round(toNumber(normalized.month)),
        year: Math.round(toNumber(normalized.year)),
        alertThresholdPercent: toNumber(normalized.alertthresholdpercent || 80),
        accountName: toText(normalized.account ?? normalized.accountname)
      } satisfies WorkbookBudgetRow;
    }).filter((row) => row.category);

    const goalRows = mapRows(getSheet(workbook, "Goals")).map((row) => {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
      );

      return {
        name: String(normalized.goalname ?? normalized.name ?? "").trim(),
        targetAmount: toNumber(normalized.targetamount),
        currentAmount: toNumber(normalized.currentamount),
        targetDate: toText(toIsoDate(normalized.targetdate)),
        linkedAccountName: toText(normalized.linkedaccount ?? normalized.linkedaccountname),
        icon: toText(normalized.icon),
        color: toText(normalized.color),
        status: toText(normalized.status)
      } satisfies WorkbookGoalRow;
    }).filter((row) => row.name);

    const transactionRows = mapRows(getSheet(workbook, "Transactions")).map((row) => {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
      );

      const rawTags = String(normalized.tags ?? "").trim();

      return {
        accountName: String(normalized.account ?? normalized.accountname ?? "").trim(),
        type: String(normalized.type ?? "Expense").trim(),
        amount: toNumber(normalized.amount),
        date: toIsoDate(normalized.date),
        category: toText(normalized.category),
        transferAccountName: toText(normalized.transferaccount ?? normalized.transferaccountname),
        merchant: toText(normalized.merchant),
        note: toText(normalized.note),
        paymentMethod: toText(normalized.paymentmethod),
        tags: rawTags
          ? rawTags.split(",").map((item) => item.trim()).filter(Boolean)
          : []
      } satisfies WorkbookTransactionRow;
    }).filter((row) => row.accountName && row.date && row.amount > 0);

    const recurringRows = mapRows(getSheet(workbook, "Recurring")).map((row) => {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
      );

      return {
        title: String(normalized.title ?? normalized.name ?? "").trim(),
        type: String(normalized.type ?? "Expense").trim(),
        amount: toNumber(normalized.amount),
        category: toText(normalized.category),
        accountName: String(normalized.account ?? normalized.accountname ?? "").trim(),
        frequency: String(normalized.frequency ?? "Monthly").trim(),
        startDate: toIsoDate(normalized.startdate),
        endDate: toText(toIsoDate(normalized.enddate)),
        nextRunDate: toIsoDate(normalized.nextrundate ?? normalized.nextdate ?? normalized.nextrun),
        autoCreateTransaction: toBoolean(normalized.autocreatetransaction, true),
        isPaused: toBoolean(normalized.ispaused, false)
      } satisfies WorkbookRecurringRow;
    }).filter((row) => row.title && row.accountName && row.startDate && row.nextRunDate && row.amount > 0);

    const ruleRows = mapRows(getSheet(workbook, "Rules")).map((row) => {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
      );

      return {
        name: String(normalized.name ?? normalized.rulename ?? "").trim(),
        conditionField: String(normalized.conditionfield ?? normalized.field ?? "").trim(),
        conditionOperator: String(normalized.conditionoperator ?? normalized.operator ?? "").trim(),
        conditionValue: String(normalized.conditionvalue ?? normalized.value ?? "").trim(),
        actionType: String(normalized.actiontype ?? "").trim(),
        actionValue: String(normalized.actionvalue ?? "").trim(),
        priority: Math.round(toNumber(normalized.priority)),
        isActive: toBoolean(normalized.isactive, true)
      } satisfies WorkbookRuleRow;
    }).filter((row) => row.name && row.conditionField && row.conditionOperator && row.conditionValue && row.actionType && row.actionValue);

    return {
      accounts: accountRows,
      budgets: budgetRows,
      goals: goalRows,
      transactions: transactionRows,
      recurring: recurringRows,
      rules: ruleRows
    };
  });
}

export function OnboardingPage() {
  const ONBOARDING_SKIP_KEY = "onboardingSkipped";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const email = useAuthStore((s) => s.email);
  const { notify, selectedPeriod } = useUiStore();
  const [year, month] = selectedPeriod.split("-").map(Number);
  const [setupMode, setSetupMode] = useState<"manual" | "import">("import");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showV2Intro, setShowV2Intro] = useState(false);
  const { register, handleSubmit, setValue, watch } = useForm<OnboardingInput>({
    defaultValues: {
      accountType: "Bank",
      openingBalance: 0,
      customInstitution: "",
      budgetCategoryId: "",
      budgetAmount: 0
    }
  });

  const accountsQuery = useQuery({
    queryKey: ["onboarding-accounts"],
    queryFn: async () => (await apiClient.get<AccountItem[]>("/accounts")).data,
    initialData: []
  });

  const categoriesQuery = useQuery({
    queryKey: ["onboarding-categories"],
    queryFn: async () => (await apiClient.get<CategoryItem[]>("/categories")).data,
    initialData: []
  });

  const invalidatePostOnboarding = async () => {
    localStorage.removeItem(ONBOARDING_SKIP_KEY);
    await queryClient.invalidateQueries({ queryKey: ["onboarding-accounts"] });
    await queryClient.invalidateQueries({ queryKey: ["onboarding-accounts-guard"] });
    await queryClient.invalidateQueries({ queryKey: ["accounts"] });
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    await queryClient.invalidateQueries({ queryKey: ["budgets"] });
    await queryClient.invalidateQueries({ queryKey: ["goals"] });
    await queryClient.invalidateQueries({ queryKey: ["recurring"] });
    await queryClient.invalidateQueries({ queryKey: ["rules"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: OnboardingInput) => {
      const institution = resolveInstitutionName(data.institutionName ?? "", data.customInstitution ?? "");
      await apiClient.post("/accounts", {
        name: data.accountName,
        type: data.accountType,
        openingBalance: data.openingBalance,
        institutionName: institution || undefined
      });

      if (data.budgetCategoryId && (data.budgetAmount ?? 0) > 0) {
        await apiClient.post("/budgets", {
          categoryId: data.budgetCategoryId,
          month,
          year,
          amount: data.budgetAmount,
          alertThresholdPercent: 80
        });
      }
    },
    onSuccess: async () => {
      await invalidatePostOnboarding();
      notify("Onboarding completed");
      navigate("/");
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Onboarding failed.";
      notify(message, "error");
    }
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const payload = await parseWorkbook(file);
      return (
        await apiClient.post("/onboarding/import", payload)
      ).data as {
        accountsCreated: number;
        categoriesCreated: number;
        budgetsCreated: number;
        goalsCreated: number;
        transactionsCreated: number;
        recurringCreated: number;
        rulesCreated: number;
      };
    },
    onSuccess: async (result) => {
      await invalidatePostOnboarding();
      notify(
        `Imported ${result.accountsCreated} accounts, ${result.budgetsCreated} budgets, ${result.goalsCreated} goals, ${result.transactionsCreated} transactions, ${result.recurringCreated} recurring items, and ${result.rulesCreated} rules.`
      );
      navigate("/");
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Workbook import failed.";
      notify(message, "error");
    }
  });

  useEffect(() => {
    if (accountsQuery.data.length > 0) {
      localStorage.removeItem(ONBOARDING_SKIP_KEY);
      navigate("/");
    }
  }, [accountsQuery.data.length, navigate, ONBOARDING_SKIP_KEY]);

  useEffect(() => {
    if (!email || accountsQuery.isFetching || accountsQuery.data.length > 0) {
      return;
    }

    const seenKey = `v2-intro-seen:${email.toLowerCase()}`;
    if (localStorage.getItem(seenKey) === "true") {
      return;
    }

    setShowV2Intro(true);
  }, [accountsQuery.data.length, accountsQuery.isFetching, email]);

  const onboardingHighlights = useMemo(() => ([
    { value: "6 months", label: "recent cash-flow history" },
    { value: "6 sheets", label: "human-readable workbook tabs" },
    { value: "0 IDs", label: "database values needed" }
  ]), []);

  const importSheets = useMemo(() => ([
    {
      title: "Accounts",
      description: "Bank, credit, savings, and wallet balances with provider names.",
      fields: "name, type, opening balance, institution"
    },
    {
      title: "Budgets",
      description: "Monthly caps for core categories so health score and alerts feel real immediately.",
      fields: "category, amount, month, year, optional account"
    },
    {
      title: "Goals",
      description: "Long-term savings targets with progress and linked accounts.",
      fields: "name, target amount, current amount, target date, linked account"
    },
    {
      title: "Transactions",
      description: "Income, expenses, and transfers across the last six months.",
      fields: "account, type, amount, date, category, merchant, note, payment method, tags"
    },
    {
      title: "Recurring",
      description: "Future salary, rent, subscriptions, and other repeated cash flows for forecasting and the recurring page.",
      fields: "title, type, amount, category, account, frequency, start date, next run date"
    },
    {
      title: "Rules",
      description: "Auto-categorization, tags, and alerts that immediately populate the rules engine page.",
      fields: "name, condition field/operator/value, action type/value, priority, active"
    }
  ]), []);

  const onboardingBenefits = useMemo(() => ([
    "Forecasts get useful immediately with recent transaction patterns.",
    "Insights highlights light up with month-over-month changes.",
    "Budgets, goals, recurring plans, and rules land in the app already connected."
  ]), []);

  const v2FeatureHighlights = useMemo(() => ([
    {
      title: "New V2 UI",
      description: "Sharper dashboard cards, cleaner navigation, better dark mode, and a stronger first-run experience."
    },
    {
      title: "Smart onboarding import",
      description: "Load one workbook with accounts, budgets, goals, transactions, recurring items, and rules."
    },
    {
      title: "Cash flow + health",
      description: "Projected balance, safe-to-spend, daily forecasting, and a financial health score with breakdown."
    },
    {
      title: "Automation built in",
      description: "Recurring cash flows and rules engine automation are now first-class pages from day one."
    },
    {
      title: "Richer insights",
      description: "Insights highlights, trends, reporting comparisons, and stronger dashboard signals out of the box."
    },
    {
      title: "Mobile-ready workflows",
      description: "Responsive forms, cleaner tables, and onboarding that works properly on smaller screens."
    }
  ]), []);

  const selectedFileSummary = useMemo(() => {
    if (!importFile) {
      return null;
    }

    return {
      name: importFile.name,
      size: formatFileSize(importFile.size)
    };
  }, [importFile]);

  const dismissV2Intro = () => {
    if (email) {
      localStorage.setItem(`v2-intro-seen:${email.toLowerCase()}`, "true");
    }
    setShowV2Intro(false);
  };

  return (
    <>
      <section className="card onboarding-card">
        <div className="onboarding-hero">
          <div className="onboarding-hero-copy">
            <span className="onboarding-eyebrow">First-run setup</span>
            <h3>Load a rich finance history in one move</h3>
            <p className="muted">
              Start with a workbook that brings in accounts, budgets, goals, recurring items, rules, and recent transactions so the dashboard feels alive from the first screen.
            </p>
            <div className="onboarding-highlight-row">
              {onboardingHighlights.map((item) => (
                <div key={item.label} className="onboarding-highlight-chip">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="onboarding-hero-preview" aria-hidden="true">
            <div className="onboarding-preview-card">
              <span className="onboarding-preview-kicker">What lands instantly</span>
              <div className="onboarding-preview-metric">
                <strong>Forecasts + Insights</strong>
                <span>ready from day one</span>
              </div>
              <div className="onboarding-preview-bars">
                <span className="onboarding-preview-bar preview-bar-1" />
                <span className="onboarding-preview-bar preview-bar-2" />
                <span className="onboarding-preview-bar preview-bar-3" />
                <span className="onboarding-preview-bar preview-bar-4" />
                <span className="onboarding-preview-bar preview-bar-5" />
              </div>
              <div className="onboarding-preview-points">
                <span className="preview-point active" />
                <span className="preview-point" />
                <span className="preview-point" />
              </div>
            </div>
          </div>
        </div>

        <div className="onboarding-mode-switch">
          <button
            type="button"
            className={setupMode === "manual" ? "active" : ""}
            onClick={() => setSetupMode("manual")}
          >
            Manual setup
          </button>
          <button
            type="button"
            className={setupMode === "import" ? "active" : ""}
            onClick={() => setSetupMode("import")}
          >
            Import workbook
          </button>
        </div>

        {setupMode === "manual" ? (
          <form className="onboarding-manual-form" onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
            <div className="onboarding-manual-intro">
              <div>
                <h4>Manual setup</h4>
                <p className="muted">
                  Best when you want to add one account and maybe a single monthly budget, then build the rest inside the app.
                </p>
              </div>
              <div className="onboarding-manual-badge">Simple start</div>
            </div>
            <div className="form-grid">
              <TextInput label="Account Name" {...register("accountName")} />
              <Dropdown
                label="Account Type"
                options={[
                  { value: "Bank", label: "Bank account" },
                  { value: "CreditCard", label: "Credit card" },
                  { value: "CashWallet", label: "Cash wallet" },
                  { value: "Savings", label: "Savings account" }
                ]}
                value={watch("accountType")}
                onChange={(e) => setValue("accountType", e.target.value as OnboardingInput["accountType"])}
              />
              <TextInput label="Opening Balance" type="number" step="0.01" {...register("openingBalance", { valueAsNumber: true })} />
              <Dropdown
                label="Institution / Provider"
                options={[
                  { value: "", label: "Select institution (optional)" },
                  ...INSTITUTION_OPTIONS.map((name) => ({ value: name, label: name })),
                  { value: CUSTOM_INSTITUTION_VALUE, label: "Other (Enter custom)" }
                ]}
                value={watch("institutionName") ?? ""}
                onChange={(e) => setValue("institutionName", e.target.value)}
              />
              {(watch("institutionName") ?? "") === CUSTOM_INSTITUTION_VALUE ? (
                <TextInput label="Custom Institution" {...register("customInstitution")} />
              ) : null}
            </div>

            <h4 style={{ marginTop: 14 }}>Optional: first monthly budget</h4>
            <div className="form-grid">
              <Dropdown
                label="Budget Category"
                options={[
                  { value: "", label: "Skip for now" },
                  ...categoriesQuery.data
                    .filter((c) => c.type === "Expense")
                    .map((c) => ({ value: c.id, label: c.name }))
                ]}
                value={watch("budgetCategoryId") ?? ""}
                onChange={(e) => setValue("budgetCategoryId", e.target.value)}
              />
              <TextInput label="Budget Amount" type="number" step="0.01" {...register("budgetAmount", { valueAsNumber: true })} />
            </div>

            <div className="form-actions onboarding-actions">
              <button className="btn onboarding-primary-action" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Finish Onboarding"}
              </button>
              <button
                className="btn ghost onboarding-secondary-action"
                type="button"
                onClick={() => {
                  localStorage.setItem(ONBOARDING_SKIP_KEY, "true");
                  navigate("/");
                }}
              >
                Skip
              </button>
            </div>
          </form>
        ) : (
          <div className="onboarding-import-grid">
            <article className="onboarding-import-card onboarding-import-primary">
              <div className="onboarding-import-head">
                <div>
                  <span className="onboarding-inline-kicker">Recommended</span>
                  <h4>Bulk import from workbook</h4>
                </div>
                <div className="onboarding-inline-badge">Fastest setup</div>
              </div>
              <p className="muted">
                Upload a single Excel workbook and let the backend create the right records, balances, categories, and trends for you.
              </p>

              <div className="onboarding-template-links">
                <a className="btn onboarding-template-download" href="/sample-onboarding-import.xlsx" download>
                  Download sample workbook
                </a>
                <p className="muted onboarding-template-caption">
                  Includes accounts, budgets, goals, recurring items, rules, and rich six-month transaction history tuned for dashboard and Insights signals.
                </p>
              </div>

              <label className="onboarding-file-drop" htmlFor="onboarding-import-file">
                <span className="onboarding-file-drop-kicker">Excel workbook</span>
                <strong>{selectedFileSummary ? selectedFileSummary.name : "Choose a workbook to import"}</strong>
                <span className="muted">
                  {selectedFileSummary
                    ? `${selectedFileSummary.size} selected. Ready to create your workspace.`
                    : "Supports .xlsx and .xls. Use your own file or start from the sample."}
                </span>
                <span className="onboarding-file-drop-action">
                  {selectedFileSummary ? "Change file" : "Select file"}
                </span>
              </label>
              <input
                id="onboarding-import-file"
                className="onboarding-file-input"
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />

              <div className="onboarding-import-benefits">
                {onboardingBenefits.map((benefit) => (
                  <div key={benefit} className="onboarding-benefit-pill">{benefit}</div>
                ))}
              </div>

              <div className="form-actions onboarding-actions">
                <button
                  className="btn onboarding-primary-action"
                  type="button"
                  disabled={!importFile || importMutation.isPending}
                  onClick={() => importFile && importMutation.mutate(importFile)}
                >
                  {importMutation.isPending ? "Processing workbook..." : "Load workbook and continue"}
                </button>
                <button
                  className="btn ghost onboarding-secondary-action"
                  type="button"
                  onClick={() => {
                    localStorage.setItem(ONBOARDING_SKIP_KEY, "true");
                    navigate("/");
                  }}
                >
                  Skip
                </button>
              </div>

              {importMutation.isPending ? (
                <div className="onboarding-import-status">
                  <span className="onboarding-spinner" aria-hidden="true" />
                  <div>
                    <strong>Processing your workbook</strong>
                    <p className="muted">Creating accounts, categories, budgets, goals, recurring items, rules, and transactions. This may take a few seconds.</p>
                  </div>
                </div>
              ) : null}
            </article>

            <article className="onboarding-import-card subtle">
              <div className="onboarding-import-head compact">
                <div>
                  <span className="onboarding-inline-kicker">Workbook map</span>
                  <h4>What the import creates</h4>
                </div>
              </div>
              <div className="onboarding-sheet-grid">
                {importSheets.map((sheet) => (
                  <div key={sheet.title} className="onboarding-sheet-card">
                    <strong>{sheet.title}</strong>
                    <p>{sheet.description}</p>
                    <span>{sheet.fields}</span>
                  </div>
                ))}
              </div>
              <p className="muted onboarding-import-note">
                Use human-readable values only. No database IDs are needed. Categories and account mappings are resolved automatically during import.
              </p>
              <p className="muted onboarding-import-note">
                The sample workbook is tuned to populate dashboard forecasts, financial health trends, recurring cash flows, rule automation, and Insights highlights with recent six-month data.
              </p>
            </article>
          </div>
        )}
      </section>

      {showV2Intro ? (
        <div className="goal-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="v2-intro-title">
          <div className="goal-modal-card v2-intro-modal">
            <div className="v2-intro-head">
              <span className="v2-intro-badge">What&apos;s new in V2</span>
              <h3 id="v2-intro-title">Your workspace just got a major upgrade</h3>
              <p className="muted">
                Before you start, here are the biggest improvements now available in Personal Finance Tracker V2.
              </p>
            </div>

            <div className="v2-intro-grid">
              {v2FeatureHighlights.map((feature) => (
                <article key={feature.title} className="v2-intro-tile">
                  <strong>{feature.title}</strong>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>

            <div className="v2-intro-footer">
              <div className="v2-intro-footer-note">
                Recommended next step: start with the sample workbook if you want dashboards, insights, rules, and recurring data populated immediately.
              </div>
              <div className="form-actions onboarding-actions v2-intro-actions">
                <button
                  className="btn onboarding-primary-action"
                  type="button"
                  onClick={() => {
                    setSetupMode("import");
                    dismissV2Intro();
                  }}
                >
                  Experience V2
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
