import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import * as XLSX from "xlsx";
import { Dropdown } from "../../components/Dropdown";
import { TextInput } from "../../components/TextInput";
import { apiClient } from "../../services/apiClient";
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

interface WorkbookImportPayload {
  accounts: WorkbookAccountRow[];
  budgets: WorkbookBudgetRow[];
  goals: WorkbookGoalRow[];
  transactions: WorkbookTransactionRow[];
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

    return {
      accounts: accountRows,
      budgets: budgetRows,
      goals: goalRows,
      transactions: transactionRows
    };
  });
}

export function OnboardingPage() {
  const ONBOARDING_SKIP_KEY = "onboardingSkipped";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify, selectedPeriod } = useUiStore();
  const [year, month] = selectedPeriod.split("-").map(Number);
  const [setupMode, setSetupMode] = useState<"manual" | "import">("manual");
  const [importFile, setImportFile] = useState<File | null>(null);
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
      };
    },
    onSuccess: async (result) => {
      await invalidatePostOnboarding();
      notify(
        `Imported ${result.accountsCreated} accounts, ${result.budgetsCreated} budgets, ${result.goalsCreated} goals, and ${result.transactionsCreated} transactions.`
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

  const importSummary = useMemo(() => (
    [
      "Accounts sheet: name, type, opening balance, institution",
      "Budgets sheet: category, amount, month, year, optional account",
      "Goals sheet: name, target amount, current amount, target date, linked account",
      "Transactions sheet: account, type, amount, date, category, merchant, note, payment method, tags"
    ]
  ), []);

  return (
    <section className="card onboarding-card">
      <h3>Welcome! Let&apos;s set up your workspace</h3>
      <p className="muted">
        Start manually or load a ready-made workbook with accounts, budgets, goals, and six months of transactions.
      </p>

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
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
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

          <div className="form-actions">
            <button className="btn" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Finish Onboarding"}
            </button>
            <button
              className="btn ghost"
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
          <article className="onboarding-import-card">
            <h4>Bulk import from workbook</h4>
            <p className="muted">
              Upload a single Excel workbook and let the backend create the right records and balances for you.
            </p>
            <div className="onboarding-template-links">
              <a className="btn ghost" href="/sample-onboarding-import.xlsx" download>
                Download sample workbook
              </a>
            </div>
            <label className="input-label" htmlFor="onboarding-import-file">Excel file</label>
            <input
              id="onboarding-import-file"
              className="input import-file-input"
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
            />
            {importFile ? <div className="muted import-file-name">Selected: {importFile.name}</div> : null}
            <div className="form-actions">
              <button
                className="btn"
                type="button"
                disabled={!importFile || importMutation.isPending}
                onClick={() => importFile && importMutation.mutate(importFile)}
              >
                {importMutation.isPending ? "Processing workbook..." : "Load workbook and continue"}
              </button>
              <button
                className="btn ghost"
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
                  <p className="muted">Creating accounts, categories, budgets, goals, and transactions. This may take a few seconds.</p>
                </div>
              </div>
            ) : null}
          </article>

          <article className="onboarding-import-card subtle">
            <h4>Workbook structure</h4>
            <div className="onboarding-import-list">
              {importSummary.map((line) => (
                <div key={line} className="onboarding-import-list-item">{line}</div>
              ))}
            </div>
            <p className="muted onboarding-import-note">
              Use human-readable values only. No database IDs are needed. Categories and account mappings are resolved automatically during import.
            </p>
          </article>
        </div>
      )}
    </section>
  );
}
