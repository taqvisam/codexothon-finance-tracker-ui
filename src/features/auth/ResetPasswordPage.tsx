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
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <section className="card" style={{ width: 420 }}>
        <h2>Reset Password</h2>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <label>
              Email
              <input className="input" {...register("email")} />
              {formState.errors.email && <div className="error">{formState.errors.email.message}</div>}
            </label>
            <label>
              Reset Token
              <input className="input" {...register("token")} />
              {formState.errors.token && <div className="error">{formState.errors.token.message}</div>}
            </label>
            <label>
              New Password
              <input className="input" type="password" {...register("newPassword")} />
              {formState.errors.newPassword && <div className="error">{formState.errors.newPassword.message}</div>}
            </label>
          </div>
          <button className="btn" type="submit">Reset Password</button>
        </form>
        <p className="muted"><Link to="/login">Back to login</Link></p>
      </section>
    </main>
  );
}
