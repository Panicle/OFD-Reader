import { openOfd, readEntry } from '@main/ofd/unzip';
import { parseXmlString } from './xml';

export async function parseOfdRoot(filePath: string): Promise<string> {
  const zip = await openOfd(filePath);
  const buf = await readEntry(zip, 'OFD.xml');
  const xml = parseXmlString(buf.toString('utf8'));
  const docBody = xml?.OFD?.DocBody;
  if (!docBody) throw new Error('invalid OFD: missing DocBody');
  const docRoot = docBody.DocRoot;
  if (!docRoot) throw new Error('invalid OFD: missing DocRoot');
  return docRoot;
}