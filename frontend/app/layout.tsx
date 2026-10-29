import type {Metadata} from "next";
import "./globals.css";
import {Providers} from "./providers";

export const metadata: Metadata = {
  title: "APAARSetu — Academic Compliance & Verification",
  description: "Synthetic demonstration platform for AICTE student data, enrolment compliance and consent-based academic verification.",
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}

