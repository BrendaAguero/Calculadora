"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type ActionState = { error?: string; success?: boolean };

// Use the stable Vercel preview alias for the Etapa 3 auth flow.
// This avoids generating auth links with localhost or a short-lived deployment hostname.
const AUTH_CALLBACK_ORIGIN = "https://calculadora-emprender-git-etapa-3-auth-brendaagueros-projects.vercel.app";

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
      emailRedirectTo: `${AUTH_CALLBACK_ORIGIN}/auth/callback`,
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
