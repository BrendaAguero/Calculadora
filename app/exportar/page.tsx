import { Download } from 'lucide-react';
import { AppShell } from '@/components/app-shell';

const FILES = [
  ['ventas', 'Ventas', 'Cada venta con lo que cobraste, el costo y la ganancia.'],
  ['materiales', 'Materiales', 'Tus materiales con su precio actual.'],
  ['productos', 'Productos', 'Tus productos con su precio minorista y mayorista.'],
  ['stock', 'Stock', 'Lo que tenés hoy y cuánto vale.'],
  ['compras', 'Compras', 'Lo que compraste, a quién y cuánto pagaste.'],
  ['produccion', 'Producción', 'Lo que produjiste y cuánto costaron los materiales.'],
] as const;

// Bajar los datos de la cuenta en archivos que se abren con Excel o Google Sheets (copia de seguridad).
export default function ExportPage() {
  return (
    <AppShell>
      <h1 className="text-3xl">Bajar mis datos</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-300">Archivos que se abren con Excel o Google Sheets. Sirven como copia de seguridad o para hacer tus propias cuentas.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {FILES.map(([type, label, hint]) => (
          <a key={type} href={`/api/exportar?tipo=${type}`} download className="flex items-center gap-4 rounded-3xl bg-white p-5 hover:ring-2 hover:ring-orange-200 dark:bg-neutral-900 dark:hover:ring-orange-900">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"><Download size={22} aria-hidden="true" /></span>
            <span><span className="block text-lg font-bold">{label}</span><span className="block text-sm text-neutral-500 dark:text-neutral-400">{hint}</span></span>
          </a>
        ))}
      </div>
      <p className="mt-4 text-sm text-neutral-500">Solo vos podés bajar tus datos: el archivo se arma con tu sesión.</p>
    </AppShell>
  );
}
