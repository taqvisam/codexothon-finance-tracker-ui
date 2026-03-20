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
  const { register, handleSubmit, formState } = useForm<Input>({
    resolver: zodResolver(schema)
  });

  const mutation = useMutation({
    mutationFn: async (data: Input) => apiClient.post("/auth/forgot-password", data)
  });

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <section className="card" style={{ width: 420 }}>
        <h2>Forgot Password</h2>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <label>
            Email
            <input className="input" {...register("email")} />
            {formState.errors.email && <div className="error">{formState.errors.email.message}</div>}
          </label>
          <div style={{ marginTop: 12 }}>
            <button className="btn" type="submit">Send Reset Link</button>
          </div>
        </form>
        {mutation.isSuccess && <p className="muted">If account exists, reset instructions were sent.</p>}
        <p className="muted"><Link to="/reset-password">Have token? Reset now</Link></p>
      </section>
    </main>
  );
}
