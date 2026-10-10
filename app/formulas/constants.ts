export const INGREDIENT_TYPES = ['material', 'water', 'additive', 'pigment', 'hardener', 'other'] as const;
export const INGREDIENT_UNITS = ['g', 'kg', 'mg', 'ml', 'l', 'unidad'] as const;

export const INGREDIENT_LABELS: Record<string, string> = {
  material: 'Material',
  water: 'Agua',
  additive: 'Aditivo',
  pigment: 'Pigmento',
  hardener: 'Endurecedor',
  other: 'Otro',
};
