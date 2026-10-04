"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ActionState = { error?: string; success?: boolean };

async function getRedirectUrl() {
  const headerStore = await headers();
  let origin: string;

  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    origin = `https://${process.env.VERCEL_URL}`;
  } else {
    const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
    if (configuredUrl && !configuredUrl.includes("localhost")) {
      origin = configuredUrl;
    } else {
      const forwardedProto = headerStore.get("x-forwarded-proto");
      const forwardedHost = headerStore.get("x-forwarded-host") || headerStore.get("host");
      if (forwardedHost && !forwardedHost.includes("localhost")) {
        origin = `${forwardedProto || "https"}://${forwardedHost}`;
      } else {
        origin = process.env.NODE_ENV === "development"
          ? "http://localhost:3000"
          : "https://calculadora-emprender.vercel.app";
      }
    }
  }

  return `${origin}/auth/callback`;
}

export async function requestCode(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  const termsAccepted = formData.get("terms_accepted") === "on";

  if (!email) return { error: "Ingresá tu email." };
  if (!termsAccepted) return { error: "Tenés que aceptar los términos para continuar." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: await getRedirectUrl(),
      data: { full_name: fullName || null, terms_accepted: "true" },
    },
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
