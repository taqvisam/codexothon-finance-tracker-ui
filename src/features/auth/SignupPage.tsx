import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../services/apiClient";
import { useAuthStore } from "../../store/authStore";
import { useCurrency } from "../../hooks/useCurrency";

const schema = z.object({
  displayName: z.string().min(2, "Display name is required."),
  email: z.string().email("Enter a valid email."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Must include uppercase letter.")
    .regex(/[a-z]/, "Must include lowercase letter.")
    .regex(/[0-9]/, "Must include number.")
});

type Input = z.infer<typeof schema>;

export function SignupPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const currency = useCurrency();
  const { register, handleSubmit, formState } = useForm<Input>({
    resolver: zodResolver(schema)
  });

  const signupMutation = useMutation({
    mutationFn: async (data: Input) => (await apiClient.post("/auth/register", data)).data,
    onSuccess: (data) => {
      setAuth(data);
      navigate("/onboarding");
    }
  });

  const apiError = signupMutation.error
    ? ((signupMutation.error as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Signup failed.")
    : null;

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
              <strong>Set your first goal</strong>
              <small>Track your budget from day one</small>
            </article>
          </div>

          <h2 className="auth-signup-visual-title">Get started!</h2>
          <p className="muted">Create your account and start tracking your personal finances.</p>
        </section>

        <section className="auth-form">
          <h2>Create Account</h2>
          <p className="muted">Sign up to manage income, expenses, budgets and goals</p>
          <form onSubmit={handleSubmit((data) => signupMutation.mutate(data))}>
            <div className="form-grid auth-form-grid">
              <label>
                <input className="input" placeholder="Display name" {...register("displayName")} />
                {formState.errors.displayName ? <span className="error">{formState.errors.displayName.message}</span> : null}
              </label>
              <label>
                <input className="input" placeholder="you@example.com" {...register("email")} />
                {formState.errors.email ? <span className="error">{formState.errors.email.message}</span> : null}
              </label>
              <label>
                <input className="input" type="password" placeholder="At least 8 characters" {...register("password")} />
                {formState.errors.password ? <span className="error">{formState.errors.password.message}</span> : null}
              </label>
            </div>

            {apiError ? <div className="error" style={{ marginBottom: 10 }}>{apiError}</div> : null}

            <button className="btn auth-login-btn" type="submit" disabled={signupMutation.isPending}>
              {signupMutation.isPending ? "Creating..." : "Create Account"}
            </button>
          </form>

          <div className="auth-sep">or</div>

          <div className="auth-social-row">
            <button className="btn ghost auth-social-btn" type="button">Google</button>
            <button className="btn ghost auth-social-btn" type="button">Facebook</button>
          </div>

          <p className="muted auth-signup-link">
            Already have an account? <Link to="/login">Login</Link>
          </p>

          <p className="auth-footer">© 2026 ALL RIGHTS RESERVED</p>
        </section>
      </div>
    </main>
  );
}
