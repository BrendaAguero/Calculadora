import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function FormulasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="p-6">Iniciá sesión para ver tus fórmulas.</main>;
  const { data: formulas } = await supabase.from("formulas").select("id,name,category,status,updated_at").eq("user_id", user.id).order("status").order("name");

  return <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-24">
    <header className="flex items-center justify-between gap-4"><div><p className="text-sm text-neutral-500">Gestión</p><h1 className="text-2xl font-semibold">Fórmulas</h1><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Guardá recetas, ingredientes y versiones sin perder el historial.</p></div><Link href="/formulas/new" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Nueva</Link></header>
    <section className="grid gap-3">{(formulas ?? []).map(formula => <Link key={formula.id} href={`/formulas/${formula.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"><div className="flex items-start justify-between gap-4"><div><h2 className="font-medium">{formula.name}</h2><p className="mt-1 text-sm text-neutral-500">{formula.category || "Sin categoría"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs ${formula.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-500"}`}>{formula.status === "active" ? "Activa" : "Archivada"}</span></div></Link>)}{!formulas?.length && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-neutral-500">Todavía no tenés fórmulas. Creá la primera.</div>}</section>
  </main>;
}
