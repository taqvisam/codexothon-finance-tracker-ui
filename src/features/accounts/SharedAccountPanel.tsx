import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dropdown } from "../../components/Dropdown";
import { Button } from "../../components/Button";
import { TextInput } from "../../components/TextInput";
import { apiClient } from "../../services/apiClient";
import { useUiStore } from "../../store/uiStore";

interface AccountOption {
  id: string;
  name: string;
}

interface AccountMember {
  userId: string;
  email: string;
  displayName: string;
  role: "Owner" | "Editor" | "Viewer";
  isOwner: boolean;
}

interface AccountActivity {
  id: string;
  actorName: string;
  entityType: string;
  action: string;
  description: string;
  createdAt: string;
}

interface Props {
  accounts: AccountOption[];
}

export function SharedAccountPanel({ accounts }: Props) {
  const queryClient = useQueryClient();
  const { notify, topbarSearch } = useUiStore();
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Editor" | "Viewer">("Editor");

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const membersQuery = useQuery({
    queryKey: ["shared-members", selectedAccountId],
    queryFn: async () => (await apiClient.get<AccountMember[]>(`/accounts/${selectedAccountId}/members`)).data,
    enabled: Boolean(selectedAccountId),
    initialData: []
  });

  const activityQuery = useQuery({
    queryKey: ["shared-activity", selectedAccountId],
    queryFn: async () => (await apiClient.get<AccountActivity[]>(`/accounts/${selectedAccountId}/activity`)).data,
    enabled: Boolean(selectedAccountId),
    initialData: []
  });

  const inviteMutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/accounts/${selectedAccountId}/invite`, {
        email: inviteEmail,
        role: inviteRole
      }),
    onSuccess: async () => {
      notify("Member invited");
      setInviteEmail("");
      setInviteRole("Editor");
      setInviteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["shared-members", selectedAccountId] });
      await queryClient.invalidateQueries({ queryKey: ["shared-activity", selectedAccountId] });
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Unable to invite member.";
      notify(message, "error");
    }
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "Editor" | "Viewer" }) =>
      apiClient.put(`/accounts/${selectedAccountId}/members/${userId}`, { role }),
    onSuccess: async () => {
      notify("Member role updated");
      await queryClient.invalidateQueries({ queryKey: ["shared-members", selectedAccountId] });
      await queryClient.invalidateQueries({ queryKey: ["shared-activity", selectedAccountId] });
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Unable to update role.";
      notify(message, "error");
    }
  });

  const normalizedSearch = topbarSearch.trim().toLowerCase();
  const filteredAccounts = useMemo(() => {
    if (!normalizedSearch) {
      return accounts;
    }

    return accounts.filter((account) => account.name.toLowerCase().includes(normalizedSearch));
  }, [accounts, normalizedSearch]);

  const filteredMembers = useMemo(() => {
    if (!normalizedSearch) {
      return membersQuery.data;
    }

    return membersQuery.data.filter((member) =>
      [member.displayName, member.email, member.role, member.isOwner ? "owner" : "collaborator"]
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [membersQuery.data, normalizedSearch]);

  const filteredActivity = useMemo(() => {
    if (!normalizedSearch) {
      return activityQuery.data;
    }

    return activityQuery.data.filter((activity) =>
      [activity.actorName, activity.entityType, activity.action, activity.description]
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [activityQuery.data, normalizedSearch]);

  return (
    <section className="card">
      <div className="card-head">
        <h3 style={{ marginBottom: 0 }}>Shared with</h3>
        <Button type="button" variant="secondary" onClick={() => setInviteOpen(true)} disabled={!selectedAccountId}>
          Invite Member
        </Button>
      </div>

      <div className="form-grid" style={{ marginTop: 8 }}>
        <Dropdown
          label="Account"
          options={[
            { value: "", label: "Select account" },
            ...filteredAccounts.map((account) => ({ value: account.id, label: account.name }))
          ]}
          value={selectedAccountId}
          onChange={(event) => setSelectedAccountId(event.target.value)}
        />
      </div>

      {!selectedAccountId ? (
        <p className="muted" style={{ marginTop: 12 }}>Create or select an account to manage sharing.</p>
      ) : (
        <>
          <div style={{ marginTop: 12 }}>
            <h4 style={{ marginBottom: 8 }}>Members</h4>
            {membersQuery.data.length === 0 ? (
              <p className="muted">No members yet.</p>
            ) : filteredMembers.length === 0 ? (
              <p className="muted">No members match your search.</p>
            ) : (
              filteredMembers.map((member) => (
                <article key={member.userId} className="budget-row">
                  <div>
                    <strong>{member.displayName}</strong>
                    <div className="muted">{member.email}</div>
                  </div>
                  <div className="muted">{member.isOwner ? "Owner" : "Collaborator"}</div>
                  <div>
                    {member.isOwner ? (
                      <span className="insight-pill">Owner</span>
                    ) : (
                      <Dropdown
                        options={[
                          { value: "Editor", label: "Editor" },
                          { value: "Viewer", label: "Viewer" }
                        ]}
                        value={member.role}
                        onChange={(event) =>
                          roleMutation.mutate({
                            userId: member.userId,
                            role: event.target.value as "Editor" | "Viewer"
                          })}
                      />
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Recent Activity</h4>
            {activityQuery.data.length === 0 ? (
              <p className="muted">No shared account activity yet.</p>
            ) : filteredActivity.length === 0 ? (
              <p className="muted">No activity matches your search.</p>
            ) : (
              filteredActivity.map((activity) => (
                <div key={activity.id} className="insight-item">
                  <span className="insight-dot" aria-hidden="true">•</span>
                  <span>
                    <strong>{activity.actorName}</strong> {activity.description}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {inviteOpen ? (
        <div className="goal-modal-backdrop" role="dialog" aria-modal="true">
          <div className="goal-modal-card">
            <h4 style={{ marginTop: 0 }}>Invite member</h4>
            <div className="form-grid">
              <TextInput
                label="Email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="member@example.com"
              />
              <Dropdown
                label="Role"
                options={[
                  { value: "Editor", label: "Editor" },
                  { value: "Viewer", label: "Viewer" }
                ]}
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as "Editor" | "Viewer")}
              />
            </div>
            <div className="form-actions" style={{ justifyContent: "flex-end", marginTop: 12 }}>
              <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Inviting..." : "Send Invite"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
