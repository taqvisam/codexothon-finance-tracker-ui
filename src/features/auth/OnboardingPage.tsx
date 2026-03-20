import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Dropdown } from "../../components/Dropdown";
import { TextInput } from "../../components/TextInput";
import { apiClient } from "../../services/apiClient";
import { useUiStore } from "../../store/uiStore";

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
  budgetCategoryId?: string;
  budgetAmount?: number;
}

export function OnboardingPage() {
  const ONBOARDING_SKIP_KEY = "onboardingSkipped";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify, selectedPeriod } = useUiStore();
  const [year, month] = selectedPeriod.split("-").map(Number);
  const { register, handleSubmit, setValue, watch } = useForm<OnboardingInput>({
    defaultValues: {
      accountType: "Bank",
      openingBalance: 0,
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

  const createMutation = useMutation({
    mutationFn: async (data: OnboardingInput) => {
      await apiClient.post("/accounts", {
        name: data.accountName,
        type: data.accountType,
        openingBalance: data.openingBalance,
        institutionName: data.institutionName
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
      localStorage.removeItem(ONBOARDING_SKIP_KEY);
      await queryClient.invalidateQueries({ queryKey: ["onboarding-accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["onboarding-accounts-guard"] });
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
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

  useEffect(() => {
    if (accountsQuery.data.length > 0) {
      localStorage.removeItem(ONBOARDING_SKIP_KEY);
      navigate("/");
    }
  }, [accountsQuery.data.length, navigate, ONBOARDING_SKIP_KEY]);

  return (
    <section className="card">
      <h3>Welcome! Let&apos;s set up your account</h3>
      <p className="muted">Create your first account and optionally your first monthly budget.</p>
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
          <TextInput label="Institution Name" {...register("institutionName")} />
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

        <div style={{ display: "flex", gap: 8 }}>
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
    </section>
  );
}
