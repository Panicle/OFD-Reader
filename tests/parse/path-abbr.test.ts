import { describe, it, expect } from 'vitest';
import { parseAbbreviatedData } from '@main/parse/path-abbr';
import type { PathCommand } from '@shared/ir/types';

describe('parseAbbreviatedData', () => {
  it('parses M L Z', () => {
    const cmds = parseAbbreviatedData('M 0 0 L 10 10 L 20 0 Z');
    expect(cmds).toEqual([
      { op: 'M', x: 0, y: 0 },
      { op: 'L', x: 10, y: 10 },
      { op: 'L', x: 20, y: 0 },
      { op: 'Z' }
    ]);
  });

  it('parses C (cubic)', () => {
    const cmds = parseAbbreviatedData('M 0 0 C 10 0 20 10 30 0 Z');
    expect(cmds[0].op).toBe('M');
    const c = cmds[1] as Extract<PathCommand, { op: 'C' }>;
    expect(c.op).toBe('C');
    expect(c.x).toBe(30);
    expect(c.y).toBe(0);
    expect(c.x1).toBe(10);
    expect(c.y1).toBe(0);
    expect(c.x2).toBe(20);
    expect(c.y2).toBe(10);
  });

  it('parses Q (quadratic)', () => {
    const cmds = parseAbbreviatedData('M 0 0 Q 10 10 20 0');
    expect(cmds[0].op).toBe('M');
    const q = cmds[1] as Extract<PathCommand, { op: 'Q' }>;
    expect(q.op).toBe('Q');
    expect(q.x1).toBe(10);
    expect(q.x).toBe(20);
  });

  it('returns empty for empty input', () => {
    expect(parseAbbreviatedData('')).toEqual([]);
  });

  it('throws on unknown token', () => {
    expect(() => parseAbbreviatedData('X 0 0')).toThrow(/unknown path token/);
  });
});
