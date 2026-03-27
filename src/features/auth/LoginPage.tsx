import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient } from "../../services/apiClient";
import { useAuthStore } from "../../store/authStore";
import { Link, useNavigate } from "react-router-dom";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { AuthShell } from "./AuthShell";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type LoginInput = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { register, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(schema)
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginInput) => {
      const response = await apiClient.post("/auth/login", data);
      return response.data as {
        accessToken: string;
        refreshToken: string;
        email: string;
        displayName: string;
        profileImageUrl?: string | null;
        showWelcomeBackMessage?: boolean;
      };
    },
    onSuccess: (data) => {
      setAuth(data);
      navigate("/onboarding");
    }
  });

  return (
    <AuthShell
      mode="login"
      formTitle="Log In"
      formSubtitle="Access your dashboard and keep every expense in one place."
      visualTitle="Get All Your Finances At One Place."
      visualSubtitle="Track budgets, balances, goals, and recurring spending from a single control center."
    >
          <form onSubmit={handleSubmit((data) => loginMutation.mutate(data))}>
            <div className="form-grid auth-form-grid">
              <label>
                <input className="input" placeholder="you@example.com" {...register("email")} />
                {formState.errors.email ? <span className="error">{formState.errors.email.message}</span> : null}
              </label>
              <label>
                <input className="input" type="password" placeholder="At least 8 characters" {...register("password")} />
                {formState.errors.password ? <span className="error">{formState.errors.password.message}</span> : null}
              </label>
            </div>

            <div className="auth-right-link">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
            <button className="btn auth-login-btn" type="submit" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Logging in..." : "Login"}
            </button>
          </form>
          <GoogleSignInButton
            mode="login"
            onSuccess={(data) => {
              setAuth(data);
              navigate("/onboarding");
            }}
          />

          <p className="muted auth-signup-link">
            Don&apos;t you have an account? <Link to="/signup">Sign Up</Link>
          </p>

          <p className="auth-footer">© 2026 ALL RIGHTS RESERVED</p>
    </AuthShell>
  );
}
