import type { PathCommand } from '@shared/ir/types';

const TOKENS = ['M', 'L', 'C', 'Q', 'A', 'Z'];

export function parseAbbreviatedData(input: string): PathCommand[] {
  if (!input) return [];
  const tokens = input.trim().split(/\s+/);
  const out: PathCommand[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (!TOKENS.includes(t)) throw new Error(`unknown path token: ${t}`);
    switch (t) {
      case 'M':
        out.push({ op: 'M', x: +tokens[++i], y: +tokens[++i] }); i++; break;
      case 'L':
        out.push({ op: 'L', x: +tokens[++i], y: +tokens[++i] }); i++; break;
      case 'C':
        out.push({
          op: 'C',
          x1: +tokens[++i], y1: +tokens[++i],
          x2: +tokens[++i], y2: +tokens[++i],
          x: +tokens[++i], y: +tokens[++i]
        }); i++; break;
      case 'Q':
        out.push({
          op: 'Q',
          x1: +tokens[++i], y1: +tokens[++i],
          x: +tokens[++i], y: +tokens[++i]
        }); i++; break;
      case 'A':
        // Arc — 7 params: rx ry angle large-arc-flag sweep-flag x y. v1 skips.
        i += 8; break;
      case 'Z':
        out.push({ op: 'Z' }); i++; break;
    }
  }
  return out;
}
