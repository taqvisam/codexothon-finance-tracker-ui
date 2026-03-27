import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { apiClient } from "../../services/apiClient";
import { useUiStore } from "../../store/uiStore";
import { Dropdown } from "../../components/Dropdown";
import { TextInput } from "../../components/TextInput";
import { ActionIconButton } from "../../components/ActionIconButton";

interface RecurringItem {
  id: string;
  title: string;
  type: "Income" | "Expense";
  amount: number;
  categoryId?: string;
  accountId?: string;
  frequency: string;
  startDate: string;
  endDate?: string | null;
  nextRunDate: string;
  autoCreateTransaction: boolean;
  isPaused?: boolean;
}

interface Input {
  title: string;
  amount: number;
  accountId?: string;
  categoryId?: string;
  type: "Income" | "Expense";
  frequency: "Daily" | "Weekly" | "Monthly" | "Yearly";
  startDate: string;
  nextRunDate: string;
}

interface AccountItem {
  id: string;
  name: string;
}

interface CategoryItem {
  id: string;
  name: string;
  type: "Income" | "Expense";
}

export function RecurringPage() {
  const queryClient = useQueryClient();
  const { notify, dateFrom, dateTo, topbarSearch } = useUiStore();
  const [editId, setEditId] = useState<string | null>(null);
  const recurringDefaults: Input = {
    title: "",
    amount: 0,
    accountId: "",
    type: "Expense",
    frequency: "Monthly",
    startDate: new Date().toISOString().slice(0, 10),
    nextRunDate: new Date().toISOString().slice(0, 10)
  };
  const { register, handleSubmit, reset, setValue, watch } = useForm<Input>({
    defaultValues: recurringDefaults
  });

  const recurringQuery = useQuery({
    queryKey: ["recurring"],
    queryFn: async () => (await apiClient.get<RecurringItem[]>("/recurring")).data,
    initialData: []
  });

  const accountsQuery = useQuery({
    queryKey: ["recurring-accounts"],
    queryFn: async () => (await apiClient.get<AccountItem[]>("/accounts")).data,
    initialData: []
  });

  const categoriesQuery = useQuery({
    queryKey: ["recurring-categories"],
    queryFn: async () => (await apiClient.get<CategoryItem[]>("/categories")).data,
    initialData: []
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Input) => {
      const body = {
        ...payload,
        autoCreateTransaction: true,
        isPaused: false
      };
      if (editId) {
        return apiClient.put(`/recurring/${editId}`, body);
      }
      return apiClient.post("/recurring", body);
    },
    onSuccess: () => {
      notify(editId ? "Recurring item updated" : "Recurring item created");
      reset(recurringDefaults);
      setEditId(null);
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Recurring create failed. Check form values.";
      notify(message, "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/recurring/${id}`),
    onSuccess: (_, id) => {
      notify("Recurring item deleted");
      if (editId === id) {
        setEditId(null);
        reset(recurringDefaults);
      }
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
    }
  });

  const pauseMutation = useMutation({
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
    onSuccess: () => {
      notify("Recurring item updated");
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
    }
  });

  const selectedType = watch("type");
  const filteredCategories = categoriesQuery.data.filter((c) => c.type === selectedType);
  const monthRecurring = recurringQuery.data.filter((item) => item.nextRunDate >= dateFrom && item.nextRunDate <= dateTo);
  const normalizedSearch = topbarSearch.trim().toLowerCase();
  const filteredRecurring = useMemo(() => {
    if (!normalizedSearch) {
      return monthRecurring;
    }

    return monthRecurring.filter((item) =>
      [
        item.title,
        item.type,
        item.frequency,
        item.nextRunDate,
        item.isPaused ? "paused" : "active",
        String(item.amount)
      ].some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [monthRecurring, normalizedSearch]);

  return (
    <section className="card">
      <h3>Recurring Transactions</h3>
      <form onSubmit={handleSubmit((d) => createMutation.mutate(d))}>
        <div className="form-grid">
          <TextInput label="Title" placeholder="Title" {...register("title")} />
          <TextInput label="Amount" type="number" placeholder="Amount" {...register("amount", { valueAsNumber: true })} />
          <Dropdown
            label="Type"
            options={[
              { value: "Expense", label: "Expense" },
              { value: "Income", label: "Income" }
            ]}
            value={watch("type")}
            onChange={(e) => setValue("type", e.target.value as Input["type"])}
          />
          <Dropdown
            label="Account"
            options={[
              { value: "", label: "Select Account (Optional)" },
              ...accountsQuery.data.map((a) => ({ value: a.id, label: a.name }))
            ]}
            value={watch("accountId") ?? ""}
            onChange={(e) => setValue("accountId", e.target.value || undefined)}
          />
          <Dropdown
            label="Category"
            options={[
              { value: "", label: "Select Category (Optional)" },
              ...filteredCategories.map((c) => ({ value: c.id, label: c.name }))
            ]}
            value={watch("categoryId") ?? ""}
            onChange={(e) => setValue("categoryId", e.target.value || undefined)}
          />
          <Dropdown
            label="Frequency"
            options={[
              { value: "Daily", label: "Daily" },
              { value: "Weekly", label: "Weekly" },
              { value: "Monthly", label: "Monthly" },
              { value: "Yearly", label: "Yearly" }
            ]}
            value={watch("frequency")}
            onChange={(e) => setValue("frequency", e.target.value as Input["frequency"])}
          />
          <TextInput label="Start Date" type="date" {...register("startDate")} />
          <TextInput label="Next Run Date" type="date" {...register("nextRunDate")} />
        </div>
        <button className="btn" type="submit">{editId ? "Update Recurring" : "Create Recurring"}</button>
        {editId ? (
          <button
            className="btn ghost"
            type="button"
            style={{ marginLeft: 8 }}
            onClick={() => {
              setEditId(null);
              reset(recurringDefaults);
            }}
          >
            Cancel
          </button>
        ) : null}
      </form>
      <div style={{ marginTop: 16 }}>
        {recurringQuery.isError ? (
          <p className="error">Failed to load recurring items.</p>
        ) : monthRecurring.length === 0 ? (
          <p className="muted">No recurring items yet.</p>
        ) : filteredRecurring.length === 0 ? (
          <p className="muted">No recurring items match your search.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Amount</th>
                <th>Frequency</th>
                <th>Next Run</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecurring.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{r.amount}</td>
                  <td>{r.frequency}</td>
                  <td>{r.nextRunDate}</td>
                  <td>{r.isPaused ? "Paused" : "Active"}</td>
                  <td>
                    <div className="action-icon-row">
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => pauseMutation.mutate(r)}
                      >
                        {r.isPaused ? "Resume" : "Pause"}
                      </button>
                      <ActionIconButton
                        icon="edit"
                        label="Edit recurring item"
                        onClick={() => {
                          setEditId(r.id);
                          setValue("title", r.title);
                          setValue("type", r.type ?? "Expense");
                          setValue("amount", r.amount);
                          setValue("accountId", r.accountId ?? "");
                          setValue("categoryId", r.categoryId ?? "");
                          setValue("frequency", (r.frequency as Input["frequency"]) ?? "Monthly");
                          setValue("startDate", r.startDate ?? recurringDefaults.startDate);
                          setValue("nextRunDate", r.nextRunDate ?? recurringDefaults.nextRunDate);
                        }}
                      />
                      <ActionIconButton
                        icon="delete"
                        label="Delete recurring item"
                        onClick={() => deleteMutation.mutate(r.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
