import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { LOCK_INIT_SCRIPT } from "@/lib/app-lock";
import { DeviceGuard } from "@/components/device-guard";
import { AppFrame } from "@/components/app-nav";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
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
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: el script de tema agrega la clase "dark" antes de que React hidrate.
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LOCK_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-neutral-50 dark:bg-neutral-950"><AppFrame>{children}</AppFrame><DeviceGuard /><ServiceWorkerRegister /></body>
    </html>
  );
}
