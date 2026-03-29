import axios from "axios";
import { useAuthStore } from "../store/authStore";

const apiUrl = (
  import.meta.env.VITE_API_URL ?? "https://finance-tracker-syed-hba2afgqh3bbafeg.centralindia-01.azurewebsites.net"
).replace(/\/+$/, "");

export const apiClient = axios.create({
  baseURL: `${apiUrl}/api`,
  headers: {
    "ngrok-skip-browser-warning": "true"
  }
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }
    const request = originalRequest as typeof originalRequest & { _retry?: boolean };

    const isUnauthorized = error.response?.status === 401;
    const isAuthEndpoint = typeof request.url === "string" && request.url.includes("/auth/");
    if (!isUnauthorized || isAuthEndpoint || request._retry) {
      return Promise.reject(error);
    }

    const state = useAuthStore.getState();
    if (!state.refreshToken) {
      state.logout();
      return Promise.reject(error);
    }

    try {
      request._retry = true;
      const refreshPayload = state.refreshToken ? { refreshToken: state.refreshToken } : {};
      const refreshResponse = await apiClient.post("/auth/refresh", refreshPayload);

      const auth = refreshResponse.data as {
        accessToken: string;
        refreshToken: string;
        email: string;
        displayName: string;
        profileImageUrl?: string | null;
        showWelcomeBackMessage?: boolean;
        showOnboardingWorkbookEmailMessage?: boolean;
      };

      state.setAuth(auth);
      request.headers.Authorization = `Bearer ${auth.accessToken}`;
      return apiClient(request);
    } catch {
      state.logout();
      return Promise.reject(error);
    }
  }
);
