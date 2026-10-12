import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { InstallApp } from "@/components/install-app";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAccessSnapshot } from "@/lib/access/permissions";
import { NAV_GROUPS, SIMPLE_GROUPS } from "@/lib/nav";
import { getSimpleMode } from "@/lib/simple-mode-server";
import { SimpleModeToggle } from "@/components/simple-mode-toggle";
import { ChevronRight, FileText, Undo2, CircleStop, Wrench } from "lucide-react";

const row = "flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800";
const box = "divide-y divide-neutral-100 overflow-hidden rounded-3xl bg-white dark:divide-neutral-800 dark:bg-neutral-900";

// Todo el menú en una sola pantalla, sin submenús.
export default async function MasPage() {
  const [snapshot, simple] = await Promise.all([getAccessSnapshot(), getSimpleMode()]);
  const essentials = SIMPLE_GROUPS.flatMap((g) => g.items).filter((item) => item.href !== "/" && item.href !== "/mas");
  const groups = NAV_GROUPS.map((group, i) => (
    <section key={group.title ?? i}>
      {group.title && <h2 className="mb-2 px-2 text-sm font-semibold text-neutral-500">{group.title}</h2>}
      <div className={box}>
        {group.items.map((item) => <Link key={item.href} href={item.href} className={row}><item.icon size={19} aria-hidden="true" className="text-orange-800 dark:text-orange-300" />{item.label}<ChevronRight size={16} aria-hidden="true" className="ml-auto text-neutral-400" /></Link>)}
      </div>
    </section>
  ));
  return (
    <AppShell>
      <h1 className="text-3xl font-bold">Más</h1>
      <div className="mt-6 space-y-5">
        <SimpleModeToggle initial={simple} />
        <InstallApp />
        {simple ? (
          <>
            <section>
              <h2 className="mb-2 px-2 text-sm font-semibold text-neutral-500">Lo de todos los días</h2>
              <div className={box}>
                {essentials.map((item) => <Link key={item.href} href={item.href} className={`${row} py-4 text-[17px]`}><item.icon size={22} aria-hidden="true" className="text-orange-800 dark:text-orange-300" />{item.label}<ChevronRight size={18} aria-hidden="true" className="ml-auto text-neutral-400" /></Link>)}
              </div>
            </section>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-3xl bg-white px-4 py-4 text-[17px] font-semibold dark:bg-neutral-900">
                Opciones avanzadas
                <ChevronRight size={18} aria-hidden="true" className="text-neutral-400 transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-5 space-y-5">{groups}</div>
            </details>
          </>
        ) : groups}
        <section>
          <h2 className="mb-2 px-2 text-sm font-semibold text-neutral-500">Otros</h2>
          <div className={box}>
            {snapshot?.isAdmin && <Link href="/admin" className={row}><Wrench size={19} aria-hidden="true" className="text-orange-800 dark:text-orange-300" />Administración</Link>}
            <Link href="/legal" className={row}><FileText size={19} aria-hidden="true" className="text-orange-800 dark:text-orange-300" />Términos, privacidad y compras</Link>
            <Link href="/arrepentimiento" className={row}><Undo2 size={19} aria-hidden="true" className="text-orange-800 dark:text-orange-300" />Botón de arrepentimiento</Link>
            <Link href="/baja" className={row}><CircleStop size={19} aria-hidden="true" className="text-orange-800 dark:text-orange-300" />Botón de baja</Link>
          </div>
        </section>
        <div className="rounded-3xl bg-white p-4 dark:bg-neutral-900"><ThemeToggle /></div>
      </div>
    </AppShell>
  );
}
