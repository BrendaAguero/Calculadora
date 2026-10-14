import { getAccessSnapshot } from '@/lib/access/permissions';
import { fillVars, forAudience, type Announcement } from '@/lib/announcements';
import { createClient } from '@/lib/supabase/server';
import { AnnouncementPopup } from './announcement-popup';

type AutoNotice = { code: string; kind: string; title: string; body: string; button_label: string | null; button_link: string | null; vars: Record<string, unknown> };

// Primero el aviso más nuevo que la persona no cerró; si no hay, un aviso automático (la base decide si corresponde
// y lo anota para no repetirlo). Se muestra una sola vez.
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
  if (next) return <AnnouncementPopup announcement={next} />;

  const { data: auto, error } = await supabase.rpc('my_auto_notice');
  if (error) console.error('[avisos] automáticos', error.message);
  const notice = auto as AutoNotice | null;
  if (!notice) return null;
  return (
    <AnnouncementPopup announcement={{
      id: `auto-${notice.code}`, kind: notice.kind, title: fillVars(notice.title, notice.vars), body: fillVars(notice.body, notice.vars),
      image: null, button_label: notice.button_label, button_link: notice.button_link, audience: 'all', starts_at: new Date().toISOString(),
    }} />
  );
}
