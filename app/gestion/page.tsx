import Link from "next/link";
import { AppShell } from "@/components/app-shell";

const card = "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900";
const hint = "mt-1 text-sm text-neutral-500 dark:text-neutral-400";

export default function GestionPage() {
  return <AppShell><h1 className="text-3xl font-bold">Gestión</h1><p className={`mt-2 ${hint.replace("mt-1 ", "")}`}>Un espacio para organizar tu emprendimiento.</p><div className="mt-8 grid gap-3">
    <Link href="/materials" className={card}><h2 className="font-semibold">Materiales</h2><p className={hint}>Costos y precios con historial.</p></Link>
    <Link href="/gestion/moldes" className={card}><h2 className="font-semibold">Moldes</h2><p className={hint}>Registrá fotos, capacidad, costo y usos de tus moldes.</p></Link>
    <Link href="/formulas" className={card}><h2 className="font-semibold">Fórmulas</h2><p className={hint}>Recetas, ingredientes y versiones.</p></Link>
    <Link href="/gestion/productos" className={card}><h2 className="font-semibold">Productos</h2><p className={hint}>Fórmulas, moldes, precios con historial y rentabilidad.</p></Link>
    <Link href="/historial" className={card}><h2 className="font-semibold">Historial</h2><p className={hint}>Tus cálculos guardados: detalle, duplicar y recalcular.</p></Link>
  </div></AppShell>;
}
