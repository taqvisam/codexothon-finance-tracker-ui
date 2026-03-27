import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { apiClient } from "../../services/apiClient";
import { AuthShell } from "./AuthShell";

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
    <AuthShell
      mode="forgot"
      formTitle="Forgot Password"
      formSubtitle="Enter your email and we will send reset instructions if the account exists."
      visualTitle="Reset Access Without Friction."
      visualSubtitle="Recover your account quickly and get back to your budgets, reports, and day-to-day tracking."
    >
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
    </AuthShell>
  );
}
