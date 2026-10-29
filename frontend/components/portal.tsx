"use client";
import Link from "next/link";
import { useLocale } from "@/lib/locale";
import type { ReactNode } from "react";
export function BrandMark() {
  return (
    <svg className="brand-symbol" viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M7 8h14l3 4 3-4h14v28H28l-4 4-4-4H7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M24 13v19M12 17h7m-7 6h7m10-6h7m-7 6h7"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m17 30 5 5 10-10"
        fill="none"
        stroke="var(--teal-600)"
        strokeWidth="3"
      />
    </svg>
  );
}
export function PrototypeBanner() {
  const { t } = useLocale();
  return <div className="prototype-banner">{t("prototype")}</div>;
}
export function GovernmentUtilityBar({ session }: { session?: string }) {
  const { t, language, supported, setLanguage, size, setSize } = useLocale();
  return (
    <div className="utility-bar">
      <a className="skip-link" href="#main-content">
        {t("skip")}
      </a>
      <div className="utility-inner">
        <span>
          APAARSetu · SIH26263
          {session && <span className="utility-session"> · {session}</span>}
        </span>
        <div className="utility-controls">
          <div role="group" aria-label="Text size">
            <button
              aria-label="A− Decrease text size"
              aria-pressed={size === "small"}
              onClick={() => setSize("small")}
            >
              A−
            </button>
            <button
              aria-label="A Reset text size"
              aria-pressed={size === "normal"}
              onClick={() => setSize("normal")}
            >
              A
            </button>
            <button
              aria-label="A+ Increase text size"
              aria-pressed={size === "large"}
              onClick={() => setSize("large")}
            >
              A+
            </button>
          </div>
          {supported && (
            <div className="language-control">
              <label className="sr-only" htmlFor="portal-language">{t("language")}</label>
              <select
                id="portal-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </div>
          )}
          <Link href="/help">{t("help")}</Link>
        </div>
      </div>
    </div>
  );
}
export function PortalMasthead({
  workspace,
  actions,
}: {
  workspace?: string;
  actions?: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <header className="portal-masthead">
      <div className="masthead-inner">
        <Link className="brand-lockup" href="/">
          <BrandMark />
          <span>
            <strong>
              APAAR<span>Setu</span>
            </strong>
            <span className="brand-description">{t("system")}</span>
            <span className="brand-subtitle">{t("subtitle")}</span>
          </span>
        </Link>
        <div className="masthead-workspace">
          <span className="workspace-label">
            {workspace ?? "SMART INDIA HACKATHON 2026"}
          </span>
          {actions}
        </div>
      </div>
    </header>
  );
}
export function PortalFooter() {
  const { t } = useLocale();
  return (
    <footer className="portal-footer">
      <div>
        <strong>{t("footer")}</strong>
        <p>{t("noticeOne")}</p>
      </div>
      <nav aria-label="Footer navigation">
        {(["help", "about", "privacy", "accessibility"] as const).map((k) => (
          <Link key={k} href={`/${k}`}>
            {t(k)}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
export function PublicShell({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  return (
    <>
      <GovernmentUtilityBar />
      <PortalMasthead />
      <PrototypeBanner />
      <nav className="public-navigation" aria-label="Public navigation">
        <div>
          <Link href="/">{t("home")}</Link>
          <Link href="/about">{t("about")}</Link>
          <Link href="/help">{t("help")}</Link>
          <Link href="/login">{t("login")} →</Link>
        </div>
      </nav>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <PortalFooter />
    </>
  );
}
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-title">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
export function EvidencePanel({
  title = "Technical evidence",
  value,
}: {
  title?: string;
  value: unknown;
}) {
  return (
    <details className="evidence-panel">
      <summary>{title}</summary>
      <pre className="finding-evidence">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
export function UploadStepper({ step }: { step: number }) {
  return (
    <ol className="upload-stepper" aria-label="Submission progress">
      {[
        "Context",
        "Select file",
        "Map columns",
        "Preview",
        "Validate",
        "Review & submit",
        "Confirmation",
      ].map((label, i) => (
        <li
          key={label}
          aria-current={step === i + 1 ? "step" : undefined}
          className={step >= i + 1 ? "done" : ""}
        >
          <span>{i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
