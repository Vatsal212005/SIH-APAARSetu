"use client";
import {
  Activity,
  Bell,
  BookOpenCheck,
  Building2,
  ChartNoAxesCombined,
  ClipboardCheck,
  FileSearch,
  IdCard,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UploadCloud,
  Users,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { titleCase } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  GovernmentUtilityBar,
  PortalMasthead,
  PrototypeBanner,
  PortalFooter,
} from "@/components/portal";
type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
  group: string;
};
const central = ["system_admin", "aicte_admin", "regional_officer", "auditor"],
  institution = ["institution_admin", "institution_operator"];
export const navigation: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    group: "Workspace",
  },
  {
    href: "/institutions",
    label: "Institutions",
    icon: Building2,
    roles: central,
    group: "Records & submissions",
  },
  {
    href: "/intakes",
    label: "Programmes & Intake",
    icon: ChartNoAxesCombined,
    roles: [...central, ...institution],
    group: "Records & submissions",
  },
  {
    href: "/students",
    label: "Student Registry",
    icon: Users,
    roles: [...central, ...institution],
    group: "Records & submissions",
  },
  {
    href: "/enrolments",
    label: "Enrolment Lifecycle",
    icon: ClipboardCheck,
    roles: [...central, ...institution, "student"],
    group: "Records & submissions",
  },
  {
    href: "/manage",
    label: "Management",
    icon: Building2,
    roles: ["system_admin", "aicte_admin", ...institution],
    group: "Records & submissions",
  },
  {
    href: "/imports",
    label: "Data Ingestion",
    icon: UploadCloud,
    roles: institution,
    group: "Records & submissions",
  },
  {
    href: "/anomalies",
    label: "Findings & Review",
    icon: Activity,
    roles: [...central, ...institution],
    group: "Compliance & verification",
  },
  {
    href: "/corrections",
    label: "Corrections",
    icon: ClipboardCheck,
    roles: [...central, ...institution, "student"],
    group: "Compliance & verification",
  },
  {
    href: "/credentials",
    label: "Credential Wallet",
    icon: IdCard,
    roles: ["student", "institution_admin", "aicte_admin", "system_admin"],
    group: "Compliance & verification",
  },
  {
    href: "/reports",
    label: "Reports",
    icon: FileSearch,
    roles: [...central, ...institution],
    group: "Insights & administration",
  },
  {
    href: "/notifications",
    label: "Notifications",
    icon: Bell,
    roles: [...central, ...institution, "student"],
    group: "Insights & administration",
  },
  {
    href: "/settings",
    label: "Policy & Integrations",
    icon: ShieldCheck,
    roles: ["aicte_admin", "system_admin", "auditor"],
    group: "Insights & administration",
  },
  {
    href: "/audit",
    label: "Audit Trail",
    icon: ClipboardCheck,
    roles: ["aicte_admin", "auditor", "system_admin", "institution_admin"],
    group: "Insights & administration",
  },
  {
    href: "/demo",
    label: "SIH Demo Center",
    icon: BookOpenCheck,
    roles: ["aicte_admin", "system_admin"],
    group: "Insights & administration",
  },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    router = useRouter(),
    client = useQueryClient();
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width:900px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User; demo_mode: boolean }>("/auth/me"),
    retry: false,
  });
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401)
      router.replace("/login");
  }, [me.error, router]);
  useEffect(() => setMobile(false), [pathname]);
  if (me.isLoading)
    return (
      <main className="page" aria-busy="true">
        <p>Loading your authorized workspace…</p>
        <div className="loading-grid">
          {[1, 2, 3, 4].map((i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      </main>
    );
  if (!me.data)
    return me.error ? (
      <main className="page">
        <div role="alert" className="error-panel">
          {me.error.message}
        </div>
        <Link href="/login">Return to sign in</Link>
      </main>
    ) : null;
  const user = me.data.user;
  const portal =
    user.role === "student"
      ? "Student Portal"
      : user.role.startsWith("institution_")
        ? "Institution Management"
        : user.role === "verifier"
          ? "Academic Verification"
          : "AICTE Administration";
  const items = navigation.filter(
    (item) => !item.roles || item.roles.includes(user.role),
  );
  const current = items.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    localStorage.removeItem("apaarsetu_csrf");
    client.clear();
    router.replace("/login");
  }
  function toggle() {
    if (window.matchMedia("(max-width:900px)").matches) setMobile(!mobile);
    else setCollapsed(!collapsed);
  }
  return (
    <div className={collapsed ? "app-layout nav-is-collapsed" : "app-layout"}>
      <GovernmentUtilityBar session={user.name} />
      <PortalMasthead
        workspace={portal}
        actions={
          <div className="session-control">
            <div>
              <div className="user-name">{user.name}</div>
              <div className="user-role">{titleCase(user.role)}</div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Sign out"
              onClick={logout}
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </Button>
          </div>
        }
      />
      <PrototypeBanner />
      <nav className="workspace-topnav" aria-label="Service navigation">
        <button
          id="navigation-toggle"
          aria-controls="workspace-sidebar"
          aria-expanded={compact ? mobile : !collapsed}
          onClick={toggle}
        >
          <Menu size={18} /> Workspace menu
        </button>
        <Link href="/dashboard">Overview</Link>
        {items.some((i) => i.href === "/students") && (
          <Link href="/students">Student records</Link>
        )}
        {items.some((i) => i.href === "/anomalies") && (
          <Link href="/anomalies">Compliance</Link>
        )}
        <Link href="/help">Service help</Link>
        <span className="workspace-date">{titleCase(user.role)}</span>
      </nav>
      <div className="workspace-body">
        <aside
          id="workspace-sidebar"
          className="workspace-sidebar"
          data-mobile-open={mobile}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setMobile(false);
              document.getElementById("navigation-toggle")?.focus();
            }
          }}
        >
          <div className="portal-label">{portal}</div>
          <nav aria-label="Primary navigation">
            {Array.from(new Set(items.map((i) => i.group))).map((group) => (
              <div key={group}>
                <div className="nav-group-title">{group}</div>
                <div className="nav-list">
                  {items
                    .filter((i) => i.group === group)
                    .map((item) => {
                      const Icon = item.icon,
                        active =
                          pathname === item.href ||
                          pathname.startsWith(item.href + "/");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`nav-link ${active ? "active" : ""}`}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon size={17} aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                </div>
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <strong>Prototype workspace</strong>
            <p>
              Fictional records. Institutional attestations and official
              identity verification are separate.
            </p>
            <Link href="/privacy">Privacy and consent guidance →</Link>
          </div>
        </aside>
        <div className="main-column">
          <nav className="portal-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/dashboard">{portal}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">
              {current?.label ??
                titleCase(
                  pathname.split("/").filter(Boolean).at(-1) ?? "Dashboard",
                )}
              {pathname.split("/").filter(Boolean).length > 1
                ? " / Record details"
                : ""}
            </span>
          </nav>
          <main id="main-content" tabIndex={-1}>
            {current ? children : <div className="page"><h1>Workspace access restricted</h1><p>This workspace is not available for your account role. Your permissions are enforced by the API.</p><Link className="btn btn-primary btn-md" href="/dashboard">Return to your dashboard</Link></div>}
          </main>
        </div>
      </div>
      <PortalFooter />
    </div>
  );
}
