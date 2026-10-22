// Fin del precio de lanzamiento. En la base se guarda el momento exacto en que termina
// (la medianoche de Argentina del día siguiente al último); acá se muestra el último día.
export function launchLastDay(endIso: string | null | undefined): string | null {
  if (!endIso) return null;
  const end = new Date(endIso).getTime();
  if (Number.isNaN(end)) return null;
  return new Date(end - 60_000).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
}

// Último día en formato AAAA-MM-DD (para el campo de fecha del panel).
export function launchLastDayInput(endIso: string | null | undefined): string {
  if (!endIso) return '';
  const end = new Date(endIso).getTime();
  if (Number.isNaN(end)) return '';
  return new Date(end - 60_000).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}
