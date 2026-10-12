import { describe, it, expect, beforeAll } from 'vitest';
import { parseOfdRoot } from '@main/parse/ofd-parser';
import { existsSync } from 'fs';
import { resolve } from 'path';

const FIXTURE = resolve(__dirname, '../fixtures/sample.ofd');

describe('ofd-parser', () => {
  beforeAll(() => {
    if (!existsSync(FIXTURE)) {
      throw new Error(`missing fixture: ${FIXTURE}. Run Task 3 first.`);
    }
  });

  it('extracts DocRoot path from OFD.xml', async () => {
    const root = await parseOfdRoot(FIXTURE);
    expect(root).toBe('Doc_0/Document.xml');
  });
});