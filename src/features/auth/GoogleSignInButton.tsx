import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  email: string;
  displayName: string;
  profileImageUrl?: string | null;
}

interface GoogleSignInButtonProps {
  mode: "login" | "signup";
  onSuccess: (auth: AuthResponse) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: "popup" | "redirect";
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "small" | "medium" | "large";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
            }
          ) => void;
        };
      };
    };
    __pftGoogleScriptPromise?: Promise<void>;
  }
}

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const DEFAULT_GOOGLE_CLIENT_ID = "498464652437-eu733fgopumap2p0153bkm8ljqtgd3s4.apps.googleusercontent.com";

function ensureGoogleScript(): Promise<void> {
  if (window.__pftGoogleScriptPromise) {
    return window.__pftGoogleScriptPromise;
  }

  window.__pftGoogleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existing) {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script."));
    document.head.appendChild(script);
  });

  return window.__pftGoogleScriptPromise;
}

export function GoogleSignInButton({ mode, onSuccess }: GoogleSignInButtonProps) {
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const clientId = (
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || DEFAULT_GOOGLE_CLIENT_ID
  );

  const oauthMutation = useMutation({
    mutationFn: async (idToken: string) =>
      (
        await apiClient.post("/auth/oauth", {
          provider: "google",
          idToken
        })
      ).data as AuthResponse,
    onSuccess: (auth) => {
      setGoogleError(null);
      onSuccess(auth);
    },
    onError: (error) => {
      const message = (
        error as { response?: { data?: { error?: string } } }
      ).response?.data?.error ?? "Google sign-in failed. Please try again.";
      setGoogleError(message);
    }
  });

  useEffect(() => {
    let active = true;

    async function setupGoogleButton() {
      if (!clientId) {
        setGoogleError("Google sign-in is not configured. Missing VITE_GOOGLE_CLIENT_ID.");
        return;
      }

      try {
        await ensureGoogleScript();
        if (!active || !buttonContainerRef.current || !window.google?.accounts?.id) {
          return;
        }

        buttonContainerRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: (response) => {
            if (!response.credential) {
              setGoogleError("Google sign-in did not return a valid token.");
              return;
            }
            oauthMutation.mutate(response.credential);
          }
        });

        window.google.accounts.id.renderButton(buttonContainerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "signup" ? "signup_with" : "signin_with",
          shape: "pill",
          logo_alignment: "left",
          width: 340
        });
      } catch {
        if (active) {
          setGoogleError("Unable to load Google sign-in. Check network and client ID config.");
        }
      }
    }

    setupGoogleButton();
    return () => {
      active = false;
    };
  }, [clientId, mode, oauthMutation]);

  return (
    <div className="google-auth-block">
      <div className="auth-sep">or continue with</div>
      <div className="google-signin-btn-wrap" ref={buttonContainerRef} />
      {oauthMutation.isPending ? <p className="muted">Signing in with Google...</p> : null}
      {googleError ? <p className="error" style={{ marginTop: 8 }}>{googleError}</p> : null}
    </div>
  );
}

