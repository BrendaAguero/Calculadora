// Calculadoras de mezclas: Resina, Jesmonite y Cemento decorativo.
// Las usan la pantalla (resultado en vivo) y el servidor (al guardar), para que den lo mismo.
// Los valores de fábrica salen de las fichas de los fabricantes y de la práctica habitual;
// cada usuaria puede cambiarlos y guardar los suyos (tabla activity_settings).

// Números como se escriben en Argentina (misma regla que lib/num.ts; acá se repite para que las pruebas carguen este archivo solo).
function parseAR(value: unknown): number {
  let text = String(value ?? '').trim().replace(/[\s$]/g, '');
  if (!text) return NaN;
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  return Number(text);
}

export type MixCode = "RESINA" | "JESMONITE" | "CEMENTO_DECORATIVO";

export type MixComponent = { key: string; label: string; parts: number; priced: boolean };
export type MixSettings = {
  density: number; // g por ml de la mezcla, para pasar del agua del molde a gramos
  components: MixComponent[];
  pigmentPercent: number; // sobre el peso total de la mezcla
  wastePercent: number;
  byVolume: boolean; // solo resina: la proporción de la marca es por volumen
  prices: Record<string, string>; // precio por kg de cada componente (y "pigment")
};

export type MixDef = { code: MixCode; slug: string; name: string; intro: string; ratioHint: string; defaults: MixSettings };

export const MIXES: MixDef[] = [
  {
    code: "RESINA", slug: "resina", name: "Resina",
    intro: "Resina epoxi de dos componentes (resina y endurecedor).",
    ratioHint: "Usá la proporción de tu marca: suele ser 1:1 o 2:1, por peso o por volumen.",
    defaults: {
      density: 1.1,
      components: [
        { key: "a", label: "Resina (parte A)", parts: 1, priced: true },
        { key: "b", label: "Endurecedor (parte B)", parts: 1, priced: true },
      ],
      pigmentPercent: 1, wastePercent: 10, byVolume: false, prices: {},
    },
  },
  {
    code: "JESMONITE", slug: "jesmonite", name: "Jesmonite",
    intro: "Jesmonite AC100: líquido acrílico y polvo base.",
    ratioHint: "AC100: 1 parte de líquido por 2,5 de polvo, en peso.",
    defaults: {
      density: 1.75,
      components: [
        { key: "liquido", label: "Líquido", parts: 1, priced: true },
        { key: "polvo", label: "Polvo base", parts: 2.5, priced: true },
      ],
      pigmentPercent: 2, wastePercent: 10, byVolume: false, prices: {},
    },
  },
  {
    code: "CEMENTO_DECORATIVO", slug: "cemento", name: "Cemento decorativo",
    intro: "Cemento, arena y agua (más pigmento si querés color).",
    ratioHint: "Cemento y arena entre 1:1 y 1:4. El agua es la parte que va con el cemento (0,45 = 45 % del peso del cemento).",
    defaults: {
      density: 2.1,
      components: [
        { key: "cemento", label: "Cemento", parts: 1, priced: true },
        { key: "arena", label: "Arena", parts: 2, priced: true },
        { key: "agua", label: "Agua", parts: 0.45, priced: false },
      ],
      pigmentPercent: 2, wastePercent: 10, byVolume: false, prices: {},
    },
  },
];

export const mixBySlug = (slug: string) => MIXES.find((m) => m.slug === slug) ?? null;
export const mixByCode = (code: string) => MIXES.find((m) => m.code === code) ?? null;

export function num(value: string | number | null | undefined) {
  const parsed = parseAR(String(value ?? ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

// Combina los valores guardados con los de fábrica (sirve también para descartar datos raros).
export function mergeSettings(def: MixDef, saved: unknown): MixSettings {
  const s = (saved && typeof saved === "object" ? saved : {}) as Partial<MixSettings>;
  const savedParts = new Map((Array.isArray(s.components) ? s.components : []).map((c) => [c?.key, num(c?.parts)]));
  const prices: Record<string, string> = {};
  for (const [key, value] of Object.entries(s.prices && typeof s.prices === "object" ? s.prices : {})) {
    if (typeof value === "string" && value.length < 20) prices[key] = value;
  }
  return {
    density: num(s.density) || def.defaults.density,
    components: def.defaults.components.map((c) => ({ ...c, parts: savedParts.get(c.key) || c.parts })),
    pigmentPercent: s.pigmentPercent != null && Number.isFinite(Number(s.pigmentPercent)) && Number(s.pigmentPercent) >= 0 ? Number(s.pigmentPercent) : def.defaults.pigmentPercent,
    wastePercent: s.wastePercent != null && Number.isFinite(Number(s.wastePercent)) && Number(s.wastePercent) >= 0 ? Number(s.wastePercent) : def.defaults.wastePercent,
    byVolume: def.code === "RESINA" ? Boolean(s.byVolume) : false,
    prices,
  };
}

export type PriceMethod = "percentage" | "fixed" | "manual";
export type MixInput = {
  quantity: string;
  moldMl: string; // agua que entra en el molde (ml)
  gramsPerPiece: string; // si está vacío, se calcula con el agua del molde × densidad
  moldCost: string;
  packaging: string;
  labor: string;
  other: string;
  priceMethod: PriceMethod;
  profitPercentage: string;
  fixedProfit: string;
  manualPrice: string;
};

export type MixItem = { cost_type: "other" | "waste" | "mold" | "packaging" | "labor"; key: string; name: string; quantity: number; unit: string; unit_cost: number; total_cost: number };

const EXTRAS: { key: keyof MixInput; type: MixItem["cost_type"]; label: string }[] = [
  { key: "moldCost", type: "mold", label: "Molde" },
  { key: "packaging", type: "packaging", label: "Packaging" },
  { key: "labor", type: "labor", label: "Mano de obra" },
  { key: "other", type: "other", label: "Otros" },
];

export function computeMix(settings: MixSettings, input: MixInput) {
  const pieces = Math.max(1, Math.floor(num(input.quantity)) || 1);
  const perPiece = num(input.gramsPerPiece) || num(input.moldMl) * settings.density;
  const base = perPiece * pieces; // mezcla que queda en las piezas
  const waste = base * (settings.wastePercent / 100);
  const total = base + waste; // mezcla a preparar
  const pigment = total * (settings.pigmentPercent / 100);
  const partsSum = settings.components.reduce((acc, c) => acc + c.parts, 0) || 1;
  const price = (key: string) => num(settings.prices[key]) / 1000; // por gramo

  // Cantidades a preparar (con la merma), para mostrar.
  const amounts = settings.components.map((c) => {
    const grams = total * (c.parts / partsSum);
    return { key: c.key, label: c.label, grams, ml: grams / settings.density };
  });

  // Costos: los materiales que quedan en las piezas, más una línea de merma.
  const items: MixItem[] = [];
  let materialsCost = 0;
  for (const c of settings.components) {
    if (!c.priced) continue;
    const grams = base * (c.parts / partsSum);
    const cost = grams * price(c.key);
    materialsCost += cost;
    items.push({ cost_type: "other", key: c.key, name: c.label, quantity: grams, unit: "g", unit_cost: price(c.key), total_cost: cost });
  }
  if (pigment > 0) {
    const grams = base * (settings.pigmentPercent / 100);
    const cost = grams * price("pigment");
    materialsCost += cost;
    items.push({ cost_type: "other", key: "pigment", name: "Pigmento", quantity: grams, unit: "g", unit_cost: price("pigment"), total_cost: cost });
  }
  if (waste > 0 && materialsCost > 0) {
    items.push({ cost_type: "waste", key: "waste", name: `Merma (${settings.wastePercent} %)`, quantity: waste, unit: "g", unit_cost: materialsCost / base, total_cost: materialsCost * (settings.wastePercent / 100) });
  }
  for (const extra of EXTRAS) {
    const value = num(input[extra.key] as string);
    if (value > 0) items.push({ cost_type: extra.type, key: extra.key, name: extra.label, quantity: 1, unit: "tanda", unit_cost: value, total_cost: value });
  }

  const totalCost = items.reduce((acc, item) => acc + item.total_cost, 0);
  const unitCost = totalCost / pieces;
  const salePrice = input.priceMethod === "percentage"
    ? unitCost * (1 + num(input.profitPercentage) / 100)
    : input.priceMethod === "fixed" ? unitCost + num(input.fixedProfit) : num(input.manualPrice);
  const profit = salePrice - unitCost;
  const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;

  return { pieces, perPiece, base, waste, total, pigment, amounts, items, totalCost, unitCost, price: salePrice, profit, margin };
}
