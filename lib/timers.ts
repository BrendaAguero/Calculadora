// Temporizadores de curado: etapas típicas por material (a unos 20-25 °C). Son referencias:
// cada marca indica sus tiempos y con frío todo tarda más, por eso se pueden cambiar antes de empezar.
export type Stage = { label: string; minutes: number };

export const CURE_PRESETS: Record<string, Stage[]> = {
  Yeso: [
    { label: 'Desmoldar', minutes: 45 },
    { label: 'Seco para pintar o sellar', minutes: 48 * 60 },
  ],
  Resina: [
    { label: 'La mezcla empieza a espesar (volcala antes)', minutes: 30 },
    { label: 'Desmoldar', minutes: 24 * 60 },
    { label: 'Curado completo', minutes: 7 * 24 * 60 },
  ],
  Jesmonite: [
    { label: 'Desmoldar', minutes: 60 },
    { label: 'Listo para lijar o sellar', minutes: 24 * 60 },
  ],
  Cemento: [
    { label: 'Desmoldar', minutes: 24 * 60 },
    { label: 'Dejar de humedecer (curado)', minutes: 7 * 24 * 60 },
    { label: 'Resistencia final', minutes: 28 * 24 * 60 },
  ],
};

// «45 min», «2 h 30 min», «7 días».
export function formatDuration(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes >= 48 * 60 && minutes % (24 * 60) === 0) return `${minutes / (24 * 60)} días`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : '', m || !h ? `${m} min` : ''].filter(Boolean).join(' ');
}

// Cuenta regresiva: «1:05:09», o «2 d 4 h» si falta mucho.
export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d} d ${h} h`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export const TIMERS_KEY = 'cure-timers';
export const FIRED_KEY = 'cure-timers-fired';
export type StoredTimer = { id: string; label: string; ends_at: string };
