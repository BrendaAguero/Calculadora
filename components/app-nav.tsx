"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_ITEMS, NAV_GROUPS, NO_NAV_PATHS, isActive } from "@/lib/nav";

// Marco de la app: menú al costado en la computadora (como un programa) y barra abajo en el celular (como una app).
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (NO_NAV_PATHS.some((path) => pathname.startsWith(path))) return <>{children}</>;
  // «Más» está activo en las pantallas que no tienen botón propio en la barra de abajo.
  const inBottom = BOTTOM_ITEMS.some((item) => item.href !== "/mas" && isActive(pathname, item.href));

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 lg:flex" aria-label="Menú">
        <Link href="/" className="flex items-center gap-2 px-5 py-5 font-bold">
          {/* eslint-disable-next-line @next/next/no-img-element -- ícono chico y fijo */}
          <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
          <span>Calculadora<br /><span className="text-xs font-medium text-orange-700 dark:text-orange-400">Emprender</span></span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {NAV_GROUPS.map((group, i) => (
            <div key={group.title ?? i} className="mt-3 first:mt-0">
              {group.title && <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{group.title}</p>}
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition ${active ? "bg-orange-100 font-semibold text-orange-900 dark:bg-orange-950 dark:text-orange-100" : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"}`}>
                    <span aria-hidden="true" className="w-5 text-center">{item.icon}</span>{item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="pb-24 lg:pb-0 lg:pl-60">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 lg:hidden" aria-label="Navegación principal">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {BOTTOM_ITEMS.map((item) => {
            const active = item.href === "/mas" ? !inBottom : isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl text-xs transition ${active ? "bg-orange-100 font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-200" : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"}`}>
                <span className="text-lg leading-5" aria-hidden="true">{item.icon}</span>
                <span className="mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
