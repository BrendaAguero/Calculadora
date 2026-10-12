// Qué se ve en Inicio (lo elige cada persona al entrar por primera vez y lo cambia desde «Más»).
export const HOME_WIDGETS = [
  { key: "preparo", label: "¿Cuánto preparo?", hint: "Cuánto material y cuánto líquido para tus moldes" },
  { key: "calculos", label: "Tus últimos cálculos", hint: "Para repetir un cálculo con un toque" },
  { key: "pasos", label: "Primeros pasos", hint: "Una guía hasta que cargues tus datos" },
  { key: "acciones", label: "Botones de venta, producción y compra", hint: "Para anotar rápido" },
  { key: "avisos", label: "Avisos", hint: "Stock por terminarse y precios para actualizar" },
  { key: "ganancias", label: "Ganancias del mes", hint: "Cuánto vendiste y ganaste" },
] as const;
export type HomeWidget = (typeof HOME_WIDGETS)[number]["key"];

// Lo recomendado para cada modo.
export const WIDGET_PRESETS: Record<"simple" | "completo", HomeWidget[]> = {
  simple: ["preparo", "calculos", "pasos"],
  completo: ["preparo", "calculos", "pasos", "acciones", "avisos", "ganancias"],
};

export function widgetSet(saved: unknown): Set<HomeWidget> {
  if (!saved || typeof saved !== "object") return new Set(WIDGET_PRESETS.completo);
  const s = saved as Record<string, unknown>;
  return new Set(HOME_WIDGETS.map((w) => w.key).filter((k) => s[k] === true));
}
