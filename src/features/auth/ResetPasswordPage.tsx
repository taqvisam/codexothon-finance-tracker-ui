import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../services/apiClient";

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(10),
  newPassword: z.string().min(8)
});

type Input = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState } = useForm<Input>({
    resolver: zodResolver(schema)
  });

  const mutation = useMutation({
    mutationFn: async (data: Input) => apiClient.post("/auth/reset-password", data),
    onSuccess: () => navigate("/login")
  });

  return (
    <main className="auth-shell reset-shell">
      <div className="auth-frame reset-frame">
        <div className="auth-window-bar">
          <div className="auth-window-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="auth-window-pill">finotic.com</div>
        </div>
        <section className="reset-visual">
          <div className="auth-logo">
            <span className="auth-logo-mark">◉</span>
            <span>Personal Expense Tracker</span>
          </div>
          <div className="reset-hero">
            <div className="reset-key">🗝️</div>
            <h2>Set a new password</h2>
            <p className="muted">
              Paste your reset token and choose a secure password to regain access.
            </p>
          </div>
        </section>

        <section className="auth-form reset-form">
          <div className="auth-form-inner">
          <h2>Reset Password</h2>
          <p className="muted">Use the token from your email to set a new password.</p>
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
            <div className="form-grid auth-form-grid">
              <label>
                <span className="muted">Email address</span>
                <input className="input" placeholder="you@example.com" {...register("email")} />
                {formState.errors.email ? <span className="error">{formState.errors.email.message}</span> : null}
              </label>
              <label>
                <span className="muted">Reset token</span>
                <input className="input" placeholder="Paste token from email" {...register("token")} />
                {formState.errors.token ? <span className="error">{formState.errors.token.message}</span> : null}
              </label>
              <label>
                <span className="muted">New password</span>
                <input className="input" type="password" placeholder="At least 8 characters" {...register("newPassword")} />
                {formState.errors.newPassword ? <span className="error">{formState.errors.newPassword.message}</span> : null}
              </label>
            </div>
            <button className="btn auth-login-btn" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Resetting..." : "Reset Password"}
            </button>
          </form>
          <p className="muted reset-links">
            <Link to="/forgot-password">Didn&apos;t receive token? Request again</Link>
          </p>
          <p className="muted reset-links">
            <Link to="/login">Back to login</Link>
          </p>
          </div>
        </section>
      </div>
    </main>
  );
}
