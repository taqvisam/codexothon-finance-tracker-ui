import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { apiClient } from "../../services/apiClient";

const schema = z.object({
  email: z.string().email()
});

type Input = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { register, handleSubmit, formState, reset } = useForm<Input>({
    resolver: zodResolver(schema)
  });

  const mutation = useMutation({
    mutationFn: async (data: Input) => apiClient.post("/auth/forgot-password", data),
    onSuccess: () => reset({ email: "" })
  });

  return (
    <main className="auth-shell forgot-shell">
      <div className="auth-frame forgot-frame">
        <div className="auth-window-bar">
          <div className="auth-window-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="auth-window-pill">finotic.com</div>
        </div>
        <section className="forgot-visual">
          <div className="auth-logo">
            <span className="auth-logo-mark">◉</span>
            <span>Personal Expense Tracker</span>
          </div>

          <div className="forgot-hero">
            <div className="forgot-lock">🔐</div>
            <h2>Reset access quickly</h2>
            <p className="muted">
              Enter your account email. If it exists, we will send a password reset link instantly.
            </p>
          </div>
        </section>

        <section className="auth-form forgot-form">
          <div className="auth-form-inner">
          <h2>Forgot Password</h2>
          <p className="muted">No worries. We&apos;ll help you recover your account.</p>
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
            <div className="form-grid auth-form-grid">
              <label>
                <span className="muted">Email address</span>
                <input className="input" placeholder="you@example.com" {...register("email")} />
                {formState.errors.email ? <span className="error">{formState.errors.email.message}</span> : null}
              </label>
            </div>
            <button className="btn auth-login-btn" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          {mutation.isSuccess ? (
            <p className="forgot-success">If an account exists, reset instructions were sent to your email.</p>
          ) : null}

          <p className="muted forgot-links">
            <Link to="/reset-password">Have a token? Reset now</Link>
          </p>
          <p className="muted forgot-links">
            <Link to="/login">Back to login</Link>
          </p>
          </div>
        </section>
      </div>
    </main>
  );
}
