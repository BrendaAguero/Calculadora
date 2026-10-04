import { createClient } from "@/lib/supabase/server";
import { createFormula } from "../actions";

export default async function NewFormulaPage() {
  const supabase = await createClient();
  const { data: activities } = await supabase.from("activities").select("id,name,code").eq("active", true).order("sort_order");
  return <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-6 pb-24"><h1 className="text-2xl font-semibold">Nueva fórmula</h1><p className="mt-1 text-sm text-neutral-500">La primera versión se crea junto con la fórmula.</p><form action={createFormula} className="mt-6 space-y-4 rounded-2xl border bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
    <label className="block text-sm font-medium">Nombre<input name="name" required className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Ej. Porta sahumerio" /></label>
    <label className="block text-sm font-medium">Actividad<select name="activity_id" required className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">Elegí una actividad</option>{(activities ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label className="block text-sm font-medium">Categoría<input name="category" className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Ej. Decoración" /></label>
    <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Rendimiento<input name="yield_quantity" type="number" min="0.01" step="0.01" defaultValue="1" className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="block text-sm font-medium">Agua (%)<input name="water_percentage" type="number" min="0" step="0.1" className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Opcional" /></label></div>
    <label className="block text-sm font-medium">Foto (URL)<input name="photo_url" type="url" className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="https://..." /></label>
    <label className="block text-sm font-medium">Notas<textarea name="notes" rows={3} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
    <button className="w-full rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white">Crear fórmula</button>
  </form></main>;
}
