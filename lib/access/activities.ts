import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type OwnedActivity = { id: string; code: string; name: string; isPrimary: boolean };

// Actividades que la usuaria tiene (principal, secundaria o compradas después), la principal primero.
// Las compradas son permanentes; solo cuentan las que están activas y cuya actividad sigue disponible.
export async function getOwnedActivities(supabase: Supabase, userId: string): Promise<{ activities: OwnedActivity[]; error: string | null }> {
  const { data, error } = await supabase
    .from("user_activities")
    .select("is_primary, activities(id, code, name, active, sort_order)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) return { activities: [], error: error.message };

  const activities = (data ?? [])
    .flatMap((row) => {
      const activity = Array.isArray(row.activities) ? row.activities[0] : row.activities;
      return activity?.active ? [{ id: activity.id, code: activity.code, name: activity.name, isPrimary: Boolean(row.is_primary), sortOrder: activity.sort_order ?? 0 }] : [];
    })
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)
    .map(({ id, code, name, isPrimary }) => ({ id, code, name, isPrimary }));

  return { activities, error: null };
}

export async function ownsActivity(supabase: Supabase, userId: string, activityId: string) {
  const { activities } = await getOwnedActivities(supabase, userId);
  return activities.some((activity) => activity.id === activityId);
}
