// Sugerencias de códigos de descuento por fechas especiales en Argentina.
// Cálculos puros (sin base de datos) para poder probarlos. Las fechas comerciales (Hot Sale, CyberMonday)
// se estiman con su patrón habitual: conviene confirmarlas cada año.

export type DiscountScope = 'personal' | 'plus_annual' | 'plus_6' | 'extras';

export type DiscountSuggestion = {
  key: string;
  name: string;
  code: string;
  pct: number;
  appliesTo: DiscountScope[];
  start: string; // AAAA-MM-DD, primer día del código
  end: string; // AAAA-MM-DD, último día del código
  eventDay: string; // AAAA-MM-DD, el día de la fecha especial
  why: string;
  estimated?: boolean;
};

type Rule = {
  key: string;
  name: string;
  code: string;
  pct: number;
  appliesTo: DiscountScope[];
  day: (year: number) => Date; // día de la fecha
  before: number; // días antes en que empieza el código
  after: number; // días después en que termina
  why: string;
  estimated?: boolean;
};

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
const iso = (date: Date) => date.toISOString().slice(0, 10);

// n-ésimo día de la semana del mes (weekday: 0 = domingo … 6 = sábado).
export function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = utc(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return utc(year, month, 1 + offset + (n - 1) * 7);
}

const ALL: DiscountScope[] = ['personal', 'plus_annual', 'extras'];

const RULES: Rule[] = [
  { key: 'anio-nuevo', name: 'Año Nuevo', code: 'ANONUEVO', pct: 15, appliesTo: ALL, day: (y) => utc(y, 1, 1), before: 4, after: 7, why: 'Arranque de año: muchas emprendedoras se ordenan y se proponen calcular bien sus precios.' },
  { key: 'san-valentin', name: 'San Valentín', code: 'AMOR', pct: 10, appliesTo: ['personal', 'extras'], day: (y) => utc(y, 2, 14), before: 7, after: 0, why: 'Temporada de regalos hechos a mano: buen momento para tener los costos al día.' },
  { key: 'vuelta-rutina', name: 'Vuelta a la rutina', code: 'VUELTA', pct: 10, appliesTo: ALL, day: (y) => utc(y, 3, 1), before: 7, after: 7, why: 'Después del verano se retoman talleres y ventas.' },
  { key: 'dia-mujer', name: 'Día de la Mujer', code: 'MUJERES', pct: 15, appliesTo: ALL, day: (y) => utc(y, 3, 8), before: 3, after: 1, why: 'Fecha muy compartida en redes; tu público es mayormente de emprendedoras.' },
  { key: 'hot-sale', name: 'Hot Sale', code: 'HOTSALE', pct: 20, appliesTo: ALL, day: (y) => nthWeekday(y, 5, 1, 2), before: 0, after: 2, why: 'La gente espera descuentos y compara precios: conviene uno fuerte y corto.', estimated: true },
  { key: 'dia-padre', name: 'Día del Padre', code: 'PAPA', pct: 10, appliesTo: ['personal', 'extras'], day: (y) => nthWeekday(y, 6, 0, 3), before: 10, after: 0, why: 'Otra temporada de regalos artesanales.' },
  { key: 'dia-amigo', name: 'Día del Amigo', code: 'AMIGAS', pct: 10, appliesTo: ALL, day: (y) => utc(y, 7, 20), before: 5, after: 1, why: 'Ideal para «compartilo con una amiga emprendedora».' },
  { key: 'dia-emprendedor', name: 'Día Mundial del Emprendimiento', code: 'EMPRENDE', pct: 15, appliesTo: ALL, day: (y) => utc(y, 8, 21), before: 3, after: 2, why: 'La fecha que más se relaciona con la app.' },
  { key: 'primavera', name: 'Día de la Primavera', code: 'PRIMAVERA', pct: 10, appliesTo: ALL, day: (y) => utc(y, 9, 21), before: 4, after: 2, why: 'Muchas lanzan colecciones nuevas y necesitan costear productos nuevos.' },
  { key: 'dia-madre', name: 'Día de la Madre', code: 'MAMA', pct: 15, appliesTo: ['personal', 'extras'], day: (y) => nthWeekday(y, 10, 0, 3), before: 14, after: 0, why: 'Una de las fechas en que más venden las emprendedoras: les sirve calcular antes.' },
  { key: 'cybermonday', name: 'CyberMonday', code: 'CYBER', pct: 20, appliesTo: ALL, day: (y) => nthWeekday(y, 11, 1, 1), before: 0, after: 2, why: 'Evento de compras online: la gente busca descuentos ese día.', estimated: true },
  { key: 'black-friday', name: 'Black Friday', code: 'BLACK', pct: 20, appliesTo: ALL, day: (y) => addDays(nthWeekday(y, 11, 4, 4), 1), before: 0, after: 3, why: 'Muy conocido; sirve para el plan anual con un descuento fuerte.' },
  { key: 'navidad', name: 'Navidad y Fiestas', code: 'NAVIDAD', pct: 15, appliesTo: ALL, day: (y) => utc(y, 12, 25), before: 24, after: 0, why: 'La temporada más fuerte de ventas de regalos: conviene empezar a principios de diciembre.' },
];

// Fechas especiales que caen en los próximos `days` días (o cuyo código todavía está a tiempo de usarse).
export function upcomingSuggestions(from: Date, days = 120): DiscountSuggestion[] {
  const today = utc(from.getUTCFullYear(), from.getUTCMonth() + 1, from.getUTCDate());
  const limit = addDays(today, days);
  const out: DiscountSuggestion[] = [];
  for (const year of [today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
    for (const rule of RULES) {
      const day = rule.day(year);
      const end = addDays(day, rule.after);
      if (end < today || day > limit) continue;
      const start = addDays(day, -rule.before);
      out.push({
        key: `${rule.key}-${year}`,
        name: rule.name,
        code: `${rule.code}${String(year).slice(2)}`,
        pct: rule.pct,
        appliesTo: rule.appliesTo,
        start: iso(start < today ? today : start),
        end: iso(end),
        eventDay: iso(day),
        why: rule.why,
        estimated: rule.estimated,
      });
    }
  }
  return out.sort((a, b) => a.eventDay.localeCompare(b.eventDay));
}

export const SCOPE_LABELS: Record<DiscountScope, string> = {
  personal: 'Edición Personal',
  plus_annual: 'Plus anual',
  plus_6: 'Plus 6 meses',
  extras: 'Extras y actividades',
};
