import { describe, it, expect, beforeEach } from 'vitest';
import { renderPage } from '@renderer/ir/canvas-renderer';
import type { RendererContext } from '@renderer/ir/canvas-renderer';
import type { Page } from '@shared/ir/types';

class MockCtx {
  calls: Array<{ method: string; args: any[] }> = [];
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  fillText(t: string, x: number, y: number) { this.calls.push({ method: 'fillText', args: [t, x, y] }); }
  strokeText(t: string, x: number, y: number) { this.calls.push({ method: 'strokeText', args: [t, x, y] }); }
  beginPath() { this.calls.push({ method: 'beginPath', args: [] }); }
  moveTo(x: number, y: number) { this.calls.push({ method: 'moveTo', args: [x, y] }); }
  lineTo(x: number, y: number) { this.calls.push({ method: 'lineTo', args: [x, y] }); }
  closePath() { this.calls.push({ method: 'closePath', args: [] }); }
  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    this.calls.push({ method: 'bezierCurveTo', args: [x1, y1, x2, y2, x, y] });
  }
  quadraticCurveTo(x1: number, y1: number, x: number, y: number) {
    this.calls.push({ method: 'quadraticCurveTo', args: [x1, y1, x, y] });
  }
  fill() { this.calls.push({ method: 'fill', args: [] }); }
  stroke() { this.calls.push({ method: 'stroke', args: [] }); }
  drawImage(_img: any, _x: number, _y: number) {}
  save() { this.calls.push({ method: 'save', args: [] }); }
  restore() { this.calls.push({ method: 'restore', args: [] }); }
  translate(_x: number, _y: number) {}
}

const page: Page = {
  index: 0, width: 200, left: 0, height: 200, top: 0,
  objects: [
    {
      type: 'text', boundary: { x: 10, y: 10, w: 100, h: 20 },
      text: 'Hi', font: 'F1', fontSize: 12, color: { r: 0, g: 0, b: 0, a: 1 },
      fill: true, stroke: false, hScale: 1
    },
    {
      type: 'path', boundary: { x: 0, y: 50, w: 50, h: 50 },
      d: [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 50, y: 50 }, { op: 'Z' }],
      fill: { r: 1, g: 0, b: 0, a: 1 }
    }
  ],
  rawResources: {}
};

describe('renderPage', () => {
  let m: MockCtx;
  beforeEach(() => { m = new MockCtx(); });

  it('renders text and path with at least the expected calls', () => {
    renderPage(m as unknown as RendererContext, page, { 'F1': { id: 'F1', family: 'Arial', fontData: null } });
    expect(m.calls.some(c => c.method === 'fillText')).toBe(true);
    expect(m.calls.some(c => c.method === 'moveTo')).toBe(true);
  });

  it('uses fallback when font id not in registry', () => {
    renderPage(m as unknown as RendererContext, page, {});
    expect(m.calls.some(c => c.method === 'fillText')).toBe(true);
  });

  it('renders C and Q curves with bezierCurveTo / quadraticCurveTo', () => {
    const curvePage: Page = {
      index: 0, width: 200, left: 0, height: 200, top: 0,
      objects: [
        { type: 'path', boundary: { x: 0, y: 0, w: 100, h: 100 },
          d: [
            { op: 'M', x: 0, y: 0 },
            { op: 'C', x1: 10, y1: 0, x2: 20, y2: 10, x: 30, y: 0 },
            { op: 'Q', x1: 50, y1: 50, x: 70, y: 0 },
            { op: 'Z' }
          ],
          fill: { r: 1, g: 0, b: 0, a: 1 }
        }
      ],
      rawResources: {}
    };
    renderPage(m as unknown as RendererContext, curvePage, {});
    expect(m.calls.some(c => c.method === 'bezierCurveTo')).toBe(true);
    expect(m.calls.some(c => c.method === 'quadraticCurveTo')).toBe(true);
  });
});
