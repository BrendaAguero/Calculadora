import Link from 'next/link';
import { createMaterial } from '../actions';

const units = ['g', 'kg', 'ml', 'l', 'unidad'];

export default async function NewMaterialPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  const returnTo = params.returnTo || '/materials';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <header>
        <Link href={returnTo} className="text-sm text-neutral-500">← Volver</Link>
        <h1 className="mt-4 text-2xl font-semibold">Nuevo material</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Podés usar esta pantalla también desde una futura calculadora para crear un material sin salir del flujo.</p>
      </header>

      <form action={createMaterial} className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <label className="grid gap-1 text-sm font-medium">Nombre<input name="name" required placeholder="Ej.: Yeso" className="rounded-xl border p-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">Unidad de referencia<select name="default_unit" defaultValue="g" className="rounded-xl border p-3 font-normal">{units.map(unit => <option key={unit}>{unit}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">Precio de compra<input name="purchase_price" inputMode="decimal" required placeholder="0" className="rounded-xl border p-3 font-normal" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-medium">Cantidad comprada<input name="purchase_quantity" inputMode="decimal" required placeholder="1" className="rounded-xl border p-3 font-normal" /></label>
          <label className="grid gap-1 text-sm font-medium">Unidad comprada<select name="purchase_unit" defaultValue="g" className="rounded-xl border p-3 font-normal">{units.map(unit => <option key={unit}>{unit}</option>)}</select></label>
        </div>
        <label className="grid gap-1 text-sm font-medium">Actividad (opcional)<input name="activity_id" placeholder="ID de actividad; vacío = material compartido" className="rounded-xl border p-3 font-normal" /></label>
        <p className="text-xs text-neutral-500">El precio queda registrado como historial. Si comprás nuevamente el mismo material, agregá un nuevo precio en su ficha.</p>
        <button className="rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white">Guardar material</button>
      </form>
    </main>
  );
}
