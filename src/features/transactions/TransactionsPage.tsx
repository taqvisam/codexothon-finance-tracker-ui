import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
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

const schema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  transferAccountId: z.string().uuid().optional(),
  type: z.enum(["Income", "Expense", "Transfer"]),
  amount: z.number().positive(),
  date: z.string(),
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

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const { dateFrom, dateTo, notify } = useUiStore();
  const todayIso = new Date().toISOString().slice(0, 10);
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

  const typeValue = watch("type");
  const accountIdValue = watch("accountId");
  const categoryIdValue = watch("categoryId");

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
      const payload = {
        accountId: data.accountId,
        categoryId: data.type === "Transfer" ? undefined : data.categoryId,
        transferAccountId: data.type === "Transfer" ? data.transferAccountId : undefined,
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
        return apiClient.put(`/transactions/${editId}`, payload);
      }
      return apiClient.post("/transactions", payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      notify(editId ? "Transaction updated" : "Transaction saved successfully");
      setEditId(null);
      setPage(1);
      setSelectedType("");
      setSelectedAccount("");
      setSelectedCategory("");
      setSearch("");
      reset({ type: "Expense", date: todayIso } as Input);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/transactions/${id}`),
    onSuccess: async (_, id) => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      notify("Transaction deleted");
      if (editId === id) {
        setEditId(null);
        reset({ type: "Expense", date: todayIso } as Input);
      }
    }
  });

  const filteredCategories = useMemo(
    () => categoriesQuery.data.filter((c) => (typeValue === "Income" ? c.type === "Income" : c.type === "Expense")),
    [categoriesQuery.data, typeValue]
  );

  const transferDestinationOptions = useMemo(
    () => accountsQuery.data.filter((x) => x.id !== accountIdValue),
    [accountIdValue, accountsQuery.data]
  );

  useEffect(() => {
    if (!accountIdValue && accountsQuery.data.length > 0) {
      setValue("accountId", accountsQuery.data[0].id, { shouldValidate: true });
    }
  }, [accountIdValue, accountsQuery.data, setValue]);

  useEffect(() => {
    if (typeValue === "Transfer") {
      if (categoryIdValue) {
        setValue("categoryId", undefined, { shouldValidate: true });
      }
      const transferValue = watch("transferAccountId");
      if (!transferValue && transferDestinationOptions.length > 0) {
        setValue("transferAccountId", transferDestinationOptions[0].id, { shouldValidate: true });
      }
      return;
    }

    if (!categoryIdValue && filteredCategories.length > 0) {
      setValue("categoryId", filteredCategories[0].id, { shouldValidate: true });
    }
  }, [categoryIdValue, filteredCategories, setValue, transferDestinationOptions, typeValue, watch]);

  return (
    <section className="card">
      <h3>Transactions</h3>
      <form
        onSubmit={handleSubmit(
          (data) => upsertMutation.mutate(data),
          () => notify("Please complete required transaction fields")
        )}
      >
        <div className="form-grid">
          <Dropdown
            options={accountsQuery.data.map((a) => ({ value: a.id, label: a.name }))}
            value={watch("accountId")}
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
        <div style={{ display: "flex", gap: 8 }}>
          <Button type="submit">{editId ? "Update Transaction" : "+ Add Transaction"}</Button>
          {editId ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditId(null);
                reset({ type: "Expense", date: todayIso } as Input);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      <div className="form-grid" style={{ marginTop: 16 }}>
        <TextInput
          label="Search"
          placeholder="Merchant or note"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Dropdown
          label="Filter Type"
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
          label="Filter Account"
          options={[{ value: "", label: "All Accounts" }, ...accountsQuery.data.map((a) => ({ value: a.id, label: a.name }))]}
          value={selectedAccount}
          onChange={(e) => { setSelectedAccount(e.target.value); setPage(1); }}
        />
        <Dropdown
          label="Filter Category"
          options={[{ value: "", label: "All Categories" }, ...categoriesQuery.data.map((c) => ({ value: c.id, label: c.name }))]}
          value={selectedCategory}
          onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
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
                { key: "merchant", title: "Description", render: (r) => r.merchant ?? "-" },
                { key: "type", title: "Type", render: (r) => r.type },
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
                          setValue("categoryId", r.categoryId);
                          setValue("type", r.type);
                          setValue("amount", r.amount);
                          setValue("date", r.date);
                          setValue("merchant", r.merchant);
                          setValue("paymentMethod", r.paymentMethod);
                          setValue("tags", r.tags?.join(", "));
                          setValue("transferAccountId", r.transferAccountId);
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
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
              <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="muted" style={{ alignSelf: "center" }}>Page {page}</span>
              <Button type="button" variant="secondary" disabled={transactionsQuery.data.length < pageSize} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
