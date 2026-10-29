"use client";
import {parseTimestamp} from "@/lib/utils";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale";
import { PublicShell } from "@/components/portal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
type Verification = {
  valid: boolean;
  outcome: string;
  message?: string;
  checks?: Record<string, boolean>;
  credential_id?: string;
  issuer?: { name: string; trust: string };
  disclosed_fields?: Record<string, string>;
  expires_at?: string;
  notice?: string;
};
const hiFields: Record<string, string> = {
  student_name: "छात्र का नाम",
  institution: "संस्थान",
  programme: "कार्यक्रम",
  specialization: "विशेषज्ञता",
  academic_year: "शैक्षणिक वर्ष",
  enrolment_status: "नामांकन स्थिति",
  institution_student_id: "संस्थान छात्र पहचान",
  apaar_masked: "छिपी हुई पहचान",
  trusted_demo_issuer: "विश्वसनीय प्रदर्शन जारीकर्ता",
  credential_current: "प्रमाणपत्र अवधि और निरस्तीकरण",
  signature_valid: "डिजिटल हस्ताक्षर",
  credential_active: "प्रमाणपत्र सक्रिय",
  not_expired: "अवधि मान्य",
  consent_active: "सहमति सक्रिय",
  credential_not_revoked: "प्रमाणपत्र निरस्त नहीं",
  consent_not_revoked: "सहमति निरस्त नहीं",
};
export default function VerifyPage() {
  const { token } = useParams<{ token: string }>(),
    { t, language } = useLocale();
  const query = useQuery({
    queryKey: ["verification", token],
    queryFn: () => api<Verification>(`/verification/${token}`),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const data = query.data,
    label = (key: string) =>
      language === "hi"
        ? (hiFields[key] ?? key.replaceAll("_", " "))
        : key.replaceAll("_", " ");
  return (
    <PublicShell>
      <section className="verification-shell">
        <div className="page-title" style={{ marginBottom: 24 }}>
          <span className="eyebrow">APAARSetu</span>
          <h1>{t("verifyTitle")}</h1>
          <p>{t("verifySubtitle")}</p>
        </div>
        <div className="verification-card">
          <div className="verification-header">
            <strong>
              APAARSetu ·{" "}
              {language === "hi" ? "सत्यापन परिणाम" : "Verification result"}
            </strong>
            <Badge tone={data?.valid ? "green" : "amber"}>
              {data?.valid ? t("signature") : t("denied")}
            </Badge>
          </div>
          <div className="verification-body">
            {query.isLoading ? (
              <div className="skeleton" aria-label="Loading verification" />
            ) : query.error ? (
              <Alert title={t("denied")} tone="danger">
                {query.error.message}
              </Alert>
            ) : (
              <>
                <div className="verification-heading">
                  {data?.valid ? (
                    <CheckCircle2
                      size={30}
                      color="var(--success)"
                      aria-hidden="true"
                    />
                  ) : (
                    <ShieldAlert
                      size={30}
                      color="var(--danger)"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <h2>{data?.valid ? t("passed") : t("denied")}</h2>
                    {data?.valid && (
                      <p className="record-subtitle">
                        {data.issuer?.name} · {data.credential_id}
                      </p>
                    )}
                  </div>
                </div>
                {data?.valid && (
                  <div className="alert alert-success">
                    <strong>{t("signature")}</strong>
                  </div>
                )}
                {data?.checks && (
                  <dl className="check-list">
                    {Object.entries(data.checks)
                      .filter(([key]) => !key.includes("official"))
                      .map(([key, value]) => (
                        <div className="check-row" key={key}>
                          <dt>{label(key)}</dt>
                          <dd style={{ margin: 0 }}>
                            <Badge tone={value ? "green" : "red"}>
                              {language === "hi"
                                ? value
                                  ? "जाँच सफल"
                                  : "जाँच असफल"
                                : value
                                  ? "Passed"
                                  : "Failed"}
                            </Badge>
                          </dd>
                        </div>
                      ))}
                  </dl>
                )}
                {data?.valid ? (
                  <>
                    <h3>{t("disclosed")}</h3>
                    <div className="disclosed-grid">
                      {Object.entries(data.disclosed_fields ?? {}).map(
                        ([key, value]) => (
                          <div className="disclosed-field" key={key}>
                            <span>{label(key)}</span>
                            <strong>{value}</strong>
                          </div>
                        ),
                      )}
                    </div>
                    {data.expires_at && (
                      <p className="record-subtitle">
                        {language === "hi" ? "अवधि समाप्ति" : "Consent expiry"}:{" "}
                        {parseTimestamp(data.expires_at).toLocaleString(
                          language === "hi" ? "hi-IN" : "en-IN",
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <Alert title={t("privacyProtected")} tone="warning">
                    {t("privacyDenied")}
                  </Alert>
                )}
                <Alert title={t("identityUnavailable")}>
                  {t("noticeThree")}
                </Alert>
              </>
            )}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
