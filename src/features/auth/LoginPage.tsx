import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient } from "../../services/apiClient";
import { useAuthStore } from "../../store/authStore";
import { Link, useNavigate } from "react-router-dom";
import { useCurrency } from "../../hooks/useCurrency";
import { GoogleSignInButton } from "./GoogleSignInButton";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type LoginInput = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const currency = useCurrency();
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
      };
    },
    onSuccess: (data) => {
      setAuth(data);
      navigate("/onboarding");
    }
  });

  return (
    <main className="auth-shell">
      <div className="auth-frame">
        <section className="auth-visual">
          <div className="auth-logo">
            <span className="auth-logo-mark">◉</span>
            <span>Personal Expense Tracker</span>
          </div>

          <div className="auth-illustration">
            <article className="auth-balance-card">
              <small>CURRENT BALANCE</small>
              <strong>{currency(24359)}</strong>
            </article>
            <article className="auth-donut-card">
              <div className="auth-donut" aria-label="34 percent food" />
              <span>Food</span>
            </article>
            <article className="auth-add-card">
              <div className="auth-add-plus">+</div>
              <strong>New transaction</strong>
              <small>or upload .xls file</small>
            </article>
          </div>

          <h2>Welcome back!</h2>
          <p className="muted">Start managing your finance faster and better</p>
        </section>

        <section className="auth-form">
          <h2>Welcome back!</h2>
          <p className="muted">Start managing your finance faster and better</p>
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
        </section>
      </div>
    </main>
  );
}
