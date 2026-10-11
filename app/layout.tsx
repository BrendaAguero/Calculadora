import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { LOCK_INIT_SCRIPT } from "@/lib/app-lock";
import { DeviceGuard } from "@/components/device-guard";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Calculadora Emprender",
  description: "Calculadora y gestión para emprendedores.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: el script de tema agrega la clase "dark" antes de que React hidrate.
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LOCK_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}<DeviceGuard /></body>
    </html>
  );
}
