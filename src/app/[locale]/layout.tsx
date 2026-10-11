import { cookies, headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "@/app/globals.css";
import { AppRegistration } from "@/components/ui/InstallApp";
import { QuickUndo } from "@/components/ui/QuickUndo";
import { Toast } from "@/components/ui/Toast";
import { Confetti } from "@/components/ui/Confetti";

export const metadata = {
  title: "Cadéoly — Listes de cadeaux",
  icons: { icon: "/cadeoly-icon.svg", apple: "/icons/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Cadéoly",
    statusBarStyle: "default" as const,
  },
  description: "Share wishlists with your family members.",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;

  if (!routing.locales.includes(locale as "fr" | "en")) {
    notFound();
  }

  const messages = await getMessages();
  const preferences = await cookies();
  const choice =
    preferences.get("cadeoly-theme")?.value ??
    preferences.get("wishi-theme")?.value;
  const theme = choice === "light" || choice === "dark" ? choice : "system";
  const nativeAndroid = (await headers())
    .get("user-agent")
    ?.includes("CadeolyAndroid/");

  return (
    <html
      lang={locale}
      data-theme={theme}
      data-native={nativeAndroid ? "android" : undefined}
    >
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <NextIntlClientProvider messages={messages}>
          <AppRegistration />
          {children}
          <QuickUndo />
          <Toast />
          <Confetti />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
