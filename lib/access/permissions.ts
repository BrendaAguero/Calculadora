import { createClient } from "@/lib/supabase/server";

export type BasePlanCode = "BASIC" | "ADVANCED";
export type Resource = "materials" | "products" | "formulas" | "molds";

export type AccessSnapshot = {
  accountStatus: "active" | "suspended" | "blocked";
  isAdmin: boolean;
  // Cuenta de prueba: sin límites ni restricciones de plan (no es administradora).
  isTester: boolean;
  basePlan: BasePlanCode | null;
  baseLicenseActive: boolean;
  // Versión gratis: sin licencia (y sin ser administradora ni cuenta de prueba). Tiene límites chicos y banner.
  isFree: boolean;
  entrepreneurActive: boolean;
  entrepreneurExpiresAt: string | null;
  activities: string[];
  modules: string[];
  limits: Partial<Record<Resource, number>>;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Respaldo por si la tabla plan_limits no responde (mismos valores que la base).
const FALLBACK_LIMITS: Record<BasePlanCode | "FREE", Record<Resource, number>> = {
  FREE: { materials: 5, products: 2, formulas: 1, molds: 1 },
  BASIC: { materials: 30, products: 10, formulas: 5, molds: 5 },
  ADVANCED: { materials: 100, products: 50, formulas: 30, molds: 30 },
};

export const RESOURCE_LABELS: Record<Resource, string> = {
  materials: "materiales",
  products: "productos",
  formulas: "fórmulas",
  molds: "moldes",
};

const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value);

export async function getAccessSnapshot(): Promise<AccessSnapshot | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: licenses }, { data: subscriptions }, { data: activities }, { data: modules }] =
    await Promise.all([
      supabase.from("profiles").select("account_status, role, is_tester").eq("id", user.id).maybeSingle(),
      supabase
        .from("licenses")
        .select("status, plan_id, plans(code)")
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
    ]);

  // Si hubiera más de una licencia base, vale la de mayor nivel.
  const baseLicenses = (licenses ?? []).filter((license) => ["BASIC", "ADVANCED"].includes(one(license.plans)?.code ?? ""));
  const activeLicense = baseLicenses.find((license) => one(license.plans)?.code === "ADVANCED") ?? baseLicenses[0];
  const plan = one(activeLicense?.plans)?.code;

  // Emprendedor vale mientras no venza; al vencer, la persona vuelve sola a su plan base.
  const now = new Date();
  const entrepreneurExpiresAt =
    (subscriptions ?? [])
      .map((subscription) => subscription.expires_at as string)
      .filter((expiresAt) => new Date(expiresAt) > now)
      .sort()
      .at(-1) ?? null;

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
    isTester,
    basePlan: plan === "BASIC" || plan === "ADVANCED" ? plan : null,
    baseLicenseActive: Boolean(activeLicense),
    isFree: !activeLicense && !isAdmin && !isTester,
    entrepreneurActive: Boolean(activeLicense) && entrepreneurExpiresAt !== null,
    entrepreneurExpiresAt,
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
}

// Funciones de gestión incluidas en la Edición Personal (licencia base).
const PERSONAL_FEATURES = new Set(["VENTAS", "PRODUCCION", "ESTADISTICAS", "STOCK_BASICO", "PROVEEDORES_BASICO"]);

export function hasFeature(snapshot: AccessSnapshot, feature: string): boolean {
  if (snapshot.isAdmin || snapshot.isTester) return true;
  if (snapshot.accountStatus !== "active" || !snapshot.baseLicenseActive) return false;
  // Mensualidad Plus (la suscripción mensual) desbloquea todos los módulos.
  if (snapshot.entrepreneurActive) return true;
  return PERSONAL_FEATURES.has(feature) || snapshot.modules.includes(feature);
}

// Publicidad: la ven todas las cuentas salvo las que tienen Mensualidad Plus (y administración / prueba).
export function showsAds(snapshot: AccessSnapshot) {
  return !snapshot.isAdmin && !snapshot.isTester && !snapshot.entrepreneurActive;
}

export function getResourceLimit(snapshot: AccessSnapshot, resource: Resource): number {
  if (snapshot.isAdmin || snapshot.isTester) return Number.POSITIVE_INFINITY;
  if (snapshot.accountStatus !== "active") return 0;
  if (snapshot.entrepreneurActive) return Number.POSITIVE_INFINITY;
  return snapshot.limits[resource] ?? FALLBACK_LIMITS[snapshot.basePlan ?? "FREE"][resource];
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
// Al vencer Emprendedor no se borra nada: solo se frenan las altas nuevas que superen el límite.
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
  if (!snapshot.basePlan) return `Llegaste al límite: ${limit} ${label}. Con la Edición Personal podés guardar muchos más.`;
  return `Llegaste al límite de tu Edición Personal: ${limit} ${label} activos. Podés archivar alguno que no uses o sumar Mensualidad Plus para tener altas sin límite.`;
}

export async function canCreateResource(resource: Resource, currentCount: number): Promise<boolean> {
  const snapshot = await getAccessSnapshot();
  if (!snapshot) return false;
  return currentCount < getResourceLimit(snapshot, resource);
}
