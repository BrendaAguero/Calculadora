import { getAccessSnapshot } from '@/lib/access/permissions';
import { forAudience, type Announcement } from '@/lib/announcements';
import { createClient } from '@/lib/supabase/server';
import { AnnouncementPopup } from './announcement-popup';

// Busca el aviso más nuevo que la persona todavía no cerró (y que es para ella). Se muestra una sola vez.
export async function Announcements() {
  const snapshot = await getAccessSnapshot();
  if (!snapshot) return null;
  const supabase = await createClient();
  const [{ data: list }, { data: reads }] = await Promise.all([
    supabase.from('announcements').select('id,kind,title,body,image,button_label,button_link,audience,starts_at')
      .eq('active', true).lte('starts_at', new Date().toISOString()).order('starts_at', { ascending: false }).limit(10),
    supabase.from('announcement_reads').select('announcement_id').order('read_at', { ascending: false }).limit(200),
  ]);
  const seen = new Set((reads ?? []).map((r) => r.announcement_id));
  const next = ((list ?? []) as Announcement[]).find((a) => !seen.has(a.id) && forAudience(a.audience, snapshot));
  return next ? <AnnouncementPopup announcement={next} /> : null;
}
