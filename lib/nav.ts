import type { LucideIcon } from "lucide-react";
import { Lock, ShieldCheck, Users, Wrench, CircleHelp, NotebookPen, Palette, Timer, Ruler, ClipboardList, Download, MoreHorizontal, Receipt, Store, BarChart3, Calculator, Cylinder, FlaskConical, Gem, History, House, Layers, LifeBuoy, Menu, Package, Settings, ShoppingCart, Star, Truck, User, Factory, Wallet } from "lucide-react";

// Menú de la app: el mismo en la barra del costado (computadora), la barra de abajo y «Más» (celular).
export type NavItem = { href: string; label: string; icon: LucideIcon; section?: MenuSection };

// Secciones que aparecen en el menú solo si la persona las usa (o si eligió verlas en «Más»).
export const MENU_SECTIONS = ["produccion", "compras", "proveedores", "resumen", "lista-precios", "colores", "cuaderno", "revendedora"] as const;
export type MenuSection = (typeof MENU_SECTIONS)[number];
export const MENU_SECTION_LABELS: Record<MenuSection, string> = {
  produccion: "Producción", compras: "Compras", proveedores: "Proveedores", resumen: "Resumen del negocio", "lista-precios": "Lista de precios", colores: "Recetas de color", cuaderno: "Cuaderno de pruebas", revendedora: "Revendedora",
};

// Saca del menú las secciones ocultas (y los grupos que quedan vacíos).
export function visibleGroups(groups: { title: string | null; items: NavItem[] }[], hidden: readonly string[]) {
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => !i.section || !hidden.includes(i.section)) })).filter((g) => g.items.length > 0);
}

export const NAV_GROUPS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [
    { href: "/", label: "Inicio", icon: House },
    { href: "/calcular", label: "Calcular", icon: Calculator },
    { href: "/herramientas", label: "Herramientas", icon: Ruler },
    { href: "/temporizadores", label: "Temporizadores", icon: Timer },
    { href: "/comunidad", label: "Comunidad", icon: Users },
    { href: "/historial", label: "Historial", icon: History },
  ] },
  { title: "Negocio", items: [
    { href: "/ventas", label: "Ventas", icon: Wallet },
    { href: "/produccion", label: "Producción", icon: Factory, section: "produccion" },
    { href: "/stock", label: "Stock", icon: Package },
    { href: "/compras", label: "Compras", icon: ShoppingCart, section: "compras" },
    { href: "/resumen", label: "Resumen", icon: BarChart3, section: "resumen" },
    { href: "/lista-precios", label: "Lista de precios", icon: ClipboardList, section: "lista-precios" },
  ] },
  { title: "Taller", items: [
    { href: "/colores", label: "Recetas de color", icon: Palette, section: "colores" },
    { href: "/cuaderno", label: "Cuaderno de pruebas", icon: NotebookPen, section: "cuaderno" },
    { href: "/ayuda/problemas", label: "¿Qué le pasó a mi pieza?", icon: CircleHelp },
  ] },
  { title: "Mis datos", items: [
    { href: "/materials", label: "Materiales", icon: Layers },
    { href: "/formulas", label: "Fórmulas", icon: FlaskConical },
    { href: "/gestion/moldes", label: "Moldes", icon: Cylinder },
    { href: "/gestion/productos", label: "Productos", icon: Gem },
    { href: "/proveedores", label: "Proveedores", icon: Truck, section: "proveedores" },
  ] },
  { title: "Mi cuenta", items: [
    { href: "/access", label: "Mi acceso", icon: Star },
    { href: "/profile", label: "Mi perfil", icon: User },
    { href: "/revendedora", label: "Revendedora", icon: Store, section: "revendedora" },
    { href: "/preferences", label: "Preferencias", icon: Settings },
    { href: "/exportar", label: "Bajar mis datos", icon: Download },
    { href: "/ayuda", label: "Ayuda", icon: LifeBuoy },
  ] },
];

// Barra de abajo en el celular: lo más usado + «Más» con todo lo demás.
export const BOTTOM_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/calcular", label: "Calcular", icon: Calculator },
  { href: "/ventas", label: "Ventas", icon: Wallet },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/mas", label: "Más", icon: Menu },
];

// Modo simple: solo lo esencial, con nombres claros.
export const SIMPLE_GROUPS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [
    { href: "/", label: "Inicio", icon: House },
    { href: "/calcular", label: "Calcular un precio", icon: Calculator },
    { href: "/herramientas", label: "Herramientas", icon: Ruler },
    { href: "/temporizadores", label: "Temporizadores", icon: Timer },
    { href: "/ventas/nueva", label: "Registrar una venta", icon: Receipt },
    { href: "/ventas", label: "Lo que vendí", icon: Wallet },
    { href: "/stock", label: "Lo que tengo", icon: Package },
    { href: "/materials", label: "Mis materiales", icon: Layers },
    { href: "/gestion/productos", label: "Mis productos", icon: Gem },
    { href: "/lista-precios", label: "Lista de precios", icon: ClipboardList, section: "lista-precios" },
  ] },
  { title: null, items: [
    { href: "/colores", label: "Mis colores", icon: Palette, section: "colores" },
    { href: "/cuaderno", label: "Mi cuaderno de pruebas", icon: NotebookPen, section: "cuaderno" },
    { href: "/ayuda/problemas", label: "¿Qué le pasó a mi pieza?", icon: CircleHelp },
    { href: "/comunidad", label: "Comunidad", icon: Users },
    { href: "/ayuda", label: "Ayuda", icon: LifeBuoy },
    { href: "/mas", label: "Más opciones", icon: MoreHorizontal },
  ] },
];

export const SIMPLE_BOTTOM: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/calcular", label: "Calcular", icon: Calculator },
  { href: "/ventas/nueva", label: "Vender", icon: Receipt },
  { href: "/stock", label: "Mi stock", icon: Package },
  { href: "/mas", label: "Más", icon: Menu },
];

// Pantallas sin menú (entrada, páginas públicas y administración).
export const NO_NAV_PATHS = ["/login", "/registro", "/conocer", "/auth/", "/comprar", "/legal", "/arrepentimiento", "/baja", "/r/", "/set-password", "/ayuda", "/admin", "/moderacion", "/equipo-ingreso", "/bienvenida", "/empezar"];

// Equipo: la administradora ve «Administración» y «Moderación»; la moderadora, solo «Moderación».
export type StaffRole = "admin" | "moderator" | null;
export function staffGroup(staff: StaffRole): { title: string | null; items: NavItem[] }[] {
  if (!staff) return [];
  const items: NavItem[] = [{ href: "/moderacion", label: "Moderación", icon: ShieldCheck }];
  if (staff === "admin") items.unshift({ href: "/admin", label: "Administración", icon: Wrench });
  return [{ title: "Equipo", items }];
}

export const isActive = (pathname: string, href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
// En una lista de enlaces, solo el más específico queda marcado (por ejemplo «Registrar una venta» y no también «Lo que vendí»).
export const activeHref = (pathname: string, items: NavItem[]) =>
  items.filter((item) => isActive(pathname, item.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

// Sin el Pack Ventas y Stock: en vez de varias pantallas bloqueadas, una sola entrada que explica el pack,
// y la barra de abajo con lo que sí puede usar.
const PACK_HREFS = ["/ventas", "/ventas/nueva", "/stock", "/produccion", "/compras", "/resumen", "/proveedores"];
const PACK_ENTRY: NavItem = { href: "/ventas", label: "Ventas y stock", icon: Lock };

export function packGroups(groups: { title: string | null; items: NavItem[] }[], pack: boolean) {
  if (pack) return groups;
  let added = false;
  return groups.map((g) => {
    const had = g.items.some((i) => PACK_HREFS.includes(i.href));
    const items = g.items.filter((i) => !PACK_HREFS.includes(i.href));
    if (had && !added) { added = true; items.push(PACK_ENTRY); }
    return { ...g, items };
  }).filter((g) => g.items.length > 0);
}

const BOTTOM_NO_PACK: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/calcular", label: "Calcular", icon: Calculator },
  { href: "/temporizadores", label: "Tiempos", icon: Timer },
  { href: "/herramientas", label: "Herramientas", icon: Ruler },
  { href: "/mas", label: "Más", icon: Menu },
];
export const bottomItems = (simple: boolean, pack: boolean) => (!pack ? BOTTOM_NO_PACK : simple ? SIMPLE_BOTTOM : BOTTOM_ITEMS);
