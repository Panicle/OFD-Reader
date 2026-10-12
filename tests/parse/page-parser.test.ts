import { describe, it, expect, beforeAll } from 'vitest';
import { parsePage } from '@main/parse/page-parser';
import { existsSync } from 'fs';
import { resolve } from 'path';

const FIXTURE = resolve(__dirname, '../fixtures/sample.ofd');

describe('page-parser', () => {
  beforeAll(() => {
    if (!existsSync(FIXTURE)) throw new Error('fixture missing');
  });

  it('parses a single page with TextObject and PathObject', async () => {
    const page = await parsePage(FIXTURE, 0);
    expect(page.index).toBe(0);
    expect(page.width).toBe(210);
    expect(page.height).toBe(297);
    expect(page.objects.some(o => o.type === 'text')).toBe(true);
    expect(page.objects.some(o => o.type === 'path')).toBe(true);
  });

  it('parses TextObject with correct fields', async () => {
    const page = await parsePage(FIXTURE, 0);
    const textObj = page.objects.find(o => o.type === 'text');
    expect(textObj).toBeDefined();
    if (textObj?.type === 'text') {
      expect(textObj.text).toBe('Hello OFD');
      expect(textObj.fontSize).toBe(12);
      expect(textObj.boundary).toEqual({ x: 10, y: 10, w: 100, h: 20 });
    }
  });

  it('parses PathObject with correct fields', async () => {
    const page = await parsePage(FIXTURE, 0);
    const pathObj = page.objects.find(o => o.type === 'path');
    expect(pathObj).toBeDefined();
    if (pathObj?.type === 'path') {
      expect(pathObj.boundary).toEqual({ x: 10, y: 40, w: 50, h: 50 });
      expect(pathObj.d).toEqual([
        { op: 'M', x: 0, y: 0 },
        { op: 'L', x: 50, y: 50 },
        { op: 'Z' }
      ]);
      expect(pathObj.fill).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    }
  });
});
