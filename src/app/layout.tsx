import type { Metadata } from "next";
import { cookies } from "next/headers";

import { LanguageProvider } from "@/components/i18n/language-provider";
import { LOCALE_COOKIE_NAME, normalizeLocale } from "@/lib/i18n";

import "./globals.css";

export const metadata: Metadata = {
  title: "Tech Competition Scoring Platform",
  description: "Internal judging and administration platform for technology competitions.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <html lang={locale === "zh" ? "zh-Hant" : "en"} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
