"use client";

import {
  Activity, Bell, BookOpenCheck, Building2, ChartNoAxesCombined, ClipboardCheck, FileSearch,
  IdCard, LayoutDashboard, LogOut, Network, ShieldCheck, UploadCloud, Users,
} from "lucide-react";
import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {api, ApiError} from "@/lib/api";
import type {User} from "@/lib/types";
import {Button} from "@/components/ui/button";
import {titleCase} from "@/lib/utils";
import {useEffect} from "react";

type NavItem = {href: string; label: string; icon: typeof LayoutDashboard; roles?: string[]};
const central = ["system_admin", "aicte_admin", "regional_officer", "auditor"];
const institution = ["institution_admin", "institution_operator"];
const navigation: NavItem[] = [
  {href: "/dashboard", label: "Overview", icon: LayoutDashboard},
  {href: "/institutions", label: "Institutions", icon: Building2, roles: central},
  {href: "/intakes", label: "Programmes & Intake", icon: ChartNoAxesCombined, roles: [...central, ...institution]},
  {href: "/students", label: "Student Registry", icon: Users, roles: [...central, ...institution]},
  {href: "/enrolments", label: "Enrolment Lifecycle", icon: ClipboardCheck, roles: [...central,...institution,'student']},
  {href: "/manage", label: "Management", icon: Building2, roles: ['system_admin','aicte_admin','institution_admin','institution_operator']},
  {href: "/corrections", label: "Corrections", icon: ClipboardCheck, roles: [...central,...institution,'student']},
  {href: "/notifications", label: "Notifications", icon: Bell, roles: [...central,...institution,'student']},
  {href: "/imports", label: "Data Ingestion", icon: UploadCloud, roles: institution},
  {href: "/anomalies", label: "Findings & Review", icon: Activity, roles: [...central, ...institution]},
  {href: "/credentials", label: "Credential Wallet", icon: IdCard, roles: ["student", "institution_admin", "aicte_admin"]},
  {href: "/reports", label: "Reports", icon: FileSearch, roles: [...central, ...institution]},
  {href: "/settings", label: "Policy & Integrations", icon: ShieldCheck, roles: ['aicte_admin','system_admin','auditor']},
  {href: "/audit", label: "Audit Trail", icon: ClipboardCheck, roles: ["aicte_admin", "auditor", "system_admin", "institution_admin"]},
  {href: "/demo", label: "SIH Demo Center", icon: BookOpenCheck, roles:['aicte_admin','system_admin']},
];

export function AppShell({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const me = useQuery({queryKey: ["me"], queryFn: () => api<{user: User; demo_mode: boolean}>("/auth/me"), retry: false});
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace("/login");
  }, [me.error, router]);
  if (me.isLoading) return <div className="page"><div className="loading-grid">{[1,2,3,4].map((i) => <div className="skeleton" key={i}/>)}</div></div>;
  if (!me.data) return null;
  const user = me.data.user;
  const portal = user.role === "student" ? "Student Portal" : user.role.startsWith("institution_") ? "Institution Portal" : user.role === "verifier" ? "Verifier Portal" : "AICTE Administration";
  const items = navigation.filter((item) => !item.roles || item.roles.includes(user.role));
  async function logout() {
    await api("/auth/logout", {method: "POST"});
    localStorage.removeItem("apaarsetu_csrf");
    client.clear();
    router.replace("/login");
  }
  return <div className="app-layout">
    <aside className="sidebar">
      <Link href="/dashboard" className="brand-mark"><span className="brand-symbol"><Network size={22}/></span><span>APAARSetu</span></Link>
      <div className="portal-label">{portal}</div>
      <nav className="nav-list" aria-label="Primary navigation">{items.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); const Icon = item.icon; return <Link href={item.href} key={item.href} className={`nav-link ${active ? "active" : ""}`}><Icon size={17}/><span>{item.label}</span></Link>; })}</nav>
      <div className="sidebar-footer"><strong>Demonstration environment</strong><br/>Synthetic identities and institutions only. No official APAAR identity verification.</div>
    </aside>
    <main className="main-column">
      <header className="topbar"><div className="breadcrumbs">APAARSetu / {titleCase(pathname.split("/").filter(Boolean).at(-1) ?? "Overview")}</div><div className="topbar-actions"><span className="synthetic-pill"><ShieldCheck size={13}/> Synthetic data</span><div className="user-menu"><div className="user-avatar">{user.name.split(" ").map((s) => s[0]).slice(0,2).join("")}</div><div><div className="user-name">{user.name}</div><div className="user-role">{titleCase(user.role)}</div></div></div><Button variant="ghost" size="sm" aria-label="Sign out" onClick={logout}><LogOut size={16}/></Button></div></header>
      {children}
    </main>
  </div>;
}

