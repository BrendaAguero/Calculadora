import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { RESOURCE_LABELS, getResourceLimit, hasFeature, type AccessSnapshot, type Resource } from "./rules";

export { FALLBACK_LIMITS, PACK_CODE, RESOURCE_LABELS, getResourceLimit, hasFeature, showsAds } from "./rules";
export type { AccessSnapshot, BasePlanCode, Resource } from "./rules";


type Supabase = Awaited<ReturnType<typeof createClient>>;



const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value);

// Una sola consulta por pedido aunque la llamen el menú, la página y las acciones.
export const getAccessSnapshot = cache(async (): Promise<AccessSnapshot | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: licenses }, { data: subscriptions }, { data: activities }, { data: modules }, { data: trial }] =
    await Promise.all([
      supabase.from("profiles").select("account_status, role, is_tester").eq("id", user.id).maybeSingle(),
      supabase
        .from("licenses")
        .select("status, plan_id, expires_at, plans(code)")
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("subscriptions")
        .select("status, expires_at")
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("user_activities")
        .select("status, activities(code)")
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("user_modules")
        .select("status, modules(code)")
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase.from("plus_trials").select("expires_at").eq("user_id", user.id).maybeSingle(),
    ]);

  // Si hubiera más de una licencia base, vale la de mayor nivel.
  // Las de cortesía con fecha dejan de contar apenas vencen (la base las marca como vencidas cada hora).
  const nowMs = Date.now();
  const baseLicenses = (licenses ?? []).filter((license) => ["BASIC", "ADVANCED"].includes(one(license.plans)?.code ?? "")
    && (!license.expires_at || new Date(license.expires_at as string).getTime() > nowMs));
  const activeLicense = baseLicenses.find((license) => one(license.plans)?.code === "ADVANCED") ?? baseLicenses[0];
  const plan = one(activeLicense?.plans)?.code;

  // Personal Plus vale mientras no venza. Es otra forma de pagar: no hace falta la Edición Personal.
  // Al vencer, la persona vuelve sola a lo que tenga (Edición Personal o versión gratis).
  const now = new Date();
  const paidPlusExpiresAt =
    (subscriptions ?? [])
      .map((subscription) => subscription.expires_at as string)
      .filter((expiresAt) => new Date(expiresAt) > now)
      .sort()
      .at(-1) ?? null;
  // La prueba gratis de 14 días da lo mismo que Personal Plus mientras dura.
  const trialExpiresAt = trial?.expires_at && new Date(trial.expires_at as string) > now ? (trial.expires_at as string) : null;
  const entrepreneurExpiresAt = [paidPlusExpiresAt, trialExpiresAt].filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;

  // Sin licencia rigen los límites del plan gratis (FREE).
  const limits: AccessSnapshot["limits"] = {};
  {
    const { data: rows } = activeLicense
      ? await supabase.from("plan_limits").select("resource, limit_value, unlimited").eq("plan_id", activeLicense.plan_id)
      : await supabase.from("plan_limits").select("resource, limit_value, unlimited, plans!inner(code)").eq("plans.code", "FREE");
    for (const row of rows ?? []) {
      if (row.resource in RESOURCE_LABELS) {
        limits[row.resource as Resource] = row.unlimited ? Number.POSITIVE_INFINITY : Number(row.limit_value);
      }
    }
  }

  const isAdmin = profile?.role === "admin" && profile?.account_status === "active";
  const isTester = Boolean(profile?.is_tester) && profile?.account_status === "active";
  return {
    accountStatus: (profile?.account_status ?? "active") as AccessSnapshot["accountStatus"],
    isAdmin,
    isModerator: isAdmin || (profile?.role === "moderator" && profile?.account_status === "active"),
    isTester,
    basePlan: plan === "BASIC" || plan === "ADVANCED" ? plan : null,
    baseLicenseActive: Boolean(activeLicense),
    licenseExpiresAt: (activeLicense?.expires_at as string | null | undefined) ?? null,
    isFree: !activeLicense && entrepreneurExpiresAt === null && !isAdmin && !isTester,
    entrepreneurActive: entrepreneurExpiresAt !== null,
    entrepreneurExpiresAt,
    plusTrialEndsAt: paidPlusExpiresAt ? null : trialExpiresAt,
    activities: (activities ?? []).flatMap((item) => {
      const activity = one(item.activities);
      return activity?.code ? [activity.code] : [];
    }),
    modules: (modules ?? []).flatMap((item) => {
      const moduleRow = one(item.modules);
      return moduleRow?.code ? [moduleRow.code] : [];
    }),
    limits,
  };
});


// ¿Tiene el Pack Ventas y Stock (o Plus, administración, cuenta de prueba)? Sin sesión se toma como sí, para no tocar el menú.
export async function hasPackAccess() {
  const snapshot = await getAccessSnapshot();
  return !snapshot || hasFeature(snapshot, "VENTAS");
}




// Cuántos registros en uso tiene la persona (los archivados no cuentan para el límite).
export async function countActive(supabase: Supabase, userId: string, resource: Resource) {
  const { count, error } = await supabase
    .from(resource)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "archived");
  return { count: count ?? 0, error: error?.message ?? null };
}

// Devuelve un mensaje si la persona no puede sumar otro registro activo; null si puede.
// Al vencer Personal Plus no se borra nada: solo se frenan las altas nuevas que superen el límite.
export async function createLimitError(supabase: Supabase, userId: string, resource: Resource): Promise<string | null> {
  const snapshot = await getAccessSnapshot();
  if (!snapshot) return "Iniciá sesión de nuevo.";
  const limit = getResourceLimit(snapshot, resource);
  if (!Number.isFinite(limit)) return null;

  const label = RESOURCE_LABELS[resource];
  if (snapshot.accountStatus !== "active") return "Tu cuenta no está activa.";

  const { count, error } = await countActive(supabase, userId, resource);
  if (error) return `No se pudo comprobar el límite de tu plan: ${error}`;
  if (count < limit) return null;
  if (!snapshot.basePlan) return `Llegaste al límite: ${limit} ${label}. Con la Edición Personal (pago único) o Personal Plus podés guardar muchos más.`;
  return `Llegaste al límite de tu Edición Personal: ${limit} ${label} activos. Podés archivar alguno que no uses.`;
}

export async function canCreateResource(resource: Resource, currentCount: number): Promise<boolean> {
  const snapshot = await getAccessSnapshot();
  if (!snapshot) return false;
  return currentCount < getResourceLimit(snapshot, resource);
}
