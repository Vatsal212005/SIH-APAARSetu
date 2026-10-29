"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
const en = {
cap1:"Secure institutional submissions",cap2:"Approved intake monitoring",cap3:"Duplicate detection",cap4:"Cross-institution review",cap5:"Consent-based verification",cap6:"Regulatory analytics",
  prototype:
    "SIH 2026 Prototype | Synthetic Data | Not an Official Government Portal",
  system: "Student Enrolment and Academic Verification System",
  subtitle: "Intelligent Student Data Management for AICTE Institutions",
  skip: "Skip to main content",
  help: "Help",
  about: "About",
  privacy: "Privacy",
  accessibility: "Accessibility",
  home: "Home",
  login: "Sign in",
  language: "Language",
  hero: "One Academic Identity. Connected Student Records.",
  intro:
    "A unified platform for student enrolment monitoring, institutional data validation and secure academic verification.",
  gateway: "Academic services gateway",
  services: "Access a service",
  how: "How the platform works",
  admin: "AICTE Administration",
  institution: "Institution Data Submission",
  student: "Student Academic Records",
  verifier: "Authorized Verification",
  adminText:
    "Monitor institutional submissions, approved intake and evidence-based compliance reviews.",
  institutionText:
    "Submit student records, correct validation issues and manage institutional enrolment.",
  studentText:
    "View your academic records and choose which credential fields you share.",
  verifierText:
    "Check a student-shared credential reference within its consent and validity period.",
  administratorLogin: "AICTE Administrator Login",
  institutionLogin: "Institution Login",
  studentLogin: "Student Login",
  verifierLogin: "Authorized Verifier",
  submit: "Institution Submission",
  validate: "Data Validation",
  review: "Compliance & Review",
  repository: "Central Repository",
  verify: "Authorized Verification",
  capabilities: "Built for accountable academic administration",
  notices: "Important information",
  noticeOne:
    "All institutions, people and identifiers in this demonstration are fictional.",
  noticeTwo:
    "Official APAAR identity verification is unavailable in demonstration mode.",
  noticeThree:
    "A valid digital signature confirms this local issuer's record integrity, not a government-verified identity.",
  signTitle: "Sign in to your portal",
  signIntro:
    "Choose your workspace and use your authorized account. Permissions are checked by the server.",
  role: "Workspace / role",
  email: "Email address",
  password: "Password",
  show: "Show password",
  hide: "Hide password",
  signButton: "Secure sign in",
  signing: "Signing in…",
  demo: "Demonstration access",
  demoText: "Use fictional demonstration accounts only. Development password:",
  failure: "Unable to sign in",
  emailError: "Enter a valid email address.",
  passwordError: "Password must contain at least 8 characters.",
  centralRole: "AICTE Central Administrator",
  regionRole: "Regional Officer",
  institutionRole: "Institution Administrator",
  operatorRole: "Institution Operator",
  studentRole: "Student",
  verifierRole: "Authorized Verifier",
  auditorRole: "Auditor",
  verifyTitle: "Academic Credential Verification",
  verifySubtitle:
    "Verify the integrity and permitted disclosure of institution-issued demonstration academic records.",
  passed: "Credential checks passed",
  denied: "Verification denied",
  signature: "Digital Signature Valid",
  disclosed: "Consent-authorized fields",
  identityUnavailable:
    "Official APAAR Identity Verification: Not Available in Demonstration Mode",
  privacyProtected: "Privacy protected",
  privacyDenied:
    "No student fields are disclosed unless signature, consent, expiry and revocation checks all pass.",
  guideTitle: "Help and service guidance",
  aboutTitle: "About APAARSetu",
  privacyTitle: "Privacy and consent",
  accessTitle: "Accessibility information",
  guideBody:
    "Choose a portal from the home page. Institutions submit CSV/XLSX records and review row errors before committing. Administrators review evidence and record reasons. Students share selected credential fields and can revoke access. Verifiers need a student-authorized reference.",
  aboutBody:
    "APAARSetu is a Smart India Hackathon 2026 prototype for SIH26263. It connects institutional submissions, policy checks, human review and consent-based verification. It is not owned, hosted or endorsed by a government authority.",
  privacyBody:
    "Identifiers are masked in normal views. A consent link is an opaque bearer reference: anyone holding it may use it until expiry or revocation. Recipient names are labels, not authenticated audience restrictions. Share links carefully. Official APAAR and DigiLocker connections are unavailable.",
  accessBody:
    "Use the skip link, keyboard navigation, visible focus indicators and text-size controls. The layout supports narrow screens and deliberate table scrolling. English and Hindi are available on public, sign-in, guidance and verification pages. Administrative workspaces currently use English. WCAG 2.1 AA and GIGW 3.0 are design targets; no formal certification is claimed.",
  footer: "APAARSetu · Smart India Hackathon 2026 · SIH26263",
};
const hi: typeof en = {
cap1:"सुरक्षित संस्थागत प्रस्तुतियाँ",cap2:"स्वीकृत प्रवेश क्षमता की निगरानी",cap3:"दोहराए अभिलेखों की पहचान",cap4:"अंतर-संस्थान समीक्षा",cap5:"सहमति-आधारित सत्यापन",cap6:"नियामक विश्लेषण",
  prototype:
    "एसआईएच 2026 प्रोटोटाइप | काल्पनिक डेटा | आधिकारिक सरकारी पोर्टल नहीं",
  system: "छात्र नामांकन और शैक्षणिक सत्यापन प्रणाली",
  subtitle: "एआईसीटीई संस्थानों के लिए छात्र डेटा प्रबंधन",
  skip: "मुख्य सामग्री पर जाएँ",
  help: "सहायता",
  about: "परिचय",
  privacy: "गोपनीयता",
  accessibility: "सुगम्यता",
  home: "मुखपृष्ठ",
  login: "साइन इन",
  language: "भाषा",
  hero: "एक शैक्षणिक पहचान। जुड़े हुए छात्र अभिलेख।",
  intro:
    "छात्र नामांकन निगरानी, संस्थागत डेटा जाँच और सुरक्षित शैक्षणिक सत्यापन के लिए एक एकीकृत मंच।",
  gateway: "शैक्षणिक सेवा प्रवेश द्वार",
  services: "सेवा चुनें",
  how: "मंच कैसे काम करता है",
  admin: "एआईसीटीई प्रशासन",
  institution: "संस्थान डेटा जमा",
  student: "छात्र शैक्षणिक अभिलेख",
  verifier: "अधिकृत सत्यापन",
  adminText:
    "संस्थागत प्रस्तुतियों, स्वीकृत प्रवेश क्षमता और साक्ष्य-आधारित अनुपालन समीक्षा की निगरानी करें।",
  institutionText:
    "छात्र अभिलेख जमा करें, जाँच त्रुटियाँ सुधारें और नामांकन प्रबंधित करें।",
  studentText: "अपने शैक्षणिक अभिलेख देखें और साझा करने के लिए विवरण चुनें।",
  verifierText: "छात्र के साझा संदर्भ की सहमति और वैधता अवधि में जाँच करें।",
  administratorLogin: "एआईसीटीई प्रशासक लॉगिन",
  institutionLogin: "संस्थान लॉगिन",
  studentLogin: "छात्र लॉगिन",
  verifierLogin: "अधिकृत सत्यापनकर्ता",
  submit: "संस्थान द्वारा जमा",
  validate: "डेटा जाँच",
  review: "अनुपालन और समीक्षा",
  repository: "केंद्रीय अभिलेख",
  verify: "अधिकृत सत्यापन",
  capabilities: "जवाबदेह शैक्षणिक प्रशासन के लिए",
  notices: "महत्वपूर्ण जानकारी",
  noticeOne:
    "इस प्रदर्शन के सभी संस्थान, व्यक्ति और पहचान संख्याएँ काल्पनिक हैं।",
  noticeTwo: "प्रदर्शन मोड में आधिकारिक अपार पहचान सत्यापन उपलब्ध नहीं है।",
  noticeThree:
    "वैध डिजिटल हस्ताक्षर स्थानीय अभिलेख की अखंडता दर्शाता है, सरकारी पहचान सत्यापन नहीं।",
  signTitle: "अपने पोर्टल में साइन इन करें",
  signIntro:
    "कार्यक्षेत्र चुनें और अपने अधिकृत खाते का उपयोग करें। अनुमतियाँ सर्वर द्वारा जाँची जाती हैं।",
  role: "कार्यक्षेत्र / भूमिका",
  email: "ईमेल पता",
  password: "पासवर्ड",
  show: "पासवर्ड दिखाएँ",
  hide: "पासवर्ड छिपाएँ",
  signButton: "सुरक्षित साइन इन",
  signing: "साइन इन हो रहा है…",
  demo: "प्रदर्शन प्रवेश",
  demoText: "केवल काल्पनिक प्रदर्शन खातों का उपयोग करें। विकास पासवर्ड:",
  failure: "साइन इन नहीं हो सका",
  emailError: "मान्य ईमेल पता दर्ज करें।",
  passwordError: "पासवर्ड में कम से कम 8 अक्षर होने चाहिए।",
  centralRole: "एआईसीटीई केंद्रीय प्रशासक",
  regionRole: "क्षेत्रीय अधिकारी",
  institutionRole: "संस्थान प्रशासक",
  operatorRole: "संस्थान ऑपरेटर",
  studentRole: "छात्र",
  verifierRole: "अधिकृत सत्यापनकर्ता",
  auditorRole: "लेखा परीक्षक",
  verifyTitle: "शैक्षणिक प्रमाणपत्र सत्यापन",
  verifySubtitle:
    "संस्थान द्वारा जारी प्रदर्शन अभिलेख की अखंडता और अनुमत प्रकटीकरण की जाँच करें।",
  passed: "प्रमाणपत्र की जाँच सफल",
  denied: "सत्यापन अस्वीकृत",
  signature: "डिजिटल हस्ताक्षर मान्य",
  disclosed: "सहमति द्वारा अधिकृत विवरण",
  identityUnavailable:
    "आधिकारिक अपार पहचान सत्यापन: प्रदर्शन मोड में उपलब्ध नहीं",
  privacyProtected: "गोपनीयता सुरक्षित",
  privacyDenied:
    "हस्ताक्षर, सहमति, अवधि और निरस्तीकरण की सभी जाँच सफल होने पर ही छात्र विवरण दिखते हैं।",
  guideTitle: "सहायता और सेवा मार्गदर्शन",
  aboutTitle: "APAARSetu का परिचय",
  privacyTitle: "गोपनीयता और सहमति",
  accessTitle: "सुगम्यता जानकारी",
  guideBody:
    "मुखपृष्ठ से पोर्टल चुनें। संस्थान CSV/XLSX जमा करने से पहले पंक्ति-स्तर की त्रुटियाँ जाँचते हैं। प्रशासक साक्ष्य की समीक्षा करके कारण दर्ज करते हैं। छात्र चुने हुए विवरण साझा कर सकते हैं और अनुमति वापस ले सकते हैं। सत्यापनकर्ता को अधिकृत संदर्भ चाहिए।",
  aboutBody:
    "APAARSetu, SIH26263 के लिए स्मार्ट इंडिया हैकाथॉन 2026 का प्रोटोटाइप है। यह संस्थागत अभिलेख, नीति जाँच, मानवीय समीक्षा और सहमति-आधारित सत्यापन जोड़ता है। यह किसी सरकारी प्राधिकरण के स्वामित्व, होस्टिंग या समर्थन में नहीं है।",
  privacyBody:
    "सामान्य दृश्य में पहचान संख्या छिपाई जाती है। सहमति लिंक जिसके पास है वह अवधि समाप्ति या निरस्तीकरण तक उपयोग कर सकता है। प्राप्तकर्ता का नाम केवल लेबल है। लिंक सावधानी से साझा करें। आधिकारिक अपार और डिजीलॉकर उपलब्ध नहीं हैं।",
  accessBody:
    "मुख्य सामग्री का लिंक, कीबोर्ड नेविगेशन, स्पष्ट फोकस और अक्षर आकार नियंत्रण उपयोग करें। छोटे पर्दे और तालिका स्क्रॉल समर्थित हैं। सार्वजनिक, साइन इन, सहायता और सत्यापन पृष्ठ अंग्रेज़ी और हिन्दी में हैं। प्रशासनिक कार्यक्षेत्र अभी अंग्रेज़ी में हैं। WCAG 2.1 AA और GIGW 3.0 लक्ष्य हैं; औपचारिक प्रमाणन का दावा नहीं है।",
  footer: "APAARSetu · स्मार्ट इंडिया हैकाथॉन 2026 · SIH26263",
};
const Context = createContext<{
  language: string;
  setLanguage: (value: string) => void;
  size: string;
  setSize: (value: string) => void;
}>({
  language: "en",
  setLanguage: () => {},
  size: "normal",
  setSize: () => {},
});
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState("en");
  const [size, setSize] = useState("normal");
  useEffect(() => {
    setLanguage(localStorage.getItem("apaarsetu_language") ?? "en");
    setSize(localStorage.getItem("apaarsetu_text_size") ?? "normal");
  }, []);
  return (
    <Context.Provider
      value={{
        language,
        setLanguage: (v) => {
          setLanguage(v);
          localStorage.setItem("apaarsetu_language", v);
        },
        size,
        setSize: (v) => {
          setSize(v);
          localStorage.setItem("apaarsetu_text_size", v);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLocale() {
  const context = useContext(Context);
  const path = usePathname();
  const supported =
    ["/", "/login", "/help", "/about", "/privacy", "/accessibility"].includes(
      path,
    ) || path.startsWith("/verify/");
  const language = supported ? context.language : "en";
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.textSize = context.size;
  }, [language, context.size]);
  return {
    ...context,
    supported,
    language,
    t: (key: keyof typeof en) => (language === "hi" ? hi : en)[key],
  };
}
