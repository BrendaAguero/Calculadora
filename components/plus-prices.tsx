const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

// Ahorro de pagar un año de Personal Plus de una vez frente a 12 meses sueltos.
export function annualSavings(monthly: number, annual: number | null) {
  if (!annual || monthly <= 0) return { savings: 0, freeMonths: 0 };
  const savings = Math.max(monthly * 12 - annual, 0);
  return { savings, freeMonths: Math.floor(savings / monthly) };
}

export function SavingsBadge({ savings, freeMonths }: { savings: number; freeMonths: number }) {
  if (savings <= 0) return null;
  return (
    <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      Ahorrás {money(savings)}{freeMonths > 0 ? ` · ${freeMonths === 1 ? '1 mes gratis' : `${freeMonths} meses gratis`}` : ''}
    </span>
  );
}

// Las dos formas de pagar Personal Plus, una al lado de la otra.
export function PlusPrices({ monthly, annual }: { monthly: number; annual: number | null }) {
  const { savings, freeMonths } = annualSavings(monthly, annual);
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <div className="rounded-2xl border border-neutral-200 p-3 dark:border-neutral-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Por mes</p>
        <p className="text-2xl font-bold">{money(monthly)}</p>
        <p className="text-xs text-neutral-500">Cancelás cuando quieras</p>
      </div>
      {annual ? (
        <div className="rounded-2xl border-2 border-emerald-600 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Por año</p>
          <p className="text-2xl font-bold">{money(annual)}</p>
          <p className="text-xs text-neutral-500">{money(Math.round(annual / 12))} por mes</p>
          <div className="mt-1"><SavingsBadge savings={savings} freeMonths={freeMonths} /></div>
        </div>
      ) : null}
    </div>
  );
}
