// Volumen de un molde a partir de sus medidas en centímetros (1 cm³ = 1 ml).
export type MoldShape = 'rect' | 'round';

export function moldVolumeMl(shape: MoldShape, dims: { length?: number; width?: number; diameter?: number; height?: number }) {
  const h = Math.max(dims.height ?? 0, 0);
  if (shape === 'round') {
    const r = Math.max(dims.diameter ?? 0, 0) / 2;
    return Math.PI * r * r * h;
  }
  return Math.max(dims.length ?? 0, 0) * Math.max(dims.width ?? 0, 0) * h;
}
