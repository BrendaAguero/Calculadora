// Períodos para filtrar ventas y el resumen. Las fechas se toman en hora de Argentina (UTC−3, sin horario de verano).
export const PERIODS = [
  { value: 'mes', label: 'Este mes' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'anio', label: 'Este año' },
  { value: 'todo', label: 'Todo' },
] as const;

const AR = '-03:00';
const pad = (n: number) => String(n).padStart(2, '0');
const at = (y: number, m: number, d: number) => new Date(`${y}-${pad(m)}-${pad(d)}T00:00:00${AR}`);

export type Period = { value: string; label: string; from: Date | null; to: Date | null };

export function resolvePeriod(params: { periodo?: string; desde?: string; hasta?: string }): Period {
  if (params.desde || params.hasta) {
    const from = params.desde ? new Date(`${params.desde}T00:00:00${AR}`) : null;
    const to = params.hasta ? new Date(new Date(`${params.hasta}T00:00:00${AR}`).getTime() + 86_400_000) : null;
    return { value: 'personalizado', label: `${params.desde ?? '…'} a ${params.hasta ?? '…'}`, from, to };
  }
  const now = new Date(Date.now() - 3 * 3_600_000); // "ahora" en hora argentina, leída con getUTC*
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  switch (params.periodo) {
    case 'mes-anterior': return { value: 'mes-anterior', label: 'Mes anterior', from: m === 1 ? at(y - 1, 12, 1) : at(y, m - 1, 1), to: at(y, m, 1) };
    case '30d': return { value: '30d', label: 'Últimos 30 días', from: new Date(Date.now() - 30 * 86_400_000), to: null };
    case 'anio': return { value: 'anio', label: 'Este año', from: at(y, 1, 1), to: null };
    case 'todo': return { value: 'todo', label: 'Todo', from: null, to: null };
    default: return { value: 'mes', label: 'Este mes', from: at(y, m, 1), to: null };
  }
}

// Día (AAAA-MM-DD) en hora argentina, para agrupar.
export const arDay = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
