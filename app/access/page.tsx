import { redirect } from "next/navigation";
import { getAccessSnapshot, getResourceLimit } from "@/lib/access/permissions";

const labels: Record<string, string> = {
  YESO: "Yeso",
  RESINA: "Resina",
  JESMONITE: "Jesmonite",
  CEMENTO_DECORATIVO: "Cemento decorativo",
  CALCULO_INVERSO: "Cálculo inverso",
  ESCALADO_AVANZADO: "Escalado avanzado",
  MOLDES_AVANZADOS: "Moldes avanzados",
  STOCK_BASICO: "Stock básico",
  PROVEEDORES_BASICO: "Proveedores básico",
};

export default async function AccessPage() {
  const snapshot = await getAccessSnapshot();
  if (!snapshot) redirect("/login");

  const planLabel = snapshot.basePlan === "ADVANCED" ? "Avanzado" : snapshot.basePlan === "BASIC" ? "Básico" : "Sin licencia";
  const entrepreneurLabel = snapshot.entrepreneurActive ? "Activo" : "No activo";

  return (
    <main className="min-h-screen bg-neutral-50 px-5 py-8 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <a href="/" className="text-sm underline">← Volver</a>
          <h1 className="mt-3 text-3xl font-semibold">Licencias y acceso</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Los permisos se comprueban en el servidor. Tener una pantalla o botón visible no otorga acceso por sí mismo.
          </p>
        </div>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="font-semibold">Tu plan</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-neutral-500">Licencia base</span><p className="font-medium">{planLabel}</p></div>
            <div><span className="text-neutral-500">Emprendedor</span><p className="font-medium">{entrepreneurLabel}</p></div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="font-semibold">Actividades</h2>
          {snapshot.activities.length ? (
            <ul className="mt-3 space-y-2 text-sm">{snapshot.activities.map((code) => <li key={code}>✓ {labels[code] ?? code}</li>)}</ul>
          ) : <p className="mt-3 text-sm text-neutral-500">Todavía no hay actividades adquiridas.</p>}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="font-semibold">Módulos</h2>
          {snapshot.modules.length ? (
            <ul className="mt-3 space-y-2 text-sm">{snapshot.modules.map((code) => <li key={code}>✓ {labels[code] ?? code}</li>)}</ul>
          ) : <p className="mt-3 text-sm text-neutral-500">No hay módulos permanentes adquiridos.</p>}
          {snapshot.entrepreneurActive && <p className="mt-3 text-sm text-violet-700 dark:text-violet-300">Emprendedor habilita temporalmente los módulos funcionales.</p>}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="font-semibold">Límites del plan</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {(["materials", "products", "formulas", "molds"] as const).map((resource) => {
              const limit = getResourceLimit(snapshot, resource);
              return <div key={resource}><span className="text-neutral-500">{resource}</span><p className="font-medium">{Number.isFinite(limit) ? limit : "Ilimitado durante Emprendedor"}</p></div>;
            })}
          </div>
          <p className="mt-3 text-xs text-neutral-500">Cálculos e historial no tienen límite.</p>
        </section>
      </div>
    </main>
  );
}
