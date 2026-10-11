// Menú de la app: el mismo en la barra del costado (computadora), la barra de abajo y «Más» (celular).
export type NavItem = { href: string; label: string; icon: string };

export const NAV_GROUPS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [
    { href: "/", label: "Inicio", icon: "🏠" },
    { href: "/calcular", label: "Calcular", icon: "🧮" },
    { href: "/historial", label: "Historial", icon: "🕘" },
  ] },
  { title: "Negocio", items: [
    { href: "/ventas", label: "Ventas", icon: "💰" },
    { href: "/produccion", label: "Producción", icon: "🏭" },
    { href: "/stock", label: "Stock", icon: "📦" },
    { href: "/compras", label: "Compras", icon: "🛒" },
    { href: "/resumen", label: "Resumen", icon: "📊" },
  ] },
  { title: "Mis datos", items: [
    { href: "/materials", label: "Materiales", icon: "🧱" },
    { href: "/formulas", label: "Fórmulas", icon: "🧪" },
    { href: "/gestion/moldes", label: "Moldes", icon: "🫙" },
    { href: "/gestion/productos", label: "Productos", icon: "🏺" },
    { href: "/proveedores", label: "Proveedores", icon: "🚚" },
  ] },
  { title: "Mi cuenta", items: [
    { href: "/access", label: "Mi acceso", icon: "⭐" },
    { href: "/profile", label: "Mi perfil", icon: "👤" },
    { href: "/preferences", label: "Preferencias", icon: "⚙️" },
    { href: "/ayuda", label: "Ayuda", icon: "❓" },
  ] },
];

// Barra de abajo en el celular: lo más usado + «Más» con todo lo demás.
export const BOTTOM_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/calcular", label: "Calcular", icon: "🧮" },
  { href: "/ventas", label: "Ventas", icon: "💰" },
  { href: "/stock", label: "Stock", icon: "📦" },
  { href: "/mas", label: "Más", icon: "☰" },
];

// Pantallas sin menú (entrada, páginas públicas y administración).
export const NO_NAV_PATHS = ["/login", "/auth/", "/comprar", "/legal", "/arrepentimiento", "/baja", "/r/", "/set-password", "/ayuda", "/admin"];

export const isActive = (pathname: string, href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
