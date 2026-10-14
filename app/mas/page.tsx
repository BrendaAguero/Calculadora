import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { InstallApp } from "@/components/install-app";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAccessSnapshot, hasFeature } from "@/lib/access/permissions";
import { MENU_SECTIONS, MENU_SECTION_LABELS, NAV_GROUPS, SIMPLE_GROUPS, packGroups, visibleGroups } from "@/lib/nav";
import { getMenuState, isShown } from "@/lib/menu-server";
import { SubmitButton } from "@/components/submit-button";
import { saveMenuSections } from "./menu-actions";
import { getSimpleMode } from "@/lib/simple-mode-server";
import { SimpleModeToggle } from "@/components/simple-mode-toggle";
import { ChevronRight, FileText, Undo2, CircleStop, Wrench } from "lucide-react";

const row = "flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800";
const box = "divide-y divide-neutral-100 overflow-hidden rounded-3xl bg-white dark:divide-neutral-800 dark:bg-neutral-900";

// Todo el menú en una sola pantalla, sin submenús.
export default async function MasPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const params = await searchParams;
  const [snapshot, simple, menu] = await Promise.all([getAccessSnapshot(), getSimpleMode(), getMenuState()]);
  const hidden = menu ? MENU_SECTIONS.filter((s) => !isShown(menu, s)) : [];
  const hrefOf = (section: string) => NAV_GROUPS.flatMap((g) => g.items).find((i) => i.section === section)!;
  const pack = !snapshot || hasFeature(snapshot, 'VENTAS');
  const essentials = packGroups(SIMPLE_GROUPS, pack).flatMap((g) => g.items).filter((item) => item.href !== "/" && item.href !== "/mas");
  const groups = packGroups(visibleGroups(NAV_GROUPS, hidden), pack).map((group, i) => (
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
        <Link href="/empezar" className="flex items-center justify-between rounded-3xl bg-white px-4 py-4 font-semibold dark:bg-neutral-900">Personalizar Inicio y el menú<ChevronRight size={18} aria-hidden="true" className="text-neutral-400" /></Link>
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
        {menu && (
          <details className="group" open={Boolean(params.ok || params.error) || undefined}>
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-3xl bg-white px-4 py-4 font-semibold dark:bg-neutral-900">
              Más funciones y qué ver en el menú
              <ChevronRight size={18} aria-hidden="true" className="text-neutral-400 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-3 rounded-3xl bg-white p-5 dark:bg-neutral-900">
              <p className="text-sm text-neutral-600 dark:text-neutral-300">Para que el menú sea corto, estas funciones aparecen solo cuando las usás. Marcá las que quieras ver siempre.</p>
              {params.ok && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Listo, el menú quedó como elegiste.</p>}
              {params.error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{params.error}</p>}
              <form action={saveMenuSections} className="mt-3 grid gap-2">
                {MENU_SECTIONS.filter((section) => pack || !['produccion', 'compras', 'proveedores', 'resumen'].includes(section)).map((section) => {
                  const item = hrefOf(section);
                  return (
                    <div key={section} className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
                      <input id={`menu-${section}`} type="checkbox" name={section} defaultChecked={isShown(menu, section)} className="h-5 w-5 accent-orange-800" />
                      <label htmlFor={`menu-${section}`} className="flex-1 font-medium">{MENU_SECTION_LABELS[section]}{menu.used[section] && <span className="ml-1.5 text-xs font-normal text-neutral-500">(ya la usaste)</span>}</label>
                      <Link href={item.href} className="text-sm font-semibold text-orange-800 underline dark:text-orange-300">Abrir</Link>
                    </div>
                  );
                })}
                <div className="mt-1"><SubmitButton className="rounded-xl bg-orange-800 px-4 py-2.5 text-sm font-semibold text-white dark:bg-orange-600">Guardar</SubmitButton></div>
              </form>
            </div>
          </details>
        )}
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
