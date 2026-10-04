"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ActionState = { error?: string; success?: boolean };

export async function requestCode(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  const termsAccepted = formData.get("terms_accepted") === "on";

  if (!email) return { error: "Ingresá tu email." };
  if (!termsAccepted) return { error: "Tenés que aceptar los términos para continuar." };

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  if (!host) return { error: "No se pudo determinar la dirección de la aplicación." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${protocol}://${host}/auth/callback`,
      data: { full_name: fullName || null, terms_accepted: "true" },
    },
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function signInWithPassword(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Ingresá tu email y contraseña." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email o contraseña incorrectos." };
  redirect("/");
}

export async function setPassword(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("password_confirmation") || "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirmation) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({
    password,
    data: { ...user.user_metadata, password_set: true },
  });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
