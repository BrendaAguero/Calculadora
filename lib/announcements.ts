import type { AccessSnapshot } from '@/lib/access/permissions';

// Avisos emergentes: tipos, a quién se muestran y cuál toca mostrar.
export const KINDS = [
  { value: 'novedad', label: 'Novedad' },
  { value: 'cambio', label: 'Cambio' },
  { value: 'promocion', label: 'Promoción' },
  { value: 'aviso', label: 'Aviso importante' },
] as const;
export const AUDIENCES = [
  { value: 'all', label: 'Todas las cuentas' },
  { value: 'free', label: 'Solo la versión gratis' },
  { value: 'licensed', label: 'Solo con Edición Personal' },
  { value: 'plus', label: 'Solo con Mensualidad Plus' },
] as const;
export const kindLabel = (value: string) => KINDS.find((k) => k.value === value)?.label ?? 'Novedad';
export const audienceLabel = (value: string) => AUDIENCES.find((a) => a.value === value)?.label ?? 'Todas las cuentas';

export type Announcement = {
  id: string; kind: string; title: string; body: string; image: string | null;
  button_label: string | null; button_link: string | null; audience: string; starts_at: string;
};

export function forAudience(audience: string, snapshot: Pick<AccessSnapshot, 'isFree' | 'entrepreneurActive'> | null) {
  if (!snapshot) return false;
  if (audience === 'free') return snapshot.isFree;
  if (audience === 'licensed') return !snapshot.isFree;
  if (audience === 'plus') return snapshot.entrepreneurActive;
  return true;
}

// Fecha y hora de Argentina (UTC−3, sin horario de verano) de un campo datetime-local → ISO.
export function fromLocalAR(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? new Date(`${value}:00-03:00`).toISOString() : null;
}
export function toLocalAR(iso: string | null) {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 16);
}
