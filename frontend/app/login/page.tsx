"use client";

import {zodResolver} from "@hookform/resolvers/zod";
import {BookOpenCheck, Database, Network, ShieldCheck} from "lucide-react";
import {useRouter} from "next/navigation";
import {useQueryClient} from "@tanstack/react-query";
import {useState,useEffect} from "react";
import {useForm} from "react-hook-form";
import {z} from "zod";
import {api} from "@/lib/api";
import {Button} from "@/components/ui/button";
import {Input, Label} from "@/components/ui/input";
import {Alert} from "@/components/ui/alert";

const schema = z.object({email: z.string().email(), password: z.string().min(8)});
type Login = z.infer<typeof schema>;
const accounts = [
  ["Central Admin", "central.admin@apaarsetu.demo"], ["Institution", "institution.operator@apaarsetu.demo"],
  ["Student", "student@apaarsetu.demo"], ["Verifier", "verifier@apaarsetu.demo"],
];

export default function LoginPage() {
  const router = useRouter();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [ready,setReady] = useState(false);
  useEffect(()=>setReady(true),[]);
  const form = useForm<Login>({resolver: zodResolver(schema), defaultValues: {email: "central.admin@apaarsetu.demo", password: "Demo@26263"}});
  async function submit(values: Login) {
    setError("");
    try {
      const result = await api<{csrf_token: string}>("/auth/login", {method: "POST", body: JSON.stringify(values)});
      client.clear();
      localStorage.setItem("apaarsetu_csrf", result.csrf_token);
      router.push("/dashboard");
    } catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed"); }
  }
  function choose(email: string) { form.setValue("email", email); form.setValue("password", "Demo@26263"); }
  return <div className="login-layout">
    <section className="login-brand">
      <div className="brand-mark"><span className="brand-symbol"><Network size={22}/></span><span>APAARSetu</span></div>
      <div className="login-copy"><div className="eyebrow">SIH26263 · Synthetic demonstration</div><h1>Trusted academic records. Accountable enrolment.</h1><p>One operational platform for student-level data ingestion, approved-intake compliance, explainable anomaly review and consent-controlled academic verification.</p></div>
      <div className="trust-row"><span><ShieldCheck size={15}/> Role-scoped access</span><span><Database size={15}/> Persistent audit trail</span><span><BookOpenCheck size={15}/> Ed25519 credentials</span></div>
    </section>
    <section className="login-panel"><div className="login-card"><h2>Sign in to your portal</h2><p>Access is scoped by role and institution. All demonstration identities and records are fictional.</p>{error && <Alert title="Unable to sign in" tone="danger">{error}</Alert>}<form className="form-stack" onSubmit={form.handleSubmit(submit)}><div><Label htmlFor="email">Email address</Label><Input id="email" autoComplete="username" {...form.register("email")}/>{form.formState.errors.email && <div className="field-error">Enter a valid email address.</div>}</div><div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" {...form.register("password")}/>{form.formState.errors.password && <div className="field-error">Password must contain at least 8 characters.</div>}</div><Button size="lg" type="submit" disabled={!ready||form.formState.isSubmitting}>{form.formState.isSubmitting ? "Signing in…" : "Secure sign in"}</Button></form><div className="demo-accounts"><h3>Quick demo access</h3><div className="account-grid">{accounts.map(([label,email]) => <button className="account-chip" key={email} onClick={() => choose(email)}><strong>{label}</strong><br/>{email}</button>)}</div><p style={{fontSize: 11, color: "#6d7b90", marginTop: 12}}>Development password: <strong>Demo@26263</strong></p></div></div></section>
  </div>;
}

