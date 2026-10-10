import { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Opciones para los formularios: materiales y moldes activos de la usuaria.
export async function loadFormOptions(supabase: Supabase, userId: string) {
  const [materials, molds] = await Promise.all([
    supabase.from('materials').select('id,name,default_unit').eq('user_id', userId).eq('status', 'active').order('name'),
    supabase.from('molds').select('id,name').eq('user_id', userId).eq('status', 'active').order('name'),
  ]);
  return {
    materials: materials.data ?? [],
    molds: molds.data ?? [],
    error: materials.error?.message ?? molds.error?.message ?? null,
  };
}
