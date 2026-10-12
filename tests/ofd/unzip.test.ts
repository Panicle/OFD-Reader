import { describe, it, expect, beforeAll } from 'vitest';
import { openOfd, readEntry, listEntries } from '@main/ofd/unzip';
import { existsSync } from 'fs';
import { resolve } from 'path';

const FIXTURE = resolve(__dirname, '../fixtures/sample.ofd');

describe('ofd unzip', () => {
  beforeAll(() => {
    if (!existsSync(FIXTURE)) {
      throw new Error(`missing fixture: ${FIXTURE}. Run the fixture-build step from Task 3 first.`);
    }
  });

  it('opens an OFD zip and lists entries', async () => {
    const zip = await openOfd(FIXTURE);
    const entries = await listEntries(zip);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some(e => e.name.toLowerCase() === 'ofd.xml')).toBe(true);
  });

  it('reads an entry as buffer', async () => {
    const zip = await openOfd(FIXTURE);
    const buf = await readEntry(zip, 'OFD.xml');
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });
});
