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
  { value: 'plus', label: 'Solo con Personal Plus' },
  { value: 'users', label: 'Cuentas específicas (por email)' },
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
  // «users»: la base ya lo muestra solo a las cuentas elegidas.
  return true;
}

// Reemplaza {dias}, {descuento}, {vence}, {fin}, {calculos} en los textos de los avisos automáticos.
export function fillVars(text: string, vars: Record<string, unknown> | null | undefined) {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (vars && vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : match));
}

// Avisos automáticos: qué hace cada regla y qué datos usa.
export const AUTO_RULES: Record<string, { name: string; when: string; daysLabel?: string; discount?: boolean; vars: string }> = {
  free_discount: { name: 'Descuento a quien usa la versión gratis', when: 'Cuando alguien lleva cierta cantidad de días con la versión gratis, le aparece una vez con un descuento personal en la Edición Personal. El descuento se aplica solo al comprar con su email.', daysLabel: 'Días con la versión gratis', discount: true, vars: '{dias} {descuento} {vence}' },
  free_limit: { name: 'Llegó al límite de la versión gratis', when: 'Cuando alguien con la versión gratis llena los materiales o productos que puede guardar.', vars: '' },
  courtesy_ending: { name: 'Licencia de regalo por vencer', when: 'Unos días antes de que venza una licencia de regalo (de 1 o 2 meses). Puede incluir un descuento para comprarla.', daysLabel: 'Días antes del vencimiento', discount: true, vars: '{fin} {descuento} {vence}' },
  plus_ending: { name: 'Personal Plus por terminar', when: 'Unos días antes de que termine Personal Plus de alguien sin renovación automática.', daysLabel: 'Días antes del fin', vars: '{fin}' },
  pack_suggest: { name: 'Sugerir el Pack Ventas y Stock', when: 'A quien tiene la Edición Personal (sin pack) y ya guardó varios cálculos.', daysLabel: 'Cantidad de cálculos', vars: '{calculos}' },
  welcome_back: { name: 'Bienvenida de vuelta', when: 'Cuando alguien vuelve a la app después de muchos días sin entrar.', daysLabel: 'Días sin entrar', vars: '{dias}' },
  anniversary: { name: 'Aniversario', when: 'Cuando se cumple un tiempo desde que alguien creó su cuenta.', daysLabel: 'Días desde que creó la cuenta', vars: '' },
};

// Fecha y hora de Argentina (UTC−3, sin horario de verano) de un campo datetime-local → ISO.
export function fromLocalAR(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? new Date(`${value}:00-03:00`).toISOString() : null;
}
export function toLocalAR(iso: string | null) {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 16);
}
