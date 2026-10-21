// Reglas de acceso puras (sin base ni sesión): qué puede usar cada cuenta. Se prueban con npm test.

export type BasePlanCode = "BASIC" | "ADVANCED";
export type Resource = "materials" | "products" | "formulas" | "molds";

export type AccessSnapshot = {
  accountStatus: "active" | "suspended" | "blocked";
  isAdmin: boolean;
  // Moderadora de la comunidad (las administradoras también moderan).
  isModerator: boolean;
  // Cuenta de prueba: sin límites ni restricciones de plan (no es administradora).
  isTester: boolean;
  basePlan: BasePlanCode | null;
  baseLicenseActive: boolean;
  // Licencia de cortesía con vencimiento (null = no vence).
  licenseExpiresAt: string | null;
  // Versión gratis: sin licencia (y sin ser administradora ni cuenta de prueba). Tiene límites chicos y banner.
  isFree: boolean;
  entrepreneurActive: boolean;
  entrepreneurExpiresAt: string | null;
  activities: string[];
  modules: string[];
  limits: Partial<Record<Resource, number>>;
};

// Respaldo por si la tabla plan_limits no responde (mismos valores que la base).
export const FALLBACK_LIMITS: Record<BasePlanCode | "FREE", Record<Resource, number>> = {
  FREE: { materials: 5, products: 2, formulas: 1, molds: 1 },
  BASIC: { materials: 30, products: 10, formulas: 5, molds: 5 },
  ADVANCED: { materials: 100, products: 50, formulas: 30, molds: 30 },
};

export const RESOURCE_LABELS: Record<Resource, string> = {
  materials: "materiales",
  products: "productos",
  formulas: "fórmulas",
  molds: "moldes",
};

// Pack Ventas y Stock: ventas, resumen, stock, producción, compras y proveedores van juntos.
// Se compra en la tienda de la app (pago único) como extra de la Edición Personal; Personal Plus lo incluye.
export const PACK_CODE = "PACK_VENTAS";
const PACK_FEATURES = new Set(["VENTAS", "PRODUCCION", "ESTADISTICAS", "STOCK_BASICO", "PROVEEDORES_BASICO"]);
// Herramientas del taller que vienen incluidas en la Edición Personal.
const INCLUDED_WITH_LICENSE = new Set(["COLORES", "CUADERNO"]);

export function hasFeature(snapshot: AccessSnapshot, feature: string): boolean {
  if (snapshot.isAdmin || snapshot.isTester) return true;
  if (snapshot.accountStatus !== "active") return false;
  // Personal Plus desbloquea todo, tenga o no la Edición Personal.
  if (snapshot.entrepreneurActive) return true;
  if (!snapshot.baseLicenseActive) return false;
  if (INCLUDED_WITH_LICENSE.has(feature)) return true;
  // Quien compró antes los módulos sueltos de stock o proveedores los conserva.
  return snapshot.modules.includes(feature) || (PACK_FEATURES.has(feature) && snapshot.modules.includes(PACK_CODE));
}

// Publicidad: la ven todas las cuentas salvo las que tienen Personal Plus (y administración / prueba).
export function showsAds(snapshot: AccessSnapshot) {
  return !snapshot.isAdmin && !snapshot.isTester && !snapshot.entrepreneurActive;
}

export function getResourceLimit(snapshot: AccessSnapshot, resource: Resource): number {
  if (snapshot.isAdmin || snapshot.isTester) return Number.POSITIVE_INFINITY;
  if (snapshot.accountStatus !== "active") return 0;
  if (snapshot.entrepreneurActive) return Number.POSITIVE_INFINITY;
  return snapshot.limits[resource] ?? FALLBACK_LIMITS[snapshot.basePlan ?? "FREE"][resource];
}
