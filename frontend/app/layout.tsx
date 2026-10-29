import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/noto-sans";
import "@fontsource-variable/noto-sans-devanagari";
import { Providers } from "./providers";

export const metadata: Metadata = {
  icons: { icon: "/brand-mark.svg" },
  title: "APAARSetu — Student Enrolment and Academic Verification System",
  description:
    "Synthetic demonstration platform for AICTE student data, enrolment compliance and consent-based academic verification.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
