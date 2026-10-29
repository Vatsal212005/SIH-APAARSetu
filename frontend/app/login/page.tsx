"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, ShieldCheck, ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { PublicShell } from "@/components/portal";
import { useLocale } from "@/lib/locale";
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type Login = z.infer<typeof schema>;
const roles = [
  {
    id: "aicte_admin",
    key: "centralRole",
    email: "central.admin@apaarsetu.demo",
  },
  {
    id: "regional_officer",
    key: "regionRole",
    email: "regional.officer@apaarsetu.demo",
  },
  {
    id: "institution_admin",
    key: "institutionRole",
    email: "institution.admin@apaarsetu.demo",
  },
  {
    id: "institution_operator",
    key: "operatorRole",
    email: "institution.operator@apaarsetu.demo",
  },
  { id: "student", key: "studentRole", email: "student@apaarsetu.demo" },
  { id: "verifier", key: "verifierRole", email: "verifier@apaarsetu.demo" },
  { id: "auditor", key: "auditorRole", email: "auditor@apaarsetu.demo" },
] as const;
export default function LoginPage() {
  const router = useRouter(),
    client = useQueryClient(),
    { t } = useLocale();
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [show, setShow] = useState(false),
    [role, setRole] = useState("aicte_admin");
  const form = useForm<Login>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "central.admin@apaarsetu.demo",
      password: "Demo@26263",
    },
  });
  useEffect(() => {
    const selected = roles.find(
      (r) => r.id === new URLSearchParams(window.location.search).get("role"),
    );
    if (selected) {
      setRole(selected.id);
      form.setValue("email", selected.email);
    }
    setReady(true);
  }, [form]);
  async function submit(values: Login) {
    setError("");
    try {
      const result = await api<{ csrf_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      client.clear();
      localStorage.setItem("apaarsetu_csrf", result.csrf_token);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  }
  return (
    <PublicShell>
      <div className="login-layout">
        <section className="login-brand">
          <div>
            <span className="eyebrow">SIH26263 · 2026</span>
            <h1>{t("system")}</h1>
            <p>{t("intro")}</p>
          </div>
          <div className="login-services">
            <div>
              <Building2 size={22} />
              {t("institution")}
            </div>
            <div>
              <ClipboardCheck size={22} />
              {t("review")}
            </div>
            <div>
              <ShieldCheck size={22} />
              {t("verify")}
            </div>
          </div>
          <div className="notice-bar">{t("noticeTwo")}</div>
        </section>
        <section className="login-panel" aria-labelledby="sign-in-heading">
          <div className="login-card">
            <h2 id="sign-in-heading">{t("signTitle")}</h2>
            <p>{t("signIntro")}</p>
            {error && (
              <Alert title={t("failure")} tone="danger">
                {error}
              </Alert>
            )}
            <form
              className="form-stack"
              onSubmit={form.handleSubmit(submit)}
              noValidate
            >
              <div>
                <Label htmlFor="role">{t("role")}</Label>
                <select
                  className="input"
                  id="role"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    const item = roles.find((r) => r.id === e.target.value);
                    if (item) form.setValue("email", item.email);
                    setError("");
                  }}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {t(r.key)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  aria-invalid={!!form.formState.errors.email}
                  aria-describedby={
                    form.formState.errors.email ? "email-error" : undefined
                  }
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <div id="email-error" className="field-error">
                    {t("emailError")}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="password">{t("password")}</Label>
                <div className="password-field">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    aria-invalid={!!form.formState.errors.password}
                    aria-describedby={
                      form.formState.errors.password
                        ? "password-error"
                        : undefined
                    }
                    {...form.register("password")}
                  />
                  <button
                    type="button"
                    aria-pressed={show}
                    onClick={() => setShow(!show)}
                  >
                    {show ? t("hide") : t("show")}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <div className="field-error" id="password-error">
                    {t("passwordError")}
                  </div>
                )}
              </div>
              <Button
                size="lg"
                type="submit"
                disabled={!ready || form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? t("signing") : t("signButton")}
              </Button>
            </form>
            <div className="demo-accounts">
              <h3>{t("demo")}</h3>
              <p>
                {t("demoText")} <strong>Demo@26263</strong>
              </p>
              <p>{roles.find((r) => r.id === role)?.email}</p>
              <a href="/help">{t("help")} →</a>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
