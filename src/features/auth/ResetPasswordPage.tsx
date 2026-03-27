import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../services/apiClient";
import { AuthShell } from "./AuthShell";

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
    <AuthShell
      mode="reset"
      formTitle="Reset Password"
      formSubtitle="Use the token from your email and set a new secure password."
      visualTitle="Secure Your Account Again."
      visualSubtitle="Finish recovery with a new password and continue from the same financial workspace."
    >
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
    </AuthShell>
  );
}
