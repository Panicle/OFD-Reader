import type { Color } from '@shared/ir/types';

export function parseOFDColor(value: string | undefined): Color {
  if (!value) return { r: 0, g: 0, b: 0, a: 1 };
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length < 3 || parts.some(n => Number.isNaN(n))) {
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  // OFD colors can be 0..255 or 0..1; heuristic — if max > 1, treat as 0..255
  const max = Math.max(parts[0], parts[1], parts[2]);
  const scale = max > 1 ? 1 / 255 : 1;
  const aRaw = parts.length >= 4 ? parts[3] : 1;
  const aScale = aRaw > 1 ? 1 / 255 : 1;
  return {
    r: parts[0] * scale,
    g: parts[1] * scale,
    b: parts[2] * scale,
    a: aRaw * aScale
  };
}
