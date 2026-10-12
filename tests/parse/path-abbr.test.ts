import { describe, it, expect } from 'vitest';
import { parseAbbreviatedData } from '@main/parse/path-abbr';

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
    expect(cmds[1].op).toBe('C');
    expect(cmds[1].x).toBe(30);
    expect(cmds[1].y).toBe(0);
    expect(cmds[1].x1).toBe(10);
    expect(cmds[1].y1).toBe(0);
    expect(cmds[1].x2).toBe(20);
    expect(cmds[1].y2).toBe(10);
  });

  it('parses Q (quadratic)', () => {
    const cmds = parseAbbreviatedData('M 0 0 Q 10 10 20 0');
    expect(cmds[0].op).toBe('M');
    expect(cmds[1].op).toBe('Q');
    expect(cmds[1].x1).toBe(10);
    expect(cmds[1].x).toBe(20);
  });

  it('returns empty for empty input', () => {
    expect(parseAbbreviatedData('')).toEqual([]);
  });

  it('throws on unknown token', () => {
    expect(() => parseAbbreviatedData('X 0 0')).toThrow(/unknown path token/);
  });
});
