import { createClient } from "@/lib/supabase/server";

export type BasePlanCode = "BASIC" | "ADVANCED";
export type Resource = "materials" | "products" | "formulas" | "molds";

export type AccessSnapshot = {
  accountStatus: "active" | "suspended" | "blocked";
  basePlan: BasePlanCode | null;
  baseLicenseActive: boolean;
  entrepreneurActive: boolean;
  activities: string[];
  modules: string[];
};

const FALLBACK_LIMITS: Record<BasePlanCode, Record<Resource, number>> = {
  BASIC: { materials: 30, products: 10, formulas: 5, molds: 5 },
  ADVANCED: { materials: 100, products: 50, formulas: 30, molds: 30 },
};

export async function getAccessSnapshot(): Promise<AccessSnapshot | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: licenses }, { data: subscriptions }, { data: activities }, { data: modules }] =
    await Promise.all([
      supabase.from("profiles").select("account_status").eq("id", user.id).maybeSingle(),
      supabase
        .from("licenses")
        .select("status, plans(code)")
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("subscriptions")
        .select("status, expires_at")
        .eq("user_id", user.id)
        .in("status", ["active", "suspended"]),
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

  const activeLicense = (licenses ?? []).find((license) => {
    const plan = Array.isArray(license.plans) ? license.plans[0] : license.plans;
    return plan?.code === "BASIC" || plan?.code === "ADVANCED";
  });
  const plan = activeLicense
    ? (Array.isArray(activeLicense.plans) ? activeLicense.plans[0] : activeLicense.plans)?.code
    : null;

  const entrepreneurActive = (subscriptions ?? []).some(
    (subscription) => subscription.status === "active" && new Date(subscription.expires_at) > new Date()
  );

  return {
    accountStatus: (profile?.account_status ?? "active") as AccessSnapshot["accountStatus"],
    basePlan: plan === "BASIC" || plan === "ADVANCED" ? plan : null,
    baseLicenseActive: Boolean(activeLicense),
    entrepreneurActive,
    activities: (activities ?? []).flatMap((item) => {
      const activity = Array.isArray(item.activities) ? item.activities[0] : item.activities;
      return activity?.code ? [activity.code] : [];
    }),
    modules: (modules ?? []).flatMap((item) => {
      const module = Array.isArray(item.modules) ? item.modules[0] : item.modules;
      return module?.code ? [module.code] : [];
    }),
  };
}

export function hasFeature(snapshot: AccessSnapshot, feature: string): boolean {
  if (snapshot.accountStatus !== "active" || !snapshot.baseLicenseActive) return false;
  if (snapshot.entrepreneurActive) return true;
  return snapshot.modules.includes(feature);
}

export function getResourceLimit(snapshot: AccessSnapshot, resource: Resource): number {
  if (snapshot.entrepreneurActive) return Number.POSITIVE_INFINITY;
  if (!snapshot.basePlan) return 0;
  return FALLBACK_LIMITS[snapshot.basePlan][resource];
}

export async function canCreateResource(resource: Resource, currentCount: number): Promise<boolean> {
  const snapshot = await getAccessSnapshot();
  if (!snapshot) return false;
  return currentCount < getResourceLimit(snapshot, resource);
}
