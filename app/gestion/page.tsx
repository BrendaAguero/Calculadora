import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function GestionPage() {
  return <AppShell><h1 className="text-3xl font-bold">Gestión</h1><p className="mt-2 text-sm text-neutral-500">Un espacio para organizar tu emprendimiento.</p><div className="mt-8 grid gap-3"><Link href="/gestion/moldes" className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"><h2 className="font-semibold">Moldes</h2><p className="mt-1 text-sm text-neutral-500">Registrá fotos, capacidad, costo y usos de tus moldes.</p></Link><div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"><h2 className="font-semibold">Productos</h2><p className="mt-1 text-sm text-neutral-500">Se incorporará en la Etapa 10.</p></div><div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"><h2 className="font-semibold">Historial</h2><p className="mt-1 text-sm text-neutral-500">Se incorporará en la Etapa 11.</p></div></div></AppShell>;
}
