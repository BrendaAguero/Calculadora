'use server';

import { createClient } from '@/lib/supabase/server';

// Marca el aviso como visto por esta cuenta (la base solo deja marcar los propios).
export async function markAnnouncementRead(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('announcement_reads').insert({ announcement_id: id, user_id: user.id });
  if (error && error.code !== '23505') console.error('[avisos] no se pudo marcar como visto', error.message);
}
