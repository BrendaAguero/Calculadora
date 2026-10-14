// Fechas para vender en Argentina: cuándo caen y cuándo conviene empezar a preparar.
// Funciones puras (con pruebas en tests/). Las fechas son días del calendario (sin hora).

export type SaleDate = { id: string; name: string; date: string; prepWeeks: number; approx?: boolean; ideas: string };
type Rule = Omit<SaleDate, 'date'> & { on: (year: number) => Date };

const ymd = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const fixed = (month: number, day: number) => (year: number) => new Date(Date.UTC(year, month - 1, day));

// n-ésimo día de la semana del mes (weekday: 0 = domingo). n = -1 → el último.
export function nthWeekday(year: number, month: number, weekday: number, n: number) {
  if (n < 0) {
    const last = new Date(Date.UTC(year, month, 0));
    return new Date(Date.UTC(year, month - 1, last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7)));
  }
  const first = new Date(Date.UTC(year, month - 1, 1));
  return new Date(Date.UTC(year, month - 1, 1 + ((weekday - first.getUTCDay() + 7) % 7) + (n - 1) * 7));
}

// Domingo de Pascua (cálculo de Meeus/Jones/Butcher).
export function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const RULES: Rule[] = [
  { id: 'reyes', name: 'Día de Reyes', on: fixed(1, 6), prepWeeks: 3, ideas: 'Adornos, cajitas y regalos chicos para chicos.' },
  { id: 'san-valentin', name: 'San Valentín', on: fixed(2, 14), prepWeeks: 4, ideas: 'Corazones, portavelas, bandejitas con iniciales.' },
  { id: 'mujer', name: 'Día de la Mujer', on: fixed(3, 8), prepWeeks: 3, ideas: 'Regalos empresariales, macetitas y velas.' },
  { id: 'pascuas', name: 'Pascuas', on: easter, prepWeeks: 4, ideas: 'Huevos y conejos decorativos, hueveras, cajitas.' },
  { id: 'hot-sale', name: 'Hot Sale', on: (y) => nthWeekday(y, 5, 1, 2), prepWeeks: 3, approx: true, ideas: 'Combos y descuentos en tu tienda online.' },
  { id: 'padre', name: 'Día del Padre', on: (y) => nthWeekday(y, 6, 0, 3), prepWeeks: 5, ideas: 'Portallaves, ceniceros, organizadores de escritorio, macetas.' },
  { id: 'amigo', name: 'Día del Amigo', on: fixed(7, 20), prepWeeks: 3, ideas: 'Regalitos de a varios, llaveros, mini macetas.' },
  { id: 'infancias', name: 'Día de las Infancias', on: (y) => nthWeekday(y, 8, 0, 3), prepWeeks: 5, ideas: 'Figuras para pintar, alcancías, kits de manualidades.' },
  { id: 'maestro', name: 'Día del Maestro', on: fixed(9, 11), prepWeeks: 4, ideas: 'Pedidos por grado: souvenirs con nombre, portalápices.' },
  { id: 'primavera', name: 'Primavera y Día del Estudiante', on: fixed(9, 21), prepWeeks: 3, ideas: 'Macetas, flores de yeso, colores claros.' },
  { id: 'madre', name: 'Día de la Madre', on: (y) => nthWeekday(y, 10, 0, 3), prepWeeks: 6, ideas: 'La fecha más fuerte: macetas, portavelas, bandejas, joyeros, combos.' },
  { id: 'cyber', name: 'CyberMonday', on: (y) => nthWeekday(y, 11, 1, 1), prepWeeks: 3, approx: true, ideas: 'Ofertas online: combos y envío gratis.' },
  { id: 'black-friday', name: 'Black Friday', on: (y) => { const d = nthWeekday(y, 11, 4, 4); return new Date(d.getTime() + 86400000); }, prepWeeks: 3, ideas: 'Descuentos en tu tienda online y redes.' },
  { id: 'fin-de-clases', name: 'Fin de clases y egresados', on: fixed(12, 10), prepWeeks: 6, approx: true, ideas: 'Souvenirs para docentes y egresados, pedidos por cantidad.' },
  { id: 'navidad', name: 'Navidad', on: fixed(12, 25), prepWeeks: 8, ideas: 'Pesebres, adornos para el árbol, velas, centros de mesa, regalos empresariales.' },
];

const DAY = 86400000;
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

// Próximas fechas desde «today» (AAAA-MM-DD), ordenadas, para los próximos 12 meses.
export function upcomingSaleDates(today: string): (SaleDate & { daysLeft: number; prepFrom: string; preparing: boolean })[] {
  const year = Number(today.slice(0, 4));
  return [year, year + 1]
    .flatMap((y) => RULES.map(({ on, ...rule }) => ({ ...rule, date: ymd(on(y)) })))
    .map((d) => {
      const daysLeft = daysBetween(today, d.date);
      const prepFrom = ymd(new Date(Date.parse(`${d.date}T00:00:00Z`) - d.prepWeeks * 7 * DAY));
      return { ...d, daysLeft, prepFrom, preparing: daysLeft >= 0 && daysLeft <= d.prepWeeks * 7 };
    })
    .filter((d) => d.daysLeft >= 0 && d.daysLeft < 366)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
