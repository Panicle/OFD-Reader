import { describe, it, expect, beforeAll } from 'vitest';
import { parseDocument } from '@main/parse/document';
import { existsSync } from 'fs';
import { resolve } from 'path';

const FIXTURE = resolve(__dirname, '../fixtures/sample.ofd');

describe('parseDocument', () => {
  beforeAll(() => {
    if (!existsSync(FIXTURE)) throw new Error('fixture missing');
  });

  it('returns a Document with N pages', async () => {
    const doc = await parseDocument(FIXTURE);
    expect(doc.totalPages).toBe(1);
    expect(doc.pages).toHaveLength(1);
  });

  it('first page has expected dimensions', async () => {
    const doc = await parseDocument(FIXTURE);
    expect(doc.pages[0].width).toBe(210);
    expect(doc.pages[0].height).toBe(297);
  });

  it('document fonts is empty object', async () => {
    const doc = await parseDocument(FIXTURE);
    expect(doc.fonts).toEqual({});
  });
});
