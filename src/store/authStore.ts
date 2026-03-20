import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthPayload {
  accessToken: string;
  refreshToken?: string | null;
  email: string;
  displayName: string;
  profileImageUrl?: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  setAuth: (payload: AuthPayload) => void;
  updateProfile: (profile: { displayName: string; email: string; profileImageUrl?: string | null }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      email: null,
      displayName: null,
      profileImageUrl: null,
      setAuth: (payload) =>
        set({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken ?? null,
          email: payload.email,
          displayName: payload.displayName,
          profileImageUrl: payload.profileImageUrl ?? null
        }),
      updateProfile: (profile) =>
        set((state) => ({
          ...state,
          displayName: profile.displayName,
          email: profile.email,
          profileImageUrl: profile.profileImageUrl ?? state.profileImageUrl
        })),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          email: null,
          displayName: null,
          profileImageUrl: null
        })
    }),
    {
      name: "pft-auth"
    }
  )
);
