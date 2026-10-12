import { describe, it, expect } from 'vitest';
import { exportDocumentToPdf } from '@main/render/pdf-renderer';
import { PDFDocument } from 'pdf-lib';
import type { Document } from '@shared/ir/types';

const doc: Document = {
  totalPages: 1,
  pages: [{
    index: 0, width: 200, left: 0, height: 200, top: 0,
    objects: [
      { type: 'text', boundary: { x: 10, y: 10, w: 100, h: 20 }, text: 'Hi',
        font: 'F1', fontSize: 12, color: { r: 0, g: 0, b: 0, a: 1 },
        fill: true, stroke: false, hScale: 1 },
      { type: 'path', boundary: { x: 0, y: 50, w: 50, h: 50 },
        d: [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 50, y: 50 }, { op: 'Z' }],
        fill: { r: 1, g: 0, b: 0, a: 1 } }
    ],
    rawResources: {}
  }],
  fonts: {}
};

describe('exportDocumentToPdf', () => {
  it('produces a non-empty PDF buffer', async () => {
    const bytes = await exportDocumentToPdf(doc, '/tmp/out-test-1.pdf');
    expect(bytes.length).toBeGreaterThan(100);
    expect(bytes.slice(0, 4).toString()).toBe('%PDF');
  });

  it('produces a valid PDF parseable by pdf-lib', async () => {
    const bytes = await exportDocumentToPdf(doc, '/tmp/out-test-2.pdf');
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
