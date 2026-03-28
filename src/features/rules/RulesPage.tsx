import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Dropdown } from "../../components/Dropdown";
import { TextInput } from "../../components/TextInput";
import { Button } from "../../components/Button";
import { apiClient } from "../../services/apiClient";
import { useUiStore } from "../../store/uiStore";
import { ActionIconButton } from "../../components/ActionIconButton";
import { parseLooseNumber } from "../../utils/numberInput";

type RuleField = "Merchant" | "Amount" | "Category" | "Note" | "PaymentMethod" | "Type";
type RuleOperator = "Equals" | "Contains" | "GreaterThan" | "LessThan" | "StartsWith" | "EndsWith";
type RuleActionType = "SetCategory" | "AddTag" | "TriggerAlert";

interface RuleItem {
  id: string;
  name: string;
  condition: { field: RuleField; operator: RuleOperator; value: string };
  action: { type: RuleActionType; value: string };
  priority: number;
  isActive: boolean;
}

function normalizeRule(rule: Partial<RuleItem> & Record<string, unknown>): RuleItem {
  const fallbackConditionField = (rule.matchField ?? rule.field ?? "Merchant") as RuleField;
  const fallbackConditionOperator = (rule.matchOperator ?? rule.operator ?? "Contains") as RuleOperator;
  const fallbackConditionValue = String(rule.matchValue ?? rule.conditionValue ?? rule.value ?? "");
  const fallbackActionType = (rule.actionType ?? rule.type ?? "SetCategory") as RuleActionType;
  const fallbackActionValue = String(rule.actionValue ?? rule.tagValue ?? rule.alertMessage ?? rule.valueText ?? "");

  return {
    id: String(rule.id ?? ""),
    name: String(rule.name ?? "Untitled Rule"),
    condition: {
      field: rule.condition?.field ?? fallbackConditionField,
      operator: rule.condition?.operator ?? fallbackConditionOperator,
      value: rule.condition?.value ?? fallbackConditionValue
    },
    action: {
      type: rule.action?.type ?? fallbackActionType,
      value: rule.action?.value ?? fallbackActionValue
    },
    priority: Number(rule.priority ?? 0),
    isActive: Boolean(rule.isActive ?? rule.isEnabled ?? true)
  };
}

const defaultRule = {
  name: "",
  conditionField: "Merchant" as RuleField,
  conditionOperator: "Contains" as RuleOperator,
  conditionValue: "",
  actionType: "SetCategory" as RuleActionType,
  actionValue: "",
  priority: "0",
  isActive: true
};

export function RulesPage() {
  const queryClient = useQueryClient();
  const { notify, topbarSearch } = useUiStore();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultRule);

  const rulesQuery = useQuery({
    queryKey: ["rules"],
    queryFn: async () => (await apiClient.get<RuleItem[]>("/rules")).data,
    initialData: []
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const priority = parseLooseNumber(form.priority);
      if (!Number.isFinite(priority)) {
        throw new Error("Enter a valid priority.");
      }

      const payload = {
        name: form.name,
        condition: {
          field: form.conditionField,
          operator: form.conditionOperator,
          value: form.conditionValue
        },
        action: {
          type: form.actionType,
          value: form.actionValue
        },
        priority,
        isActive: form.isActive
      };

      if (editId) {
        return apiClient.put(`/rules/${editId}`, payload);
      }

      return apiClient.post("/rules", payload);
    },
    onSuccess: async () => {
      notify(editId ? "Rule updated" : "Rule created");
      setEditId(null);
      setForm(defaultRule);
      await queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: (error) => {
      const localMessage = error instanceof Error ? error.message : undefined;
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? localMessage ?? "Unable to save rule.";
      notify(message, "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/rules/${id}`),
    onSuccess: async () => {
      notify("Rule deleted");
      await queryClient.invalidateQueries({ queryKey: ["rules"] });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async (rule: RuleItem) =>
      apiClient.put(`/rules/${rule.id}`, {
        ...rule,
        isActive: !rule.isActive
      }),
    onSuccess: async () => {
      notify("Rule updated");
      await queryClient.invalidateQueries({ queryKey: ["rules"] });
    }
  });

  const normalizedSearch = topbarSearch.trim().toLowerCase();
  const ruleRows = useMemo(
    () => (Array.isArray(rulesQuery.data) ? rulesQuery.data : []).map((rule) => normalizeRule(rule as Partial<RuleItem> & Record<string, unknown>)),
    [rulesQuery.data]
  );

  const filteredRules = useMemo(() => {
    if (!normalizedSearch) {
      return ruleRows;
    }

    return ruleRows.filter((rule) =>
      [
        rule.name,
        rule.condition.field,
        rule.condition.operator,
        rule.condition.value,
        rule.action.type,
        rule.action.value,
        String(rule.priority),
        rule.isActive ? "enabled" : "disabled"
      ].some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [normalizedSearch, ruleRows]);

  return (
    <>
      <section className="card">
        <h3>{editId ? "Edit Rule" : "Rules Builder"}</h3>
        <div className="form-grid">
          <TextInput
            label="Rule Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Auto-tag food bills"
          />
          <Dropdown
            label="Condition Field"
            options={["Merchant", "Amount", "Category", "Note", "PaymentMethod", "Type"].map((value) => ({ value, label: value }))}
            value={form.conditionField}
            onChange={(event) => setForm((prev) => ({ ...prev, conditionField: event.target.value as RuleField }))}
          />
          <Dropdown
            label="Operator"
            options={["Equals", "Contains", "GreaterThan", "LessThan", "StartsWith", "EndsWith"].map((value) => ({ value, label: value }))}
            value={form.conditionOperator}
            onChange={(event) => setForm((prev) => ({ ...prev, conditionOperator: event.target.value as RuleOperator }))}
          />
          <TextInput
            label="Condition Value"
            value={form.conditionValue}
            onChange={(event) => setForm((prev) => ({ ...prev, conditionValue: event.target.value }))}
            placeholder="Uber or 5000"
          />
          <Dropdown
            label="Action Type"
            options={[
              { value: "SetCategory", label: "Set Category" },
              { value: "AddTag", label: "Add Tag" },
              { value: "TriggerAlert", label: "Trigger Alert" }
            ]}
            value={form.actionType}
            onChange={(event) => setForm((prev) => ({ ...prev, actionType: event.target.value as RuleActionType }))}
          />
          <TextInput
            label="Action Value"
            value={form.actionValue}
            onChange={(event) => setForm((prev) => ({ ...prev, actionValue: event.target.value }))}
            placeholder="Transport / monthly-food / High value expense"
          />
          <TextInput
            label="Priority"
            type="number"
            value={form.priority}
            onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
          />
          <Dropdown
            label="Status"
            options={[
              { value: "true", label: "Enabled" },
              { value: "false", label: "Disabled" }
            ]}
            value={String(form.isActive)}
            onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.value === "true" }))}
          />
        </div>
        <div className="form-actions">
          <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : editId ? "Update Rule" : "Create Rule"}
          </Button>
          {editId ? (
            <Button type="button" variant="secondary" onClick={() => { setEditId(null); setForm(defaultRule); }}>
              Cancel
            </Button>
          ) : null}
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="card-head">
          <h3 style={{ marginBottom: 0 }}>Rules</h3>
          <span className="muted">{filteredRules.length} total</span>
        </div>
        {ruleRows.length === 0 ? (
          <p className="muted">No rules yet. Create one to auto-categorize, tag, or alert.</p>
        ) : filteredRules.length === 0 ? (
          <p className="muted">No rules match your search.</p>
        ) : (
          filteredRules.map((rule) => (
            <article key={rule.id} className="budget-row">
              <div>
                <strong>{rule.name}</strong>
                <div className="muted">
                  If {rule.condition.field} {rule.condition.operator} "{rule.condition.value}" then {rule.action.type} "{rule.action.value}"
                </div>
              </div>
              <div className="muted">Priority {rule.priority}</div>
              <div className="action-icon-row">
                <Button type="button" variant="secondary" onClick={() => toggleMutation.mutate(rule)}>
                  {rule.isActive ? "Disable" : "Enable"}
                </Button>
                <ActionIconButton
                  icon="edit"
                  label="Edit rule"
                  onClick={() => {
                    setEditId(rule.id);
                    setForm({
                      name: rule.name,
                      conditionField: rule.condition.field,
                      conditionOperator: rule.condition.operator,
                      conditionValue: rule.condition.value,
                      actionType: rule.action.type,
                      actionValue: rule.action.value,
                      priority: String(rule.priority),
                      isActive: rule.isActive
                    });
                  }}
                />
                <ActionIconButton icon="delete" label="Delete rule" onClick={() => deleteMutation.mutate(rule.id)} />
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
