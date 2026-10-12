import { openOfd, readEntry } from '@main/ofd/unzip';
import { parseXmlString } from './xml';

function pickKey(obj: any, ...keys: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
    const found = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
    if (found) return obj[found];
  }
  return undefined;
}

export async function parseOfdRoot(filePath: string): Promise<string> {
  const zip = await openOfd(filePath);
  const buf = await readEntry(zip, 'OFD.xml');
  const xml = parseXmlString(buf.toString('utf8'));
  const ofd = pickKey(xml, 'OFD');
  const docBody = pickKey(ofd, 'DocBody');
  if (!docBody) throw new Error('invalid OFD: missing DocBody');
  const docRoot = pickKey(docBody, 'DocRoot');
  if (!docRoot) throw new Error('invalid OFD: missing DocRoot');
  return docRoot;
}
