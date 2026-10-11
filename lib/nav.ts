import type { LucideIcon } from "lucide-react";
import { BarChart3, Calculator, Cylinder, FlaskConical, Gem, History, House, Layers, LifeBuoy, Menu, Package, Settings, ShoppingCart, Star, Truck, User, Factory, Wallet } from "lucide-react";

// Menú de la app: el mismo en la barra del costado (computadora), la barra de abajo y «Más» (celular).
export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_GROUPS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [
    { href: "/", label: "Inicio", icon: House },
    { href: "/calcular", label: "Calcular", icon: Calculator },
    { href: "/historial", label: "Historial", icon: History },
  ] },
  { title: "Negocio", items: [
    { href: "/ventas", label: "Ventas", icon: Wallet },
    { href: "/produccion", label: "Producción", icon: Factory },
    { href: "/stock", label: "Stock", icon: Package },
    { href: "/compras", label: "Compras", icon: ShoppingCart },
    { href: "/resumen", label: "Resumen", icon: BarChart3 },
  ] },
  { title: "Mis datos", items: [
    { href: "/materials", label: "Materiales", icon: Layers },
    { href: "/formulas", label: "Fórmulas", icon: FlaskConical },
    { href: "/gestion/moldes", label: "Moldes", icon: Cylinder },
    { href: "/gestion/productos", label: "Productos", icon: Gem },
    { href: "/proveedores", label: "Proveedores", icon: Truck },
  ] },
  { title: "Mi cuenta", items: [
    { href: "/access", label: "Mi acceso", icon: Star },
    { href: "/profile", label: "Mi perfil", icon: User },
    { href: "/preferences", label: "Preferencias", icon: Settings },
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

// Pantallas sin menú (entrada, páginas públicas y administración).
export const NO_NAV_PATHS = ["/login", "/auth/", "/comprar", "/legal", "/arrepentimiento", "/baja", "/r/", "/set-password", "/ayuda", "/admin", "/bienvenida"];

export const isActive = (pathname: string, href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
