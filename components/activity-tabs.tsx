import Link from "next/link";
import { Lock } from "lucide-react";

const TABS = [
  { href: "/calcular", code: "YESO", label: "Yeso" },
  { href: "/calcular/resina", code: "RESINA", label: "Resina" },
  { href: "/calcular/jesmonite", code: "JESMONITE", label: "Jesmonite" },
  { href: "/calcular/cemento", code: "CEMENTO_DECORATIVO", label: "Cemento" },
];

// Selector de actividad arriba de la calculadora. Las que no tiene se muestran con candado.
export function ActivityTabs({ current, available }: { current: string; available: string[] }) {
  return (
    <nav aria-label="Actividad" className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {TABS.map((tab) => {
        const active = tab.code === current;
        const locked = !available.includes(tab.code);
        return (
          <Link key={tab.code} href={tab.href} aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-orange-800 text-white dark:bg-orange-600" : "bg-white text-neutral-700 hover:bg-orange-50 dark:bg-neutral-900 dark:text-neutral-300"}`}>
            {tab.label}{locked && <Lock size={13} aria-label="(no incluida)" />}
          </Link>
        );
      })}
    </nav>
  );
}
