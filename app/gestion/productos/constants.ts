export const PRICE_TYPES = [
  { value: 'retail', label: 'Minorista' },
  { value: 'wholesale', label: 'Mayorista' },
  { value: 'promotional', label: 'Promoción' },
  { value: 'manual', label: 'Manual' },
] as const;

export const PRODUCT_STATUSES = [
  { value: 'active', label: 'Activo' },
  { value: 'paused', label: 'Pausado' },
  { value: 'archived', label: 'Archivado' },
] as const;

export const priceTypeLabel = (value: string) => PRICE_TYPES.find(t => t.value === value)?.label ?? value;
export const statusLabel = (value: string) => PRODUCT_STATUSES.find(s => s.value === value)?.label ?? value;
