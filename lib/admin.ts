import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Las páginas de administración solo existen para administradoras: al resto les responde «no encontrada».
// Además, cada acción vuelve a comprobarlo en la base (las funciones admin_* verifican is_admin()).
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) notFound();
  return { supabase, userId: user.id };
}

export const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value);
