import Link from 'next/link';
import { createMold } from '../actions';

export default function NewMoldPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6 pb-24">
      <header>
        <Link href="/gestion/moldes" className="text-sm text-neutral-500">← Volver a moldes</Link>
        <h1 className="mt-3 text-2xl font-semibold">Nuevo molde</h1>
        <p className="mt-1 text-sm text-neutral-500">Por ahora lo registramos para la actividad Yeso.</p>
      </header>

      <form action={createMold} className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <label className="grid gap-1"><span className="text-sm font-medium">Nombre *</span><input name="name" required placeholder="Ej. Molde bandeja ovalada" className="rounded-xl border px-3 py-3" /></label>
        <label className="grid gap-1"><span className="text-sm font-medium">Foto (URL)</span><input name="photo_url" type="url" placeholder="https://..." className="rounded-xl border px-3 py-3" /></label>

        <div className="grid grid-cols-[1fr_130px] gap-3">
          <label className="grid gap-1"><span className="text-sm font-medium">Capacidad de agua *</span><input name="water_capacity" type="number" min="0.01" step="0.01" required placeholder="300" className="rounded-xl border px-3 py-3" /></label>
          <label className="grid gap-1"><span className="text-sm font-medium">Unidad</span><select name="water_unit" defaultValue="g" className="rounded-xl border px-3 py-3"><option value="g">g</option><option value="ml">ml</option><option value="kg">kg</option><option value="l">l</option></select></label>
        </div>

        <label className="grid gap-1"><span className="text-sm font-medium">Yeso por pieza (opcional)</span><input name="plaster_per_piece" type="number" min="0.01" step="0.01" placeholder="Si no lo indicás, para Yeso se toma la capacidad de agua." className="rounded-xl border px-3 py-3" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1"><span className="text-sm font-medium">Costo del molde *</span><input name="cost" type="number" min="0" step="0.01" required placeholder="5000" className="rounded-xl border px-3 py-3" /></label>
          <label className="grid gap-1"><span className="text-sm font-medium">Usos estimados</span><input name="estimated_uses" type="number" min="0" step="1" placeholder="30" className="rounded-xl border px-3 py-3" /></label>
        </div>
        <label className="grid gap-1"><span className="text-sm font-medium">Notas</span><textarea name="notes" rows={4} placeholder="Medidas, cuidados, proveedor, etc." className="rounded-xl border px-3 py-3" /></label>

        <button type="submit" className="rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white">Guardar molde</button>
      </form>
    </main>
  );
}
