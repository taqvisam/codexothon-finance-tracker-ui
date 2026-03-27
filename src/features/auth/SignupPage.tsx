import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../services/apiClient";
import { useAuthStore } from "../../store/authStore";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { AuthShell } from "./AuthShell";

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
    <AuthShell
      mode="signup"
      formTitle="Sign Up"
      formSubtitle="Create your account and start tracking income, expenses, budgets, and goals."
      visualTitle="Build A Cleaner Money Routine."
      visualSubtitle="Start with a simple setup, then grow into forecasting, insights, and smarter financial planning."
    >
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
          <GoogleSignInButton
            mode="signup"
            onSuccess={(data) => {
              setAuth(data);
              navigate("/onboarding");
            }}
          />

          <p className="muted auth-signup-link">
            Already have an account? <Link to="/login">Login</Link>
          </p>

          <p className="auth-footer">© 2026 ALL RIGHTS RESERVED</p>
    </AuthShell>
  );
}
