import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable } from "../../components/DataTable";
import { ActionIconButton } from "../../components/ActionIconButton";
import { apiClient } from "../../services/apiClient";
import { useCurrency } from "../../hooks/useCurrency";
import { useUiStore } from "../../store/uiStore";
import { Dropdown } from "../../components/Dropdown";
import { TextInput } from "../../components/TextInput";
import { SharedAccountPanel } from "./SharedAccountPanel";
import { optionalLooseNumber, requiredLooseNumber } from "../../utils/numberInput";
import {
  CUSTOM_INSTITUTION_VALUE,
  INSTITUTION_OPTIONS,
  resolveInstitutionName,
  splitInstitutionName
} from "../../constants/institutions";

interface Account {
  id: string;
  name: string;
  type: string;
  openingBalance: number;
  balanceAtPeriodStart?: number | null;
  currentBalance: number;
  creditLimit?: number | null;
  availableCredit?: number | null;
  institutionName?: string;
  isShared: boolean;
}

interface Input {
  name: string;
  type: "Bank" | "CreditCard" | "CashWallet" | "Savings";
  openingBalance: number;
  creditLimit?: number;
  institutionName?: string;
  customInstitution?: string;
}

interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
}

interface DeleteAccountImpact {
  accountId: string;
  accountName: string;
  transactionCount: number;
  goalCount: number;
  recurringCount: number;
  budgetCount: number;
  requiresCascadeDelete: boolean;
}

const LOW_BALANCE_THRESHOLD = 1000;

function formatAccountTypeLabel(type: string): string {
  switch (type) {
    case "CreditCard":
      return "Credit Card";
    case "CashWallet":
      return "Cash Wallet";
    default:
      return type;
  }
}

function formatPeriodStartLabel(from: string): string {
  const parsed = new Date(`${from}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "Start";
  }

  return `Start ${parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

function getPeriodStartBalance(account: Account): number {
  const balanceAtPeriodStart = Number(account.balanceAtPeriodStart);
  if (Number.isFinite(balanceAtPeriodStart)) {
    return balanceAtPeriodStart;
  }

  return Number.isFinite(account.openingBalance) ? account.openingBalance : 0;
}

function isLowBalanceAccount(account: Account): boolean {
  return account.type !== "CreditCard" && account.currentBalance < LOW_BALANCE_THRESHOLD;
}

function getCreditUsagePercent(account: Account): number {
  if (account.type !== "CreditCard" || !account.creditLimit || account.creditLimit <= 0) {
    return 0;
  }

  const availableCredit = account.availableCredit ?? (account.creditLimit + account.currentBalance);
  const usedAmount = Math.max(0, account.creditLimit - availableCredit);
  return (usedAmount / account.creditLimit) * 100;
}

function getAccountAmountTone(account: Account): string {
  if (account.type === "CreditCard") {
    const usagePercent = getCreditUsagePercent(account);
    if (usagePercent >= 80) {
      return "credit-danger";
    }

    if (usagePercent >= 30) {
      return "credit-warn";
    }

    return "credit-good";
  }

  return isLowBalanceAccount(account) ? "low-balance" : "";
}

export function AccountsPage() {
  const currency = useCurrency();
  const queryClient = useQueryClient();
  const { notify, topbarSearch, dateFrom } = useUiStore();
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<DeleteAccountImpact | null>(null);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false);
  const accountDefaults: Input = {
    name: "",
    type: "Bank",
    openingBalance: 0,
    creditLimit: undefined,
    institutionName: "",
    customInstitution: ""
  };
  const transferDefaults: TransferInput = {
    fromAccountId: "",
    toAccountId: "",
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    note: ""
  };
  const { register, handleSubmit, reset, setValue, watch } = useForm<Input>({
    defaultValues: accountDefaults
  });
  const transferForm = useForm<TransferInput>({
    defaultValues: transferDefaults
  });

  const accountsQuery = useQuery({
    queryKey: ["accounts", dateFrom],
    queryFn: async () => (await apiClient.get<Account[]>("/accounts", { params: { from: dateFrom } })).data,
    initialData: []
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Input) => {
      const institution = resolveInstitutionName(payload.institutionName ?? "", payload.customInstitution ?? "");
      const creditLimit = Number.isFinite(payload.creditLimit) ? payload.creditLimit : undefined;
      const requestPayload = {
        name: payload.name,
        type: payload.type,
        openingBalance: payload.openingBalance,
        creditLimit: payload.type === "CreditCard" ? creditLimit : undefined,
        institutionName: institution || undefined
      };

      if (editId) {
        return apiClient.put(`/accounts/${editId}`, requestPayload);
      }
      return apiClient.post("/accounts", requestPayload);
    },
    onSuccess: () => {
      notify(editId ? "Account updated" : "Account created");
      reset(accountDefaults);
      setEditId(null);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Account save failed.";
      notify(message, "error");
    }
  });

  const transferMutation = useMutation({
    mutationFn: async (payload: TransferInput) => apiClient.post("/accounts/transfer", payload),
    onSuccess: () => {
      notify("Transfer completed");
      transferForm.reset(transferDefaults);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Transfer failed.";
      notify(message, "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (payload: { id: string; deleteRelatedData: boolean }) =>
      apiClient.delete(`/accounts/${payload.id}`, {
        data: {
          deleteRelatedData: payload.deleteRelatedData
        }
      }),
    onSuccess: () => {
      notify("Account deleted");
      if (editId) {
        setEditId(null);
        reset(accountDefaults);
      }
      setDeleteTarget(null);
      setDeleteImpact(null);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Account delete failed.";
      notify(message, "error");
    }
  });

  const normalizedSearch = topbarSearch.trim().toLowerCase();
  const filteredAccounts = useMemo(() => {
    if (!normalizedSearch) {
      return accountsQuery.data;
    }

    return accountsQuery.data.filter((account) => {
      const institution = account.institutionName ?? "";
      return [
        account.name,
        formatAccountTypeLabel(account.type),
        institution,
        String(account.currentBalance),
        String(account.creditLimit ?? ""),
        String(account.availableCredit ?? "")
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [accountsQuery.data, normalizedSearch]);

  const selectedType = watch("type");

  const openDeleteModal = async (account: Account) => {
    setDeleteTarget(account);
    setDeleteImpact(null);
    setDeleteImpactLoading(true);

    try {
      const impact = (await apiClient.get<DeleteAccountImpact>(`/accounts/${account.id}/delete-impact`)).data;
      setDeleteImpact(impact);
    } catch (error) {
      setDeleteTarget(null);
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Unable to inspect account delete impact.";
      notify(message, "error");
    } finally {
      setDeleteImpactLoading(false);
    }
  };

  const closeDeleteModal = () => {
    if (deleteMutation.isPending) {
      return;
    }

    setDeleteTarget(null);
    setDeleteImpact(null);
    setDeleteImpactLoading(false);
  };

  const impactItems = [
    { label: "Transactions", count: deleteImpact?.transactionCount ?? 0 },
    { label: "Goals", count: deleteImpact?.goalCount ?? 0 },
    { label: "Recurring items", count: deleteImpact?.recurringCount ?? 0 },
    { label: "Budgets", count: deleteImpact?.budgetCount ?? 0 }
  ].filter((item) => item.count > 0);

  return (
    <section className="card">
      <h3>Accounts</h3>
      {filteredAccounts.length > 0 ? (
        <div className="account-tile-strip" aria-label="Account balance overview">
          {filteredAccounts.map((account) => {
            const institution = (account.institutionName ?? "").trim();
            const typeLabel = formatAccountTypeLabel(account.type);
            return (
              <article key={account.id} className="account-balance-tile">
                <div className="account-balance-tile-head">
                  <div className="account-balance-tile-copy">
                    <strong>{account.name}</strong>
                    <span>{institution ? `${institution} / ${typeLabel}` : typeLabel}</span>
                  </div>
                  {account.isShared ? (
                    <span className="account-shared-badge">
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="account-shared-badge-icon">
                        <path
                          d="M15 18v-1a3 3 0 0 1 3-3h1a3 3 0 0 1 3 3v1M17.5 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2 18v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Shared
                    </span>
                  ) : null}
                </div>
                <div className={`account-balance-tile-amount ${getAccountAmountTone(account)}`}>
                  {currency(account.currentBalance)}
                </div>
                {account.type === "CreditCard" ? (
                  <div className="account-balance-tile-meta">
                    <span>Limit {currency(account.creditLimit ?? 0)}</span>
                    <span>Available {currency(account.availableCredit ?? 0)}</span>
                  </div>
                ) : (
                  <div className="account-balance-tile-meta">
                    <span>{formatPeriodStartLabel(dateFrom)} {currency(getPeriodStartBalance(account))}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
      <form onSubmit={handleSubmit((d) => createMutation.mutate(d), () => notify("Please enter valid account values.", "error"))}>
        <div className="form-grid">
          <TextInput label="Account Name" placeholder="Account Name" {...register("name")} />
          <Dropdown
            label="Account Type"
            options={[
              { value: "Bank", label: "Bank" },
              { value: "CreditCard", label: "Credit Card" },
              { value: "CashWallet", label: "Cash Wallet" },
              { value: "Savings", label: "Savings" }
            ]}
            value={watch("type")}
            onChange={(e) => setValue("type", e.target.value as Input["type"])}
          />
          <TextInput
            label="Opening Balance"
            type="number"
            step="0.01"
            min="0"
            placeholder="Opening Balance"
            {...register("openingBalance", requiredLooseNumber("Enter a valid opening balance."))}
          />
          {selectedType === "CreditCard" ? (
            <TextInput
              label="Credit Limit"
              type="number"
              step="0.01"
              placeholder="Credit Limit"
              {...register("creditLimit", optionalLooseNumber("Enter a valid credit limit."))}
            />
          ) : null}
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
            <TextInput label="Custom Institution" placeholder="Enter custom institution" {...register("customInstitution")} />
          ) : null}
        </div>
        <div className="form-actions">
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
      <form onSubmit={transferForm.handleSubmit((d) => transferMutation.mutate(d), () => notify("Please enter a valid transfer amount.", "error"))}>
        <div className="form-grid">
          <Dropdown
            label="From Account"
            options={[{ value: "", label: "Select source account" }, ...accountsQuery.data.map((a) => ({ value: a.id, label: a.name }))]}
            value={transferForm.watch("fromAccountId")}
            onChange={(e) => transferForm.setValue("fromAccountId", e.target.value)}
          />
          <Dropdown
            label="To Account"
            options={[
              { value: "", label: "Select destination account" },
              ...accountsQuery.data
                .filter((a) => a.id !== transferForm.watch("fromAccountId"))
                .map((a) => ({ value: a.id, label: a.name }))
            ]}
            value={transferForm.watch("toAccountId")}
            onChange={(e) => transferForm.setValue("toAccountId", e.target.value)}
          />
          <TextInput
            label="Amount"
            type="number"
            placeholder="Amount"
            {...transferForm.register("amount", requiredLooseNumber("Enter a valid transfer amount."))}
          />
          <TextInput label="Date" type="date" {...transferForm.register("date")} />
        </div>
        <button className="btn" type="submit">Transfer</button>
      </form>
      <div style={{ marginTop: 16 }}>
        {accountsQuery.isError ? (
          <p className="error">Failed to load accounts.</p>
        ) : accountsQuery.data.length === 0 ? (
          <p className="muted">No accounts yet. Create your first account.</p>
        ) : filteredAccounts.length === 0 ? (
          <p className="muted">No accounts match your search.</p>
        ) : (
          <DataTable
            rows={filteredAccounts}
            columns={[
              { key: "name", title: "Name", render: (r) => r.name },
              {
                key: "institutionType",
                title: "Institution/Type",
                render: (r) => {
                  const institution = (r.institutionName ?? "").trim();
                  const typeLabel = formatAccountTypeLabel(r.type);
                  return institution ? `${institution}/${typeLabel}` : typeLabel;
                }
              },
              {
                key: "bal",
                title: "Current Balance",
                render: (r) => currency(r.currentBalance)
              },
              {
                key: "creditLimit",
                title: "Credit Limit",
                render: (r) => r.type === "CreditCard" ? currency(r.creditLimit ?? 0) : "—"
              },
              {
                key: "availableCredit",
                title: "Available Credit",
                render: (r) => r.type === "CreditCard" ? currency(r.availableCredit ?? 0) : "—"
              },
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
                        setValue("openingBalance", r.openingBalance);
                        setValue("creditLimit", r.creditLimit ?? undefined);
                        const institution = splitInstitutionName(r.institutionName);
                        setValue("institutionName", institution.selectedInstitution);
                        setValue("customInstitution", institution.customInstitution);
                      }}
                    />
                    <ActionIconButton
                      icon="delete"
                      label="Delete account"
                      onClick={() => void openDeleteModal(r)}
                    />
                  </div>
                )
              }
            ]}
          />
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <SharedAccountPanel accounts={accountsQuery.data.map((account) => ({ id: account.id, name: account.name }))} />
      </div>

      {deleteTarget ? (
        <div className="goal-modal-backdrop" role="dialog" aria-modal="true" onClick={closeDeleteModal}>
          <div className="goal-modal-card delete-account-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Delete account</h3>
            {deleteImpactLoading ? (
              <p className="muted">Checking account dependencies...</p>
            ) : deleteImpact?.requiresCascadeDelete ? (
              <>
                <p className="muted">
                  Deleting <strong>{deleteTarget.name}</strong> will also remove the linked records below. This action cannot be undone.
                </p>
                <div className="delete-account-impact-list">
                  {impactItems.map((item) => (
                    <div key={item.label} className="delete-account-impact-item">
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
                <p className="muted delete-account-note">
                  Related transactions will be deleted, linked goals and recurring items will be removed, and affected account balances will be recalculated automatically.
                </p>
              </>
            ) : (
              <p className="muted">
                Delete <strong>{deleteTarget.name}</strong>? This account has no linked transactions, goals, recurring items, or budgets.
              </p>
            )}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={closeDeleteModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={deleteImpactLoading || deleteMutation.isPending}
                onClick={() =>
                  deleteMutation.mutate({
                    id: deleteTarget.id,
                    deleteRelatedData: deleteImpact?.requiresCascadeDelete ?? false
                  })}
              >
                {deleteMutation.isPending
                  ? "Deleting..."
                  : deleteImpact?.requiresCascadeDelete
                    ? "Delete anyway"
                    : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
