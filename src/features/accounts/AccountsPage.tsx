import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable } from "../../components/DataTable";
import { ActionIconButton } from "../../components/ActionIconButton";
import { apiClient } from "../../services/apiClient";
import { useCurrency } from "../../hooks/useCurrency";
import { useUiStore } from "../../store/uiStore";

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}

interface Input {
  name: string;
  type: "Bank" | "CreditCard" | "CashWallet" | "Savings";
  openingBalance: number;
  institutionName?: string;
}

interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
}

export function AccountsPage() {
  const currency = useCurrency();
  const queryClient = useQueryClient();
  const { notify } = useUiStore();
  const [editId, setEditId] = useState<string | null>(null);
  const accountDefaults: Input = {
    name: "",
    type: "Bank",
    openingBalance: 0,
    institutionName: ""
  };
  const transferDefaults: TransferInput = {
    fromAccountId: "",
    toAccountId: "",
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    note: ""
  };
  const { register, handleSubmit, reset, setValue } = useForm<Input>({
    defaultValues: accountDefaults
  });
  const transferForm = useForm<TransferInput>({
    defaultValues: transferDefaults
  });

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await apiClient.get<Account[]>("/accounts")).data,
    initialData: []
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Input) => {
      if (editId) {
        return apiClient.put(`/accounts/${editId}`, payload);
      }
      return apiClient.post("/accounts", payload);
    },
    onSuccess: () => {
      notify(editId ? "Account updated" : "Account created");
      reset(accountDefaults);
      setEditId(null);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    }
  });

  const transferMutation = useMutation({
    mutationFn: async (payload: TransferInput) => apiClient.post("/accounts/transfer", payload),
    onSuccess: () => {
      notify("Transfer completed");
      transferForm.reset(transferDefaults);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/accounts/${id}`),
    onSuccess: () => {
      notify("Account deleted");
      if (editId) {
        setEditId(null);
        reset(accountDefaults);
      }
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    }
  });

  return (
    <section className="card">
      <h3>Accounts</h3>
      <form onSubmit={handleSubmit((d) => createMutation.mutate(d))}>
        <div className="form-grid">
          <input className="input" placeholder="Account Name" {...register("name")} />
          <select className="select" {...register("type")}>
            <option>Bank</option><option>CreditCard</option><option>CashWallet</option><option>Savings</option>
          </select>
          <input className="input" type="number" placeholder="Opening Balance" {...register("openingBalance", { valueAsNumber: true })} />
          <input className="input" placeholder="Institution" {...register("institutionName")} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="submit">{editId ? "Update Account" : "Create Account"}</button>
          {editId ? (
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setEditId(null);
                reset(accountDefaults);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      <h4 style={{ marginTop: 18 }}>Transfer Funds</h4>
      <form onSubmit={transferForm.handleSubmit((d) => transferMutation.mutate(d))}>
        <div className="form-grid">
          <input className="input" placeholder="From Account ID" {...transferForm.register("fromAccountId")} />
          <input className="input" placeholder="To Account ID" {...transferForm.register("toAccountId")} />
          <input className="input" type="number" placeholder="Amount" {...transferForm.register("amount", { valueAsNumber: true })} />
          <input className="input" type="date" {...transferForm.register("date")} />
        </div>
        <button className="btn" type="submit">Transfer</button>
      </form>
      <div style={{ marginTop: 16 }}>
        {accountsQuery.isError ? (
          <p className="error">Failed to load accounts.</p>
        ) : accountsQuery.data.length === 0 ? (
          <p className="muted">No accounts yet. Create your first account.</p>
        ) : (
          <DataTable
            rows={accountsQuery.data}
            columns={[
              { key: "name", title: "Name", render: (r) => r.name },
              { key: "type", title: "Type", render: (r) => r.type },
              { key: "bal", title: "Current Balance", render: (r) => currency(r.currentBalance) },
              {
                key: "actions",
                title: "Actions",
                render: (r) => (
                  <div className="action-icon-row">
                    <ActionIconButton
                      icon="edit"
                      label="Edit account"
                      onClick={() => {
                        setEditId(r.id);
                        setValue("name", r.name);
                        setValue("type", r.type as Input["type"]);
                        setValue("openingBalance", r.currentBalance);
                      }}
                    />
                    <ActionIconButton
                      icon="delete"
                      label="Delete account"
                      onClick={() => {
                        if (!window.confirm(`Delete account "${r.name}"?`)) {
                          return;
                        }
                        deleteMutation.mutate(r.id);
                      }}
                    />
                  </div>
                )
              }
            ]}
          />
        )}
      </div>
    </section>
  );
}
