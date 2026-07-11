import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Lock, User, Tv, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "@/services/backend";
import { useState } from "react";

const schema = z.object({
  username: z.string().min(1, "Username required"),
  password: z.string().min(1, "Password required"),
});
type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const qc = useQueryClient();
  const [shake, setShake] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const doLogin = useMutation({
    mutationFn: (v: FormValues) => login(v.username, v.password),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["session"] });
      nav({ to: (redirect as string) || "/home" });
    },
    onError: () => setShake((n) => n + 1),
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      </div>

      <motion.div
        key={shake}
        initial={{ opacity: 0, y: 20 }}
        animate={
          doLogin.isError
            ? { x: [-10, 10, -8, 8, -4, 4, 0], opacity: 1, y: 0 }
            : { opacity: 1, y: 0 }
        }
        transition={{ duration: 0.5 }}
        className="glass w-full max-w-md rounded-3xl p-8 shadow-2xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="gradient-primary flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg shadow-primary/40">
            <Tv className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">
              Sign in to <span className="text-gradient">OttFree</span>
            </h1>
            <p className="text-sm text-muted-foreground">Your Ott library, cinematically.</p>
            <div class="bg-red-950 border border-red-500 rounded-lg p-4 overflow-x-auto">
              <code class="text-red-200 font-mono text-sm">&lt;p className="text-sm text-muted-foreground"&gt;Username: User, Password: User.&lt;/p&gt;
              </code>
            </div>
          </div>
        </div>

        <form onSubmit={form.handleSubmit((v) => doLogin.mutate(v))} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Username</span>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                {...form.register("username")}
                autoFocus
                autoComplete="username"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-primary/60 focus:bg-white/10"
              />
            </div>
            {form.formState.errors.username && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.username.message}</p>
            )}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                {...form.register("password")}
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-primary/60 focus:bg-white/10"
              />
            </div>
            {form.formState.errors.password && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </label>

          {doLogin.isError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              Invalid credentials. Please try again.
            </motion.p>
          )}

          <button
            type="submit"
            disabled={doLogin.isPending}
            className="gradient-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-lg shadow-primary/40 transition hover:brightness-110 disabled:opacity-70"
          >
            {doLogin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {doLogin.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
