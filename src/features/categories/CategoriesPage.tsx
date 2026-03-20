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

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const { notify } = useUiStore();
  const [editId, setEditId] = useState<string | null>(null);
  const defaults: Input = { name: "", type: "Expense", color: "", icon: "", isArchived: false };
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
    onSuccess: () => {
      notify("Category deleted");
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
            onChange={(e) => setValue("type", e.target.value as Input["type"])}
          />
          <TextInput label="Color" placeholder="#2f6fbe" {...register("color")} />
          <TextInput label="Icon" placeholder="wallet" {...register("icon")} />
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
        {categoriesQuery.data.map((category) => (
          <article key={category.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <strong>{category.name}</strong>
                <div className="muted">{category.type} {category.isArchived ? "• Archived" : ""}</div>
              </div>
              <div className="action-icon-row">
                <ActionIconButton
                  icon="edit"
                  label="Edit category"
                  onClick={() => {
                    setEditId(category.id);
                    setValue("name", category.name);
                    setValue("type", category.type);
                    setValue("color", category.color ?? "");
                    setValue("icon", category.icon ?? "");
                    setValue("isArchived", category.isArchived);
                  }}
                />
                <ActionIconButton
                  icon="edit"
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
        ))}
      </div>
    </section>
  );
}
