"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type ActionState = { error?: string; success?: boolean };

export async function requestCode(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  const termsAccepted = formData.get("terms_accepted") === "on";

  if (!email) {
    return { error: "Ingresá tu email." };
  }
  if (!termsAccepted) {
    return { error: "Tenés que aceptar los términos para continuar." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: {
        full_name: fullName || null,
        terms_accepted: "true",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function verifyCode(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const code = String(formData.get("code") || "").trim();

  if (!email || !code) {
    return { error: "Ingresá el código que te llegó por email." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });

  if (error) {
    return { error: "Código inválido o vencido." };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
