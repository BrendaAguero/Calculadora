import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function GestionPage() {
  return <AppShell><h1 className="text-3xl font-bold">Gestión</h1><p className="mt-2 text-sm text-neutral-500">Un espacio para organizar tu emprendimiento.</p><div className="mt-8 grid gap-3">
    <Link href="/materials" className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"><h2 className="font-semibold">Materiales</h2><p className="mt-1 text-sm text-neutral-500">Costos y precios con historial.</p></Link>
    <Link href="/formulas" className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"><h2 className="font-semibold">Fórmulas</h2><p className="mt-1 text-sm text-neutral-500">Recetas, ingredientes y versiones.</p></Link>
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"><h2 className="font-semibold">Productos</h2><p className="mt-1 text-sm text-neutral-500">Se incorporará en la Etapa 10.</p></div>
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"><h2 className="font-semibold">Historial</h2><p className="mt-1 text-sm text-neutral-500">Se incorporará en la Etapa 11.</p></div>
  </div></AppShell>;
}
