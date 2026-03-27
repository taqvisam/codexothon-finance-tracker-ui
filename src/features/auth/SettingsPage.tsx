import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TextInput } from "../../components/TextInput";
import { apiClient } from "../../services/apiClient";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { applyTheme, getStoredTheme } from "../../utils/theme";

interface PreferenceState {
  emailNotifications: boolean;
  pushNotifications: boolean;
  monthlySummary: boolean;
  budgetAlerts: boolean;
  darkMode: boolean;
}

const storageKey = "pft-settings-preferences-v1";
const maxImageSizeBytes = 2 * 1024 * 1024;

interface UserProfile {
  email: string;
  displayName: string;
  phoneNumber?: string | null;
  profileImageUrl?: string | null;
}

function ToggleSwitch({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`settings-switch ${checked ? "on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { displayName, email, logout, updateProfile } = useAuthStore();
  const { notify } = useUiStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fullName, setFullName] = useState(displayName ?? "");
  const [emailAddress, setEmailAddress] = useState(email ?? "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteData, setDeleteData] = useState(false);
  const [prefs, setPrefs] = useState<PreferenceState>({
    emailNotifications: true,
    pushNotifications: true,
    monthlySummary: true,
    budgetAlerts: false,
    darkMode: getStoredTheme() === "dark"
  });

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<PreferenceState>;
      setPrefs((prev) => ({ ...prev, ...parsed }));
      if (typeof parsed.darkMode === "boolean") {
        applyTheme(parsed.darkMode ? "dark" : "light");
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    applyTheme(prefs.darkMode ? "dark" : "light");
    localStorage.setItem(storageKey, JSON.stringify(prefs));
  }, [prefs]);

  const profileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => (await apiClient.get<UserProfile>("/profile")).data
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setFullName(profileQuery.data.displayName ?? "");
    setEmailAddress(profileQuery.data.email ?? "");
    setPhoneNumber(profileQuery.data.phoneNumber ?? "");
    setProfileImageUrl(profileQuery.data.profileImageUrl ?? null);
  }, [profileQuery.data]);

  const saveProfileMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.put<UserProfile>("/profile", {
          displayName: fullName.trim(),
          email: emailAddress.trim(),
          phoneNumber: phoneNumber.trim() || null,
          profileImageUrl: profileImageUrl ?? null
        })
      ).data,
    onSuccess: (profile) => {
      updateProfile({
        displayName: profile.displayName,
        email: profile.email,
        profileImageUrl: profile.profileImageUrl
      });
      notify("Settings saved");
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Failed to save profile settings.";
      notify(message, "error");
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post("/auth/change-password", {
          currentPassword,
          newPassword,
          confirmPassword
        })
      ).data as { message: string },
    onSuccess: async (result) => {
      notify(result.message ?? "Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      try
      {
        await apiClient.post("/auth/logout");
      }
      catch
      {
      }
      logout();
      navigate("/login");
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Failed to change password.";
      notify(message, "error");
    }
  });

  const hasProfileImage = Boolean(profileImageUrl?.trim());
  const avatarInitial = (fullName.trim().charAt(0) || "U").toUpperCase();

  const setPref = <K extends keyof PreferenceState>(key: K, value: PreferenceState[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    saveProfileMutation.mutate();
  };

  const onPickImage = () => {
    fileInputRef.current?.click();
  };

  const removeProfileImage = () => {
    setProfileImageUrl(null);
    notify("Profile image removed. Click Save Changes to persist.");
  };

  const onImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      notify("Please select an image file.", "warning");
      return;
    }

    if (file.size > maxImageSizeBytes) {
      notify("Profile image must be smaller than 2MB.", "warning");
      return;
    }

    const toDataUrl = () =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to read image file."));
        reader.readAsDataURL(file);
      });

    try {
      const dataUrl = await toDataUrl();
      setProfileImageUrl(dataUrl);
      notify("Profile image selected. Click Save Changes to persist.");
    } catch {
      notify("Unable to read selected image.", "error");
    } finally {
      event.target.value = "";
    }
  };

  const deleteAccountMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.delete<{ message: string }>("/profile", {
          data: { deleteData }
        })
      ).data,
    onSuccess: async (result) => {
      try {
        await apiClient.post("/auth/logout");
      } catch {
      }

      logout();
      notify(result.message, deleteData ? "warning" : "success");
      setShowDeleteModal(false);
      setDeleteData(false);
      navigate("/login");
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Failed to delete account.";
      notify(message, "error");
    }
  });

  const changePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      notify("Please fill current, new, and confirm password.", "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      notify("Confirm password must match new password.", "warning");
      return;
    }
    changePasswordMutation.mutate();
  };

  return (
    <section className="settings-shell">
      <div className="settings-grid">
        <article className="card settings-card">
          <h3>Profile Settings</h3>
          <div className="settings-divider" />
          <div className="settings-avatar-wrap">
            <div className="settings-avatar">
              {hasProfileImage ? (
                <img src={profileImageUrl ?? ""} alt={fullName || "Profile"} className="settings-avatar-img" />
              ) : (
                <span className="settings-avatar-fallback">{avatarInitial}</span>
              )}
            </div>
            <div className="settings-avatar-actions">
              <button type="button" className="btn settings-change-btn" onClick={onPickImage}>Change</button>
              {hasProfileImage ? (
                <button type="button" className="btn ghost settings-remove-btn" onClick={removeProfileImage}>
                  Remove
                </button>
              ) : null}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onImageSelected} />
          </div>
          <div className="settings-form">
            <TextInput label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <TextInput label="Email Address" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} />
            <TextInput label="Phone Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
          <button type="button" className="btn settings-save-btn" onClick={saveSettings} disabled={saveProfileMutation.isPending}>
            {saveProfileMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </article>

        <aside className="settings-side-stack">
          <article className="card settings-card">
            <h3>Notification Settings</h3>
            <p className="muted">Coming soon...</p>
          </article>

          <article className="card settings-card">
            <h3>Security</h3>
            <div className="settings-form">
              <TextInput
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <TextInput
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <TextInput
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="btn"
                onClick={changePassword}
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending ? "Updating..." : "Change Password"}
              </button>
              <p className="muted">Password must be at least 8 chars with upper, lower, and number.</p>
            </div>
          </article>

          <article className="card settings-toggle-card">
            <div className="settings-switch-row">
              <span>Dark Mode</span>
              <ToggleSwitch checked={prefs.darkMode} onChange={(v) => setPref("darkMode", v)} label="Dark Mode" />
            </div>
          </article>

          <article className="card settings-danger-card">
            <h3>Delete Account</h3>
            <p className="settings-danger-title">Permanently delete your account</p>
            <p className="muted">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button type="button" className="btn settings-danger-btn" onClick={() => setShowDeleteModal(true)}>
              Delete Account
            </button>
          </article>
        </aside>
      </div>

      {showDeleteModal ? (
        <div className="goal-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setShowDeleteModal(false)}>
          <div className="goal-modal-card delete-account-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Delete account</h3>
            <p className="muted">
              If you continue without deleting data, we will keep your accounts, transactions, budgets, and goals in case you come back later.
            </p>
            <label className="delete-account-checkbox">
              <input
                type="checkbox"
                checked={deleteData}
                onChange={(event) => setDeleteData(event.target.checked)}
              />
              <span>Delete my data permanently</span>
            </label>
            <p className="muted delete-account-note">
              {deleteData
                ? "This will permanently remove your user profile, accounts, transactions, budgets, goals, recurring items, and related records."
                : "Your profile will be removed from the app for now, but your data will be restored if you sign in again later."}
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteData(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => deleteAccountMutation.mutate()}
                disabled={deleteAccountMutation.isPending}
              >
                {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
