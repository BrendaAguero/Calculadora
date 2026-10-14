import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAFF_LOGIN_PATH, hasStaffSession } from "@/lib/staff";

// Las páginas de administración solo existen para administradoras: al resto les responde «no encontrada».
// Además piden haber entrado por el ingreso del equipo, y cada acción vuelve a comprobarlo en la base
// (las funciones admin_* verifican is_admin()).
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) notFound();
  if (!(await hasStaffSession(user.id))) redirect(`${STAFF_LOGIN_PATH}?next=/admin`);
  return { supabase, userId: user.id };
}

// Moderación: moderadoras y administradoras. Solo modera la comunidad (las funciones mod_* verifican is_moderator()).
export async function requireModerator(next = "/moderacion") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: isModerator }, { data: isAdmin }] = await Promise.all([supabase.rpc("is_moderator"), supabase.rpc("is_admin")]);
  if (!isModerator) notFound();
  if (!(await hasStaffSession(user.id))) redirect(`${STAFF_LOGIN_PATH}?next=${encodeURIComponent(next)}`);
  return { supabase, userId: user.id, isAdmin: Boolean(isAdmin) };
}

export const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value);
