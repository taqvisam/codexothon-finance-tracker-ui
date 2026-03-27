import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActionIconButton } from "../../components/ActionIconButton";
import { Dropdown } from "../../components/Dropdown";
import { TextInput } from "../../components/TextInput";
import { apiClient } from "../../services/apiClient";
import { useUiStore } from "../../store/uiStore";

interface CategoryItem {
  id: string;
  name: string;
  type: "Income" | "Expense";
  color?: string;
  icon?: string;
  isArchived: boolean;
}

interface Input {
  name: string;
  type: "Income" | "Expense";
  color?: string;
  icon?: string;
  isArchived: boolean;
}

const categoryIconOptions = [
  { value: "wallet", label: "Wallet" },
  { value: "food", label: "Food" },
  { value: "travel", label: "Travel" },
  { value: "shopping", label: "Shopping" },
  { value: "salary", label: "Salary" },
  { value: "home", label: "Home" },
  { value: "health", label: "Health" },
  { value: "gift", label: "Gift" }
];

const categoryColorOptions = [
  { value: "#2f6fbe", label: "Ocean Blue" },
  { value: "#2ea05f", label: "Emerald Green" },
  { value: "#dd5757", label: "Coral Red" },
  { value: "#ee9a2f", label: "Amber Gold" },
  { value: "#7b61c9", label: "Royal Violet" },
  { value: "#0f9aa8", label: "Teal" }
];

const categoryIconGlyphs: Record<string, string> = {
  wallet: "◫",
  food: "◔",
  travel: "✈",
  shopping: "◈",
  salary: "▣",
  home: "⌂",
  health: "♥",
  gift: "✿"
};

function getCategoryIconGlyph(icon?: string | null) {
  return categoryIconGlyphs[icon ?? ""] ?? categoryIconGlyphs.wallet;
}

function getCategoryColor(color?: string | null, type?: "Income" | "Expense") {
  if (color && categoryColorOptions.some((option) => option.value === color)) {
    return color;
  }

  return type === "Income" ? "#2ea05f" : "#2f6fbe";
}

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const { notify } = useUiStore();
  const [editId, setEditId] = useState<string | null>(null);
  const defaults: Input = { name: "", type: "Expense", color: "#2f6fbe", icon: "wallet", isArchived: false };
  const { register, handleSubmit, reset, setValue, watch } = useForm<Input>({
    defaultValues: defaults
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await apiClient.get<CategoryItem[]>("/categories")).data,
    initialData: []
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: Input) => {
      if (editId) {
        return apiClient.put(`/categories/${editId}`, payload);
      }
      return apiClient.post("/categories", payload);
    },
    onSuccess: () => {
      notify(editId ? "Category updated" : "Category created");
      setEditId(null);
      reset(defaults);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/categories/${id}`),
    onSuccess: (_, id) => {
      notify("Category deleted");
      if (editId === id) {
        setEditId(null);
        reset(defaults);
      }
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (item: CategoryItem) =>
      apiClient.put(`/categories/${item.id}`, {
        name: item.name,
        type: item.type,
        color: item.color ?? "",
        icon: item.icon ?? "",
        isArchived: !item.isArchived
      }),
    onSuccess: () => {
      notify("Category updated");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });

  return (
    <section className="card">
      <h3>Categories</h3>
      <form onSubmit={handleSubmit((d) => upsertMutation.mutate(d))}>
        <div className="form-grid">
          <TextInput label="Name" {...register("name")} />
          <Dropdown
            label="Type"
            options={[
              { value: "Expense", label: "Expense" },
              { value: "Income", label: "Income" }
            ]}
            value={watch("type")}
            onChange={(e) => {
              const nextType = e.target.value as Input["type"];
              setValue("type", nextType);
              setValue("color", nextType === "Income" ? "#2ea05f" : "#2f6fbe");
            }}
          />
          <Dropdown
            label="Accent Color"
            options={categoryColorOptions}
            value={watch("color") ?? defaults.color ?? ""}
            onChange={(e) => setValue("color", e.target.value)}
          />
          <Dropdown
            label="Category Icon"
            options={categoryIconOptions.map((option) => ({
              value: option.value,
              label: `${getCategoryIconGlyph(option.value)} ${option.label}`
            }))}
            value={watch("icon") ?? defaults.icon ?? ""}
            onChange={(e) => setValue("icon", e.target.value)}
          />
        </div>
        <div className="category-form-preview">
          <span
            className="category-preview-chip"
            style={{
              borderColor: getCategoryColor(watch("color"), watch("type")),
              color: getCategoryColor(watch("color"), watch("type"))
            }}
          >
            <span
              className="category-preview-icon"
              style={{
                background: `${getCategoryColor(watch("color"), watch("type"))}18`,
                color: getCategoryColor(watch("color"), watch("type"))
              }}
            >
              {getCategoryIconGlyph(watch("icon"))}
            </span>
            Preview: {watch("name") || "Your category"} • {watch("type")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="submit">{editId ? "Update Category" : "Create Category"}</button>
          {editId ? (
            <button className="btn ghost" type="button" onClick={() => { setEditId(null); reset(defaults); }}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div style={{ marginTop: 16 }}>
        {categoriesQuery.isError ? <p className="error">Failed to load categories.</p> : null}
        {!categoriesQuery.isError && categoriesQuery.data.length === 0 ? <p className="muted">No categories yet.</p> : null}
        {categoriesQuery.data.map((category) => {
          const accentColor = getCategoryColor(category.color, category.type);
          const iconGlyph = getCategoryIconGlyph(category.icon);
          return (
          <article key={category.id} className="card category-card" style={{ marginBottom: 10, borderColor: accentColor }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div className="category-title-wrap">
                <span
                  className="category-icon-badge"
                  style={{ background: `${accentColor}16`, color: accentColor, borderColor: `${accentColor}45` }}
                >
                  {iconGlyph}
                </span>
                <div>
                  <strong>{category.name}</strong>
                  <div className="muted">{category.type} {category.isArchived ? "• Archived" : ""}</div>
                </div>
              </div>
              <div className="action-icon-row">
                <ActionIconButton
                  icon="edit"
                  label="Edit category"
                  onClick={() => {
                    setEditId(category.id);
                    setValue("name", category.name);
                    setValue("type", category.type);
                    setValue("color", getCategoryColor(category.color, category.type));
                    setValue("icon", category.icon ?? "wallet");
                    setValue("isArchived", category.isArchived);
                  }}
                />
                <ActionIconButton
                  icon="archive"
                  label={category.isArchived ? "Unarchive category" : "Archive category"}
                  onClick={() => archiveMutation.mutate(category)}
                />
                <ActionIconButton
                  icon="delete"
                  label="Delete category"
                  onClick={() => deleteMutation.mutate(category.id)}
                />
              </div>
            </div>
          </article>
        )})}
      </div>
    </section>
  );
}
