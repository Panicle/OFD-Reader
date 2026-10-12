import { describe, it, expect } from 'vitest';
import type { Document, Page, TextObject, PathObject, ImageObject } from '@shared/ir/types';

describe('Object literal smoke', () => {
  it('constructs a TextObject with required fields', () => {
    const t: TextObject = {
      type: 'text',
      boundary: { x: 0, y: 0, w: 100, h: 20 },
      text: '你好',
      font: 'f1',
      fontSize: 12,
      color: { r: 0, g: 0, b: 0, a: 1 },
      fill: true,
      stroke: false,
      hScale: 1
    };
    expect(t.text).toBe('你好');
  });

  it('constructs a PathObject', () => {
    const p: PathObject = {
      type: 'path',
      boundary: { x: 0, y: 0, w: 50, h: 50 },
      d: [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 50, y: 50 }, { op: 'Z' }],
      fill: { r: 255, g: 0, b: 0, a: 1 },
      stroke: { color: { r: 0, g: 0, b: 0, a: 1 }, width: 1 }
    };
    expect(p.d[0].op).toBe('M');
  });

  it('constructs an ImageObject', () => {
    const i: ImageObject = {
      type: 'image',
      boundary: { x: 0, y: 0, w: 80, h: 60 },
      resourceId: 'img1'
    };
    expect(i.resourceId).toBe('img1');
  });

  it('constructs a Page', () => {
    const page: Page = {
      index: 0,
      width: 210,
      left: 0,
      height: 297,
      top: 0,
      objects: []
    };
    expect(page.width).toBe(210);
  });

  it('constructs a Document', () => {
    const doc: Document = { pages: [], fonts: {}, totalPages: 0 };
    expect(doc.pages).toHaveLength(0);
  });
});