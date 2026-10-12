import type { FontFace } from '@shared/ir/types';

const FALLBACK_FAMILY = 'Noto Sans CJK SC, system-ui, sans-serif';

export function resolveFont(id: string, fonts: Record<string, FontFace>): FontFace {
  return fonts[id] ?? { id, family: FALLBACK_FAMILY, fontData: null };
}
