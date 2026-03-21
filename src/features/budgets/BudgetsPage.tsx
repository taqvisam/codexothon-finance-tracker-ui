import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ActionIconButton } from "../../components/ActionIconButton";
import { Dropdown } from "../../components/Dropdown";
import { ProgressBar } from "../../components/ProgressBar";
import { TextInput } from "../../components/TextInput";
import { apiClient } from "../../services/apiClient";
import type { BudgetItem } from "../../types";
import { useCurrency } from "../../hooks/useCurrency";
import { useUiStore } from "../../store/uiStore";

interface Input {
  categoryId: string;
  month: number;
  year: number;
  amount: number;
  alertThresholdPercent: number;
}

interface CategoryItem {
  id: string;
  name: string;
  type: "Income" | "Expense";
}

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" }
];

export function BudgetsPage() {
  const currency = useCurrency();
  const queryClient = useQueryClient();
  const { notify, selectedPeriod } = useUiStore();
  const [selectedYear, selectedMonth] = selectedPeriod.split("-").map(Number);
  const [editId, setEditId] = useState<string | null>(null);
  const budgetDefaults = useMemo<Input>(() => ({
    categoryId: "",
    month: selectedMonth,
    year: selectedYear,
    amount: 0,
    alertThresholdPercent: 80
  }), [selectedMonth, selectedYear]);
  const { register, handleSubmit, reset, setValue, watch } = useForm<Input>({
    defaultValues: budgetDefaults
  });

  useEffect(() => {
    if (editId) return;
    setValue("month", selectedMonth, { shouldValidate: true });
    setValue("year", selectedYear, { shouldValidate: true });
  }, [editId, selectedMonth, selectedYear, setValue]);

  const budgetsQuery = useQuery({
    queryKey: ["budgets", selectedPeriod],
    queryFn: async () =>
      (await apiClient.get<BudgetItem[]>("/budgets", { params: { month: selectedMonth, year: selectedYear } })).data,
    initialData: []
  });

  const categoriesQuery = useQuery({
    queryKey: ["budget-categories"],
    queryFn: async () => (await apiClient.get<CategoryItem[]>("/categories")).data,
    initialData: []
  });

  const createMutation = useMutation({
    mutationFn: async (input: Input) => {
      if (editId) {
        return apiClient.put(`/budgets/${editId}`, input);
      }
      return apiClient.post("/budgets", input);
    },
    onSuccess: () => {
      notify(editId ? "Budget updated" : "Budget created");
      reset(budgetDefaults);
      setEditId(null);
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/budgets/${id}`),
    onSuccess: (_, id) => {
      notify("Budget deleted");
      if (editId === id) {
        setEditId(null);
        reset(budgetDefaults);
      }
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    }
  });

  const duplicateMutation = useMutation({
    mutationFn: async () =>
      apiClient.post("/budgets/duplicate-last-month", null, {
        params: { month: selectedMonth, year: selectedYear }
      }),
    onSuccess: () => {
      notify("Last month budgets duplicated");
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    }
  });

  const monthBudgetTotal = budgetsQuery.data.reduce((sum, b) => sum + b.amount, 0);
  const monthSpentTotal = budgetsQuery.data.reduce((sum, b) => sum + b.spentAmount, 0);
  const monthUsagePercent = monthBudgetTotal > 0 ? (monthSpentTotal / monthBudgetTotal) * 100 : 0;

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h3 style={{ marginBottom: 0 }}>Monthly Budget</h3>
          <span className="muted">
            {MONTH_OPTIONS.find((x) => Number(x.value) === selectedMonth)?.label} {selectedYear}
          </span>
        </div>
        <div className="budget-overview">
          <div>
            <div className="muted">Total Monthly Budget</div>
            <div className="big">{currency(monthBudgetTotal)}</div>
          </div>
          <div>
            <div className="muted" style={{ textAlign: "right" }}>
              {currency(monthSpentTotal)} on {currency(monthBudgetTotal)} budget
            </div>
            <ProgressBar value={monthUsagePercent} />
            <div className="muted" style={{ textAlign: "right", marginTop: 4 }}>
              {Math.round(monthUsagePercent)}% utilized
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h3>{editId ? "Edit Budget" : "Create Budget"}</h3>
        <form
          onSubmit={handleSubmit((data) => {
            if (!data.categoryId) {
              notify("Please select a category", "error");
              return;
            }
            createMutation.mutate(data);
          })}
        >
          <input type="hidden" {...register("categoryId")} />
          <input type="hidden" {...register("month", { valueAsNumber: true })} />
          <div className="form-grid">
            <Dropdown
              label="Category"
              options={[
                { value: "", label: "Select expense category" },
                ...categoriesQuery.data
                  .filter((category) => category.type === "Expense")
                  .map((category) => ({ value: category.id, label: category.name }))
              ]}
              value={watch("categoryId") ?? ""}
              onChange={(event) => setValue("categoryId", event.target.value)}
            />
            <Dropdown
              label="Budget Month"
              options={MONTH_OPTIONS}
              value={String(watch("month") ?? "")}
              onChange={(event) => setValue("month", Number(event.target.value), { shouldValidate: true })}
            />
            <TextInput label="Budget Year" type="number" min={2000} {...register("year", { valueAsNumber: true })} />
            <TextInput label="Budget Amount" type="number" min={0} step="0.01" {...register("amount", { valueAsNumber: true })} />
          </div>
          <div className="form-actions">
            <button className="btn" type="submit">{editId ? "Update Budget" : "Create Budget"}</button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => duplicateMutation.mutate()}
            >
              Duplicate Last Month
            </button>
            {editId ? (
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setEditId(null);
                  reset(budgetDefaults);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 style={{ marginBottom: 0 }}>Category-wise Budgets</h3>
          <span className="muted">{budgetsQuery.data.length} categories</span>
        </div>
        <div style={{ marginTop: 8 }}>
          {budgetsQuery.isError && <p className="error">API unavailable.</p>}
          {!budgetsQuery.isError && budgetsQuery.data.length === 0 && (
            <p className="muted">No budgets yet. Suggest budget creation.</p>
          )}
          {budgetsQuery.data.map((budget) => {
            const categoryName = categoriesQuery.data.find((category) => category.id === budget.categoryId)?.name ?? budget.categoryId;
            const percent = budget.amount ? (budget.spentAmount / budget.amount) * 100 : 0;
            const statusTone = percent >= 120 ? "budget-danger" : percent >= 100 ? "budget-warn" : "budget-ok";
            return (
              <article className="budget-row" key={budget.id}>
                <div>
                  <strong>{categoryName}</strong>
                  <div className="muted">{currency(budget.spentAmount)} / {currency(budget.amount)}</div>
                </div>
                <div>
                  <ProgressBar value={percent} />
                  <div className={`muted ${statusTone}`} style={{ marginTop: 4 }}>
                    {Math.round(percent)}% used
                  </div>
                </div>
                <div className="action-icon-row">
                  <ActionIconButton
                    icon="edit"
                    label="Edit budget"
                    onClick={() => {
                      setEditId(budget.id);
                      setValue("categoryId", budget.categoryId);
                      setValue("month", budget.month);
                      setValue("year", budget.year);
                      setValue("amount", budget.amount);
                      setValue("alertThresholdPercent", 80);
                    }}
                  />
                  <ActionIconButton
                    icon="delete"
                    label="Delete budget"
                    onClick={() => deleteMutation.mutate(budget.id)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
