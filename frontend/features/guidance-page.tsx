"use client";
import { PublicShell } from "@/components/portal";
import { useLocale } from "@/lib/locale";
export function GuidancePage({
  kind,
}: {
  kind: "guide" | "about" | "privacy" | "access";
}) {
  const { t } = useLocale();
  const titles = {
    guide: "guideTitle",
    about: "aboutTitle",
    privacy: "privacyTitle",
    access: "accessTitle",
  } as const;
  const bodies = {
    guide: "guideBody",
    about: "aboutBody",
    privacy: "privacyBody",
    access: "accessBody",
  } as const;
  return (
    <PublicShell>
      <article className="guidance-page">
        <span className="eyebrow">APAARSetu · SIH26263</span>
        <h1>{t(titles[kind])}</h1>
        <p>{t(bodies[kind])}</p>
        <div className="notice-bar">{t("noticeTwo")}</div>
        {kind === "guide" && (
          <>
            <h2>{t("demo")}</h2>
            <p>
              {t("demoText")} <strong>Demo@26263</strong>
            </p>
            <p>
              central.admin@apaarsetu.demo
              <br />
              institution.admin@apaarsetu.demo
              <br />
              student@apaarsetu.demo
              <br />
              verifier@apaarsetu.demo
            </p>
          </>
        )}
      </article>
    </PublicShell>
  );
}
