import Link from "next/link";
import { AppShell } from "@/components/app-shell";

const card = "rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900";
const hint = "mt-1 text-sm text-neutral-500 dark:text-neutral-400";

export default function MisDatosPage() {
  return <AppShell><h1 className="text-3xl font-bold">Mis datos</h1><p className="mt-2 text-sm text-neutral-500">Lo que usás para calcular: materiales, moldes y fórmulas.</p><div className="mt-8 grid gap-3">
    <Link href="/materials" className={card}><h2 className="font-semibold">Materiales</h2><p className={hint}>Costos y precios con historial.</p></Link>
    <Link href="/gestion/moldes" className={card}><h2 className="font-semibold">Moldes</h2><p className={hint}>Fotos, capacidad, costo y usos.</p></Link>
    <Link href="/formulas" className={card}><h2 className="font-semibold">Fórmulas</h2><p className={hint}>Recetas, ingredientes y versiones.</p></Link>
  </div></AppShell>;
}
