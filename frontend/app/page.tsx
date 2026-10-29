"use client";
import Link from "next/link";
import {
  Building2,
  GraduationCap,
  ShieldCheck,
  ClipboardCheck,
  ArrowRight,
  FileCheck2,
  Network,
  LockKeyhole,
} from "lucide-react";
import { PublicShell } from "@/components/portal";
import { useLocale } from "@/lib/locale";
export default function HomePage() {
  const { t } = useLocale();
  const services = [
    {
      id: "aicte_admin",
      title: t("admin"),
      body: t("adminText"),
      action: t("administratorLogin"),
      Icon: ClipboardCheck,
    },
    {
      id: "institution_admin",
      title: t("institution"),
      body: t("institutionText"),
      action: t("institutionLogin"),
      Icon: Building2,
    },
    {
      id: "student",
      title: t("student"),
      body: t("studentText"),
      action: t("studentLogin"),
      Icon: GraduationCap,
    },
    {
      id: "verifier",
      title: t("verifier"),
      body: t("verifierText"),
      action: t("verifierLogin"),
      Icon: ShieldCheck,
    },
  ];
  return (
    <PublicShell>
      <section className="gateway-hero">
        <div className="gateway-copy">
          <span className="eyebrow">{t("gateway")}</span>
          <h1>{t("hero")}</h1>
          <p>{t("intro")}</p>
          <div className="page-actions" style={{ marginBottom: 20 }}>
            {services.map((s) => (
              <Link
                key={s.id}
                className="btn btn-secondary btn-sm"
                href={`/login?role=${s.id}`}
              >
                {s.action}
              </Link>
            ))}
          </div>
          <div className="hero-meta">
            <span>SIH26263</span>
            <span>{t("prototype").split("|")[0]}</span>
            <span>2026</span>
          </div>
        </div>
        <div className="gateway-identity" aria-hidden="true">
          <div className="identity-document">
            <span className="document-kicker">APAARSetu</span>
            <Network size={42} />
            <div className="document-lines">
              <i />
              <i />
              <i />
            </div>
            <span className="document-stamp">
              <ShieldCheck size={18} /> ACADEMIC RECORD
            </span>
          </div>
          <div className="identity-caption">
            INSTITUTIONS · RECORDS · CONSENT
          </div>
        </div>
      </section>
      <section className="public-section service-section">
        <div className="section-heading">
          <span className="eyebrow">APAARSetu</span>
          <h2>{t("services")}</h2>
        </div>
        <div className="service-grid">
          {services.map(({ id, title, body, action, Icon }, i) => (
            <article className="service-panel" key={id}>
              <span className="service-number">0{i + 1}</span>
              <Icon size={27} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
              <Link href={`/login?role=${id}`}>
                {action}
                <ArrowRight size={17} />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="public-section"><h2>{t("aboutTitle")}</h2><p>{t("aboutBody")}</p></section><section className="public-section process-section">
        <h2>{t("how")}</h2>
        <ol className="service-process">
          {(
            ["submit", "validate", "review", "repository", "verify"] as const
          ).map((key, i) => (
            <li key={key}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{t(key)}</strong>
            </li>
          ))}
        </ol>
      </section>
      <section className="public-section public-bottom">
        <div>
          <h2>{t("capabilities")}</h2>
          <div className="capability-grid">
            {([{key:"cap1",body:"institutionText",Icon:Building2},{key:"cap2",body:"adminText",Icon:ClipboardCheck},{key:"cap3",body:"institutionText",Icon:FileCheck2},{key:"cap4",body:"adminText",Icon:Network},{key:"cap5",body:"studentText",Icon:LockKeyhole},{key:"cap6",body:"adminText",Icon:GraduationCap}] as const).map(({key,body,Icon})=><div key={key}><Icon size={22} aria-hidden="true"/><div><h3>{t(key)}</h3><p>{t(body)}</p></div></div>)}
          </div>
        </div>
        <aside className="important-notices">
          <h2>{t("notices")}</h2>
          <ul>
            <li>{t("noticeOne")}</li>
            <li>{t("noticeTwo")}</li>
            <li>{t("noticeThree")}</li>
          </ul>
          <Link href="/help">{t("help")} →</Link>
        </aside>
      </section>
    </PublicShell>
  );
}
