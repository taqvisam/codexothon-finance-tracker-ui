import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ProgressBar } from "../../components/ProgressBar";
import { apiClient } from "../../services/apiClient";
import type { GoalItem } from "../../types";
import { useCurrency } from "../../hooks/useCurrency";
import { useUiStore } from "../../store/uiStore";
import { ActionIconButton } from "../../components/ActionIconButton";
import { Dropdown } from "../../components/Dropdown";
import { TextInput } from "../../components/TextInput";

interface GoalInput {
  name: string;
  targetAmount: number;
  targetDate?: string;
  linkedAccountId?: string;
  icon?: string;
  color?: string;
}

interface AccountItem {
  id: string;
  name: string;
}

type GoalActionType = "contribute" | "withdraw";

interface GoalActionState {
  goal: GoalItem;
  action: GoalActionType;
}

const goalIconOptions = [
  { value: "target", label: "Target" },
  { value: "home", label: "Home" },
  { value: "car", label: "Car" },
  { value: "plane", label: "Travel" },
  { value: "shield", label: "Emergency" },
  { value: "book", label: "Education" },
  { value: "gift", label: "Gift" },
  { value: "heart", label: "Health" }
];

const goalColorOptions = [
  { value: "#2f6fbe", label: "Ocean Blue" },
  { value: "#2ea05f", label: "Emerald Green" },
  { value: "#dd5757", label: "Coral Red" },
  { value: "#ee9a2f", label: "Amber Gold" },
  { value: "#7b61c9", label: "Royal Violet" },
  { value: "#0f9aa8", label: "Teal" }
];

const goalIconGlyphs: Record<string, string> = {
  target: "◎",
  home: "⌂",
  car: "◈",
  plane: "✈",
  shield: "🛡",
  book: "✦",
  gift: "✿",
  heart: "♥"
};

function getGoalIconGlyph(icon?: string | null) {
  return goalIconGlyphs[icon ?? ""] ?? goalIconGlyphs.target;
}

function getGoalColor(color?: string | null) {
  return goalColorOptions.find((option) => option.value === color)?.value ?? "#2f6fbe";
}

function uniqueSorted(values: number[]) {
  return Array.from(new Set(values))
    .filter((x) => Number.isFinite(x) && x > 0)
    .map((x) => Math.round(x))
    .sort((a, b) => a - b);
}

function getMaxAllowed(goal: GoalItem, action: GoalActionType) {
  if (action === "contribute") {
    return Math.max(0, Math.round(goal.targetAmount - goal.currentAmount));
  }
  return Math.max(0, Math.round(goal.currentAmount));
}

function buildQuickAmounts(goal: GoalItem, action: GoalActionType) {
  const maxAllowed = getMaxAllowed(goal, action);
  if (maxAllowed <= 0) return [];

  const target = Math.max(1, goal.targetAmount);
  const smallPercents = target <= 1000 ? [0.05, 0.1] : [0.005, 0.01];
  const largerPercents = [0.15, 0.2, 0.25, 0.5];
  const base = [...smallPercents, ...largerPercents].map((p) => target * p);
  const values = uniqueSorted(base).filter((x) => x <= maxAllowed);

  if (values.length === 0) {
    return [maxAllowed];
  }

  if (!values.includes(maxAllowed)) {
    values.push(maxAllowed);
  }

  return uniqueSorted(values).slice(0, 8);
}

export function GoalsPage() {
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const { notify } = useUiStore();
  const [editId, setEditId] = useState<string | null>(null);
  const goalDefaults: GoalInput = {
    name: "",
    targetAmount: 0,
    targetDate: "",
    linkedAccountId: "",
    icon: goalIconOptions[0].value,
    color: goalColorOptions[0].value
  };
  const { register, handleSubmit, reset, setValue, watch } = useForm<GoalInput>({
    defaultValues: goalDefaults
  });
  const [actionState, setActionState] = useState<GoalActionState | null>(null);
  const [actionAmount, setActionAmount] = useState("");

  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: async () => (await apiClient.get<GoalItem[]>("/goals")).data,
    initialData: []
  });

  const accountsQuery = useQuery({
    queryKey: ["goal-accounts"],
    queryFn: async () => (await apiClient.get<AccountItem[]>("/accounts")).data,
    initialData: []
  });

  const createMutation = useMutation({
    mutationFn: async (payload: GoalInput) => {
      const body = {
        name: payload.name,
        targetAmount: payload.targetAmount,
        targetDate: payload.targetDate || null,
        linkedAccountId: payload.linkedAccountId || null,
        icon: payload.icon || null,
        color: payload.color || null
      };
      if (editId) {
        return apiClient.put(`/goals/${editId}`, body);
      }
      return apiClient.post("/goals", body);
    },
    onSuccess: () => {
      notify(editId ? "Goal updated" : "Goal created");
      reset(goalDefaults);
      setEditId(null);
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    }
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, amount, action }: { id: string; amount: number; action: "contribute" | "withdraw" }) =>
      apiClient.post(`/goals/${id}/${action}`, { amount }),
    onSuccess: (_, vars) => {
      notify(vars.action === "contribute" ? "Goal contribution saved" : "Goal withdrawal saved");
      setActionState(null);
      setActionAmount("");
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Goal action failed.";
      notify(message, "error");
    }
  });

  const holdMutation = useMutation({
    mutationFn: async ({ id, onHold }: { id: string; onHold: boolean }) =>
      apiClient.post(`/goals/${id}/hold`, { onHold }),
    onSuccess: (_, vars) => {
      notify(vars.onHold ? "Goal put on hold" : "Goal resumed");
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Unable to update hold status.";
      notify(message, "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/goals/${id}`),
    onSuccess: (_, id) => {
      notify("Goal deleted");
      if (editId === id) {
        setEditId(null);
        reset(goalDefaults);
      }
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Unable to delete goal.";
      notify(message, "error");
    }
  });

  const quickAmounts = useMemo(() => {
    if (!actionState) return [];
    return buildQuickAmounts(actionState.goal, actionState.action);
  }, [actionState]);

  const openActionModal = (goal: GoalItem, action: GoalActionType) => {
    if (action === "contribute" && goal.currentAmount >= goal.targetAmount) {
      notify("Goal already achieved", "warning");
      return;
    }

    const nextState = { goal, action };
    const suggestions = buildQuickAmounts(goal, action);
    const fallbackAmount = getMaxAllowed(goal, action);
    setActionState(nextState);
    setActionAmount(String(suggestions[0] ?? fallbackAmount));
  };

  const submitGoalAction = () => {
    if (!actionState) return;
    const amount = Number(actionAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Enter a valid amount", "warning");
      return;
    }

    const maxAllowed = getMaxAllowed(actionState.goal, actionState.action);
    if (amount > maxAllowed) {
      if (actionState.action === "contribute") {
        notify(`Amount exceeds remaining goal amount (${currency(maxAllowed)})`, "warning");
      } else {
        notify(`Amount exceeds current saved amount (${currency(maxAllowed)})`, "warning");
      }
      return;
    }

    actionMutation.mutate({
      id: actionState.goal.id,
      amount,
      action: actionState.action
    });
  };

  return (
    <section className="card">
      <h3>Savings Goals</h3>
      <form onSubmit={handleSubmit((d) => createMutation.mutate(d))}>
        <div className="form-grid">
          <TextInput label="Goal Name" placeholder="Goal Name" {...register("name")} />
          <TextInput label="Target Amount" type="number" placeholder="Target Amount" {...register("targetAmount", { valueAsNumber: true })} />
          <TextInput label="Target Date" type="date" {...register("targetDate")} />
          <Dropdown
            label="Linked Account"
            options={[{ value: "", label: "None" }, ...accountsQuery.data.map((a) => ({ value: a.id, label: a.name }))]}
            value={watch("linkedAccountId") ?? ""}
            onChange={(e) => setValue("linkedAccountId", e.target.value)}
          />
          <Dropdown
            label="Goal Icon"
            options={goalIconOptions.map((option) => ({
              value: option.value,
              label: `${getGoalIconGlyph(option.value)} ${option.label}`
            }))}
            value={watch("icon") ?? goalDefaults.icon ?? ""}
            onChange={(e) => setValue("icon", e.target.value)}
          />
          <Dropdown
            label="Accent Color"
            options={goalColorOptions}
            value={watch("color") ?? goalDefaults.color ?? ""}
            onChange={(e) => setValue("color", e.target.value)}
          />
        </div>
        <div className="goal-form-preview">
          <span className="goal-preview-chip" style={{ borderColor: getGoalColor(watch("color")), color: getGoalColor(watch("color")) }}>
            <span className="goal-preview-icon" style={{ background: `${getGoalColor(watch("color"))}18`, color: getGoalColor(watch("color")) }}>
              {getGoalIconGlyph(watch("icon"))}
            </span>
            Preview: {watch("name") || "Your goal"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="submit">{editId ? "Update Goal" : "Add Goal"}</button>
          {editId ? (
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setEditId(null);
                reset(goalDefaults);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      <div style={{ marginTop: 16 }}>
        {goalsQuery.isError && <p className="error">Failed to load goals.</p>}
        {!goalsQuery.isError && goalsQuery.data.length === 0 && (
          <p className="muted">No goals yet. Suggest goal setup.</p>
        )}
        {goalsQuery.data.map((goal) => {
          const isAchieved = goal.currentAmount >= goal.targetAmount || goal.progressPercent >= 100;
          const isOnHold = goal.status === "on-hold";
          const accentColor = getGoalColor(goal.color);
          const goalIcon = getGoalIconGlyph(goal.icon);
          return (
          <article
            className="card goal-card"
            key={goal.id}
            style={{
              marginBottom: 10,
              borderColor: isAchieved ? "#6fcf97" : accentColor
            }}
          >
            <div className="goal-tile-head">
              <div className="goal-title-wrap">
                <span className="goal-icon-badge" style={{ background: `${accentColor}16`, color: accentColor, borderColor: `${accentColor}45` }}>
                  {goalIcon}
                </span>
                <strong>{goal.name}</strong>
              </div>
              <div className="goal-tile-actions">
                <ActionIconButton
                  icon="edit"
                  label="Edit goal"
                  onClick={() => {
                    setEditId(goal.id);
                    setValue("name", goal.name);
                    setValue("targetAmount", goal.targetAmount);
                    setValue("targetDate", goal.targetDate ? goal.targetDate.slice(0, 10) : "");
                    setValue("linkedAccountId", goal.linkedAccountId ?? "");
                    setValue("icon", goal.icon ?? "");
                    setValue("color", goal.color ?? "");
                  }}
                />
                {!isAchieved ? (
                  <button
                    type="button"
                    className="goal-icon-btn"
                    title={isOnHold ? "Resume goal" : "Put goal on hold"}
                    aria-label={isOnHold ? "Resume goal" : "Put goal on hold"}
                    onClick={() => holdMutation.mutate({ id: goal.id, onHold: !isOnHold })}
                  >
                    {isOnHold ? "▶" : "⏸"}
                  </button>
                ) : null}
                <ActionIconButton
                  icon="delete"
                  label="Delete goal"
                  onClick={() => {
                    const ok = window.confirm(`Delete goal "${goal.name}"?`);
                    if (ok) {
                      deleteMutation.mutate(goal.id);
                    }
                  }}
                />
              </div>
            </div>
            <p className={isAchieved ? "goal-achieved-text" : "muted"}>{currency(goal.currentAmount)} / {currency(goal.targetAmount)}</p>
            <ProgressBar value={goal.progressPercent} barColor={isAchieved ? "#2ea05f" : accentColor} />
            {isAchieved ? <span className="goal-achieved-badge">Goal Achieved</span> : null}
            {isOnHold ? <span className="goal-hold-badge">On Hold</span> : null}
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button
                className="btn"
                type="button"
                disabled={isAchieved || isOnHold}
                onClick={() => openActionModal(goal, "contribute")}
              >
                Contribute
              </button>
              <button className="btn ghost" type="button" disabled={isOnHold} onClick={() => openActionModal(goal, "withdraw")}>Withdraw</button>
            </div>
          </article>
        )})}
      </div>
      {actionState ? (
        <div className="goal-modal-backdrop" role="dialog" aria-modal="true">
          <div className="goal-modal-card">
            <h4 style={{ marginTop: 0 }}>
              {actionState.action === "contribute" ? "Contribute to goal" : "Withdraw from goal"}
            </h4>
            <p className="muted" style={{ marginTop: 0 }}>
              {actionState.goal.name} • Max {currency(getMaxAllowed(actionState.goal, actionState.action))}
            </p>
            <input
              className="input"
              type="number"
              min={1}
              value={actionAmount}
              onChange={(e) => setActionAmount(e.target.value)}
            />
            <div className="goal-quick-amounts">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="btn ghost goal-quick-chip"
                  onClick={() => setActionAmount(String(value))}
                >
                  {currency(value)}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setActionState(null);
                  setActionAmount("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn"
                type="button"
                disabled={actionMutation.isPending}
                onClick={submitGoalAction}
              >
                {actionMutation.isPending ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
