import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { InstallApp } from "@/components/install-app";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAccessSnapshot } from "@/lib/access/permissions";
import { NAV_GROUPS } from "@/lib/nav";

const row = "flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800";
const box = "divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900";

// Todo el menú en una sola pantalla, sin submenús.
export default async function MasPage() {
  const snapshot = await getAccessSnapshot();
  return (
    <AppShell>
      <h1 className="text-3xl font-bold">Más</h1>
      <div className="mt-6 space-y-5">
        <InstallApp />
        {NAV_GROUPS.map((group, i) => (
          <section key={group.title ?? i}>
            {group.title && <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{group.title}</h2>}
            <div className={box}>
              {group.items.map((item) => <Link key={item.href} href={item.href} className={row}><span aria-hidden="true" className="w-5 text-center">{item.icon}</span>{item.label}</Link>)}
            </div>
          </section>
        ))}
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Otros</h2>
          <div className={box}>
            {snapshot?.isAdmin && <Link href="/admin" className={row}><span aria-hidden="true" className="w-5 text-center">🛠️</span>Administración</Link>}
            <Link href="/legal" className={row}><span aria-hidden="true" className="w-5 text-center">📄</span>Términos, privacidad y compras</Link>
            <Link href="/arrepentimiento" className={row}><span aria-hidden="true" className="w-5 text-center">↩️</span>Botón de arrepentimiento</Link>
            <Link href="/baja" className={row}><span aria-hidden="true" className="w-5 text-center">⏹️</span>Botón de baja</Link>
          </div>
        </section>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><ThemeToggle /></div>
      </div>
    </AppShell>
  );
}
