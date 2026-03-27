import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type FieldErrors } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { DataTable } from "../../components/DataTable";
import { apiClient } from "../../services/apiClient";
import type { TransactionItem } from "../../types";
import { useCurrency } from "../../hooks/useCurrency";
import { useUiStore } from "../../store/uiStore";
import { Button } from "../../components/Button";
import { TextInput } from "../../components/TextInput";
import { Dropdown } from "../../components/Dropdown";
import { ActionIconButton } from "../../components/ActionIconButton";

interface AccountItem {
  id: string;
  name: string;
}

interface CategoryItem {
  id: string;
  name: string;
  type: "Income" | "Expense";
}

interface HealthScoreResponse {
  score: number;
  suggestions: string[];
}

interface RecurringItem {
  id: string;
  title: string;
  amount: number;
  nextRunDate: string;
  isPaused: boolean;
  type: "Income" | "Expense" | "Transfer";
  categoryId?: string | null;
  accountId?: string | null;
  frequency: "Daily" | "Weekly" | "Monthly" | "Yearly";
  startDate: string;
  endDate?: string | null;
  autoCreateTransaction: boolean;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const schema = z.object({
  accountId: z.string().uuid("Account is required."),
  categoryId: z
    .string()
    .optional()
    .refine((value) => !value || uuidPattern.test(value), "Category is required."),
  transferAccountId: z
    .string()
    .optional()
    .refine((value) => !value || uuidPattern.test(value), "Destination account is required for transfer."),
  type: z.enum(["Income", "Expense", "Transfer"]),
  amount: z.number().positive(),
  date: z.string().min(1, "Date is required."),
  merchant: z.string().optional(),
  note: z.string().optional(),
  paymentMethod: z.string().optional(),
  tags: z.string().optional()
}).superRefine((value, ctx) => {
  if (value.type === "Transfer" && !value.transferAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Transfer requires destination account.",
      path: ["transferAccountId"]
    });
  }
  if (value.type !== "Transfer" && !value.categoryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Category is required except transfer.",
      path: ["categoryId"]
    });
  }
});

type Input = z.infer<typeof schema>;

function normalizeUuid(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const { dateFrom, dateTo, notify, topbarSearch, setTopbarSearch } = useUiStore();
  const todayIso = new Date().toISOString().slice(0, 10);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, watch } = useForm<Input>({
    resolver: zodResolver(schema),
    defaultValues: { type: "Expense", date: todayIso }
  });

  useEffect(() => {
    register("accountId");
    register("categoryId");
    register("transferAccountId");
    register("type");
  }, [register]);

  useEffect(() => {
    setSearch(topbarSearch);
    setPage(1);
  }, [topbarSearch]);

  const typeValue = watch("type");
  const accountIdValue = watch("accountId");

  const accountsQuery = useQuery({
    queryKey: ["txn-accounts"],
    queryFn: async () => (await apiClient.get<AccountItem[]>("/accounts")).data,
    initialData: []
  });

  const categoriesQuery = useQuery({
    queryKey: ["txn-categories"],
    queryFn: async () => (await apiClient.get<CategoryItem[]>("/categories")).data,
    initialData: []
  });

  const healthScoreQuery = useQuery({
    queryKey: ["txn-health-score"],
    queryFn: async () => (await apiClient.get<HealthScoreResponse>("/insights/health-score")).data
  });

  const recurringQuery = useQuery({
    queryKey: ["txn-recurring"],
    queryFn: async () => (await apiClient.get<RecurringItem[]>("/recurring")).data,
    initialData: []
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions", search, dateFrom, dateTo, page, pageSize, selectedType, selectedAccount, selectedCategory],
    queryFn: async () =>
      (
        await apiClient.get<TransactionItem[]>("/transactions", {
          params: {
            from: dateFrom,
            to: dateTo,
            search: search || undefined,
            page,
            pageSize,
            type: selectedType || undefined,
            accountId: selectedAccount || undefined,
            categoryId: selectedCategory || undefined
          }
        })
      ).data,
    initialData: []
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: Input) => {
      const normalizedCategoryId = normalizeUuid(data.categoryId);
      const normalizedTransferAccountId = normalizeUuid(data.transferAccountId);
      const payload = {
        accountId: data.accountId,
        categoryId: data.type === "Transfer" ? undefined : normalizedCategoryId,
        transferAccountId: data.type === "Transfer" ? normalizedTransferAccountId : undefined,
        type: data.type,
        amount: data.amount,
        date: data.date,
        merchant: data.merchant,
        note: data.note,
        paymentMethod: data.paymentMethod,
        tags: (data.tags ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      };

      if (editId) {
        return (await apiClient.put<TransactionItem>(`/transactions/${editId}`, payload)).data;
      }
      return (await apiClient.post<TransactionItem & { alerts?: string[] }>("/transactions", payload)).data;
    },
    onSuccess: async (savedTransaction) => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      notify(editId ? "Transaction updated" : "Transaction saved successfully");
      (savedTransaction.alerts ?? []).forEach((message) => notify(message, "warning"));
      setEditId(null);
      setPage(1);
      setSelectedType("");
      setSelectedAccount("");
      setSelectedCategory("");
      setSearch("");
      resetTransactionForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/transactions/${id}`),
    onSuccess: async (_, id) => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      notify("Transaction deleted");
      if (editId === id) {
        setEditId(null);
        resetTransactionForm();
      }
    }
  });

  const importMutation = useMutation({
    mutationFn: async (items: Input[]) =>
      (
        await apiClient.post<{ importedCount: number; alerts: string[] }>("/transactions/import", {
          items: items.map((item) => ({
            accountId: item.accountId,
            categoryId: item.categoryId || undefined,
            transferAccountId: item.transferAccountId || undefined,
            type: item.type,
            amount: item.amount,
            date: item.date,
            merchant: item.merchant,
            note: item.note,
            paymentMethod: item.paymentMethod,
            tags: (item.tags ?? "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean)
          }))
        })
      ).data,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      notify(`Imported ${result.importedCount} transactions`);
      result.alerts.forEach((message) => notify(message, "warning"));
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Import failed.";
      notify(message, "error");
    }
  });

  const recurringToggleMutation = useMutation({
    mutationFn: async (item: RecurringItem) =>
      apiClient.put(`/recurring/${item.id}`, {
        title: item.title,
        type: item.type,
        amount: item.amount,
        categoryId: item.categoryId,
        accountId: item.accountId,
        frequency: item.frequency,
        startDate: item.startDate,
        endDate: item.endDate,
        nextRunDate: item.nextRunDate,
        autoCreateTransaction: item.autoCreateTransaction,
        isPaused: !item.isPaused
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["txn-recurring"] })
  });

  const filteredCategories = useMemo(
    () => categoriesQuery.data.filter((c) => (typeValue === "Income" ? c.type === "Income" : c.type === "Expense")),
    [categoriesQuery.data, typeValue]
  );

  const transferDestinationOptions = useMemo(
    () => accountsQuery.data.filter((x) => x.id !== accountIdValue),
    [accountIdValue, accountsQuery.data]
  );

  const resetTransactionForm = () => {
    reset({ type: "Expense", date: todayIso } as Input);
    setValue("accountId", "" as unknown as Input["accountId"]);
    setValue("categoryId", undefined);
    setValue("transferAccountId", undefined);
    setValue("amount", undefined as unknown as Input["amount"]);
    setValue("merchant", "");
    setValue("paymentMethod", "");
    setValue("tags", "");
    setValue("note", "");
  };

  const notifyFirstValidationError = (errors: FieldErrors<Input>) => {
    const firstError = Object.values(errors).find((error) => error?.message);
    if (firstError?.message) {
      notify(String(firstError.message), "error");
      return;
    }

    notify("Please complete required transaction fields", "error");
  };

  const parseCsvLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === "\"") {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    cells.push(current.trim());
    return cells;
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      notify("CSV must include header and at least one row.", "error");
      return;
    }

    const header = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const get = (name: string) => values[header.indexOf(name)] ?? "";
      return {
        accountId: get("accountid"),
        categoryId: get("categoryid") || undefined,
        transferAccountId: get("transferaccountid") || undefined,
        type: (get("type") || "Expense") as Input["type"],
        amount: Number(get("amount")),
        date: get("date"),
        merchant: get("merchant") || undefined,
        note: get("note") || undefined,
        paymentMethod: get("paymentmethod") || undefined,
        tags: get("tags") || undefined
      } satisfies Input;
    });

    importMutation.mutate(rows);
  };

  return (
    <>
      <section className="card">
        <h3>{editId ? "Edit Transaction" : "Add Transaction"}</h3>
        <form
          onSubmit={handleSubmit(
            (data) => upsertMutation.mutate(data),
            (errors) => notifyFirstValidationError(errors)
          )}
        >
          <div className="form-grid">
            <Dropdown
              options={[{ value: "", label: "Select Account" }, ...accountsQuery.data.map((a) => ({ value: a.id, label: a.name }))]}
              value={watch("accountId") ?? ""}
              onChange={(e) => setValue("accountId", e.target.value)}
              label="Account"
            />
            <Dropdown
              options={[
                { value: "Expense", label: "Expense" },
                { value: "Income", label: "Income" },
                { value: "Transfer", label: "Transfer" }
              ]}
              value={watch("type")}
              onChange={(e) => setValue("type", e.target.value as Input["type"])}
              label="Type"
            />
            {typeValue !== "Transfer" ? (
              <Dropdown
                options={[{ value: "", label: "Select Category" }, ...filteredCategories.map((c) => ({ value: c.id, label: c.name }))]}
                value={watch("categoryId") ?? ""}
                onChange={(e) => setValue("categoryId", e.target.value || undefined)}
                label="Category"
              />
            ) : (
              <div style={{ alignSelf: "end" }}>
                <span className="muted">Category not required for transfer.</span>
              </div>
            )}
            {typeValue === "Transfer" ? (
              <Dropdown
                options={[{ value: "", label: "Select destination account" }, ...transferDestinationOptions.map((a) => ({ value: a.id, label: a.name }))]}
                value={watch("transferAccountId") ?? ""}
                onChange={(e) => setValue("transferAccountId", e.target.value || undefined)}
                label="Destination Account"
              />
            ) : null}
            <TextInput label="Amount" type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
            <TextInput label="Date" type="date" {...register("date")} />
            <TextInput label="Merchant" {...register("merchant")} />
            <TextInput label="Payment Method" placeholder="Card / Cash / UPI" {...register("paymentMethod")} />
            <TextInput label="Tags" placeholder="family, groceries" {...register("tags")} />
            <TextInput label="Note" {...register("note")} />
          </div>
          <div className="form-actions">
            <Button type="submit">{editId ? "Update Transaction" : "+ Add Transaction"}</Button>
            <Button type="button" variant="secondary" onClick={() => importInputRef.current?.click()}>
              Import CSV
            </Button>
            {editId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditId(null);
                  resetTransactionForm();
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                await handleImportFile(file);
              }
              event.target.value = "";
            }}
          />
        </form>
      </section>

      <section className="v2-page-grid">
        <article className="card">
          <div className="card-head">
            <h3 style={{ marginBottom: 0 }}>Transactions</h3>
            <span className="muted">Showing {transactionsQuery.data.length}</span>
          </div>

          <div className="form-grid" style={{ marginTop: 8 }}>
            <TextInput
              label="Search"
              placeholder="Merchant or note"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setTopbarSearch(e.target.value);
                setPage(1);
              }}
            />
            <Dropdown
              label="Type"
              options={[
                { value: "", label: "All Types" },
                { value: "Income", label: "Income" },
                { value: "Expense", label: "Expense" },
                { value: "Transfer", label: "Transfer" }
              ]}
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
            />
            <Dropdown
              label="Account"
              options={[{ value: "", label: "All Accounts" }, ...accountsQuery.data.map((a) => ({ value: a.id, label: a.name }))]}
              value={selectedAccount}
              onChange={(e) => { setSelectedAccount(e.target.value); setPage(1); }}
            />
            <Dropdown
              label="Category"
              options={[{ value: "", label: "All Categories" }, ...categoriesQuery.data.map((c) => ({ value: c.id, label: c.name }))]}
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            {transactionsQuery.isError ? (
              <p className="error">Failed to load transactions.</p>
            ) : transactionsQuery.data.length === 0 ? (
              <p className="muted">No transactions found.</p>
            ) : (
              <>
                <DataTable
                  rows={transactionsQuery.data}
                  columns={[
                    { key: "date", title: "Date", render: (r) => r.date },
                    { key: "merchant", title: "Merchant/Description", render: (r) => r.merchant ?? "-" },
                    { key: "type", title: "Category", render: (r) => r.type },
                    { key: "amount", title: "Amount", render: (r) => currency(r.amount) },
                    {
                      key: "actions",
                      title: "Actions",
                      render: (r) => (
                        <div className="action-icon-row">
                          <ActionIconButton
                            icon="edit"
                            label="Edit transaction"
                            onClick={() => {
                              setEditId(r.id);
                              setValue("accountId", r.accountId);
                              setValue("categoryId", normalizeUuid(r.categoryId));
                              setValue("type", r.type);
                              setValue("amount", r.amount);
                              setValue("date", r.date);
                              setValue("merchant", r.merchant);
                              setValue("paymentMethod", r.paymentMethod);
                              setValue("tags", r.tags?.join(", "));
                              setValue("transferAccountId", normalizeUuid(r.transferAccountId));
                              setValue("note", r.note);
                            }}
                          />
                          <ActionIconButton
                            icon="delete"
                            label="Delete transaction"
                            onClick={() => deleteMutation.mutate(r.id)}
                          />
                        </div>
                      )
                    }
                  ]}
                />
                <div className="pagination-actions">
                  <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span className="muted" style={{ alignSelf: "center" }}>Page {page}</span>
                  <Button type="button" variant="secondary" disabled={transactionsQuery.data.length < pageSize} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </>
            )}
          </div>
        </article>

        <aside className="v2-side-stack">
          <article className="card">
            <div className="card-head">
              <h4 style={{ marginBottom: 0 }}>Insights</h4>
              <span className="insight-pill">V2</span>
            </div>
            <p className="muted" style={{ marginBottom: 8 }}>
              Health Score: <strong>{Math.round(healthScoreQuery.data?.score ?? 0)}</strong>/100
            </p>
            {(healthScoreQuery.data?.suggestions ?? ["No insight suggestions available yet."])
              .slice(0, 3)
              .map((suggestion) => (
                <div className="insight-item" key={suggestion}>
                  <span className="insight-dot" aria-hidden="true">•</span>
                  <span>{suggestion}</span>
                </div>
              ))}
          </article>

          <article className="card">
            <div className="card-head">
              <h4 style={{ marginBottom: 0 }}>Recurring Expenses</h4>
            </div>
            {recurringQuery.data.length === 0 ? (
              <p className="muted">No recurring items configured.</p>
            ) : (
              recurringQuery.data.slice(0, 5).map((item) => (
                <div className="recurring-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <div className="muted">{currency(item.amount)} on {item.nextRunDate}</div>
                  </div>
                  <button
                    type="button"
                    className={`mini-switch${item.isPaused ? "" : " on"}`}
                    aria-label={item.isPaused ? "Enable recurring item" : "Pause recurring item"}
                    onClick={() => recurringToggleMutation.mutate(item)}
                  >
                    <span />
                  </button>
                </div>
              ))
            )}
          </article>
        </aside>
      </section>
    </>
  );
}
