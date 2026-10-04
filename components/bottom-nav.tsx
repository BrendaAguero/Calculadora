"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/", "Inicio", "⌂"],
  ["/calcular", "Calcular", "＋"],
  ["/mis-datos", "Mis datos", "▣"],
  ["/gestion", "Gestión", "▤"],
  ["/mas", "Más", "⋯"],
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95" aria-label="Navegación principal">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
        {items.map(([href, label, icon]) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`flex min-h-14 flex-col items-center justify-center rounded-xl text-xs transition ${active ? "bg-orange-100 font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-200" : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"}`} aria-current={active ? "page" : undefined}>
              <span className="text-lg leading-5" aria-hidden="true">{icon}</span>
              <span className="mt-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
