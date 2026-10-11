"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator } from "lucide-react";
import { BOTTOM_ITEMS, NAV_GROUPS, NO_NAV_PATHS, isActive } from "@/lib/nav";

// Marco de la app: menú verde oscuro al costado en la computadora (como un programa)
// y barra blanca abajo en el celular (como una app).
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (NO_NAV_PATHS.some((path) => pathname.startsWith(path))) return <>{children}</>;
  // «Más» está activo en las pantallas que no tienen botón propio en la barra de abajo.
  const inBottom = BOTTOM_ITEMS.some((item) => item.href !== "/mas" && isActive(pathname, item.href));

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-62 flex-col bg-neutral-900 text-neutral-300 dark:bg-neutral-950 dark:ring-1 dark:ring-neutral-800 lg:flex" aria-label="Menú">
        <Link href="/" className="flex items-center gap-3 px-6 pb-4 pt-6 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-resina text-resina-dark"><Calculator size={20} aria-hidden="true" /></span>
          <span className="font-display text-lg font-bold leading-tight">Calculadora<span className="block font-sans text-xs font-medium text-neutral-400">Emprender</span></span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pb-6 [scrollbar-width:none]">
          {NAV_GROUPS.map((group, i) => (
            <div key={group.title ?? i} className="mt-2">
              {group.title && <p className="px-3 pb-1 pt-2 text-xs text-neutral-400">{group.title}</p>}
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-[7px] text-sm transition-colors ${active ? "bg-white/10 font-semibold text-white" : "hover:bg-white/5 hover:text-white"}`}>
                    <Icon size={18} aria-hidden="true" className={active ? "text-resina" : ""} />{item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="pb-24 lg:pb-0 lg:pl-62">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 dark:border-neutral-800 dark:bg-neutral-950 lg:hidden" aria-label="Navegación principal">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {BOTTOM_ITEMS.map((item) => {
            const active = item.href === "/mas" ? !inBottom : isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] ${active ? "font-bold text-orange-800 dark:text-orange-300" : "text-neutral-500 dark:text-neutral-400"}`}>
                <Icon size={22} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
