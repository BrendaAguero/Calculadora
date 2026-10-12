import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Geist_Mono } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { LOCK_INIT_SCRIPT } from "@/lib/app-lock";
import { DeviceGuard } from "@/components/device-guard";
import { AppFrame } from "@/components/app-nav";
import { getSimpleMode } from "@/lib/simple-mode-server";
import { getHiddenSections } from "@/lib/menu-server";
import { UsageTracker } from "@/components/usage-tracker";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { OfflineSync } from "@/components/offline-sync";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Calculadora Emprender",
  description: "Calculadora y gestión para emprendedores.",
  applicationName: "Calculadora Emprender",
  appleWebApp: { capable: true, title: "Calculadora", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E9ECEA" },
    { media: "(prefers-color-scheme: dark)", color: "#121A19" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [simple, hidden] = await Promise.all([getSimpleMode(), getHiddenSections()]);
  return (
    // suppressHydrationWarning: el script de tema agrega la clase "dark" antes de que React hidrate.
    <html lang="es" className={`${figtree.variable} ${bricolage.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LOCK_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full"><AppFrame simple={simple} hidden={hidden}>{children}</AppFrame><UsageTracker simple={simple} /><DeviceGuard /><ServiceWorkerRegister /><OfflineSync /></body>
    </html>
  );
}
