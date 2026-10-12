import { openOfd, readEntry } from '@main/ofd/unzip';
import { parseXmlString } from './xml';
import { parseOFDColor } from './color';
import { parseAbbreviatedData } from './path-abbr';
import type { Page, DrawObject, TextObject, PathObject, Rect } from '@shared/ir/types';

async function readXml(zipPath: string, entry: string): Promise<any> {
  const zip = await openOfd(zipPath);
  const buf = await readEntry(zip, entry);
  return parseXmlString(buf.toString('utf8'));
}

function pickKey(obj: any, ...keys: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
    const found = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
    if (found) return obj[found];
  }
  return undefined;
}

function boxToRect(box: string): Rect {
  const parts = String(box).trim().split(/\s+/).map(Number);
  return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
}

function parseLayer(layer: any): DrawObject[] {
  const out: DrawObject[] = [];
  const items = Array.isArray(layer) ? layer : [layer];
  for (const item of items) {
    const t = pickKey(item, 'TextObject');
    if (t) {
      const boundary = boxToRect(t['@_Boundary']);
      const fillColor = parseOFDColor(pickKey(t, 'FillColor')?.['@_Value']);
      const fontRef = t['@_Font'];
      const size = +t['@_Size'];
      const text = String(pickKey(t, 'TextCode') ?? '');
      out.push({
        type: 'text',
        boundary,
        text,
        font: fontRef,
        fontSize: size,
        color: fillColor,
        fill: true,
        stroke: false,
        hScale: +t['@_HScale'] || 1
      } as TextObject);
    }
    const p = pickKey(item, 'PathObject');
    if (p) {
      const boundary = boxToRect(p['@_Boundary']);
      const fillEl = pickKey(p, 'FillColor');
      const fill = fillEl ? parseOFDColor(fillEl['@_Value']) : undefined;
      const d = parseAbbreviatedData(p['@_AbbreviatedData'] || pickKey(p, 'AbbreviatedData'));
      out.push({
        type: 'path',
        boundary,
        d,
        fill
      } as PathObject);
    }
  }
  return out;
}

export async function parsePage(filePath: string, pageIndex: number): Promise<Page> {
  const ofdXml = await readXml(filePath, 'OFD.xml');
  const ofd = pickKey(ofdXml, 'OFD');
  const docBody = pickKey(ofd, 'DocBody');
  const docRoot = pickKey(docBody, 'DocRoot');
  if (!docRoot) throw new Error('invalid OFD: missing DocRoot');
  const docXml = await readXml(filePath, docRoot);
  const doc = pickKey(docXml, 'Document');
  const pages = pickKey(doc, 'Pages');
  const pageRef = pickKey(pages, 'Page');
  if (!pageRef) throw new Error('no pages found in document');
  const baseLoc = pageRef['@_BaseLoc'];
  const docRootDir = docRoot.includes('/') ? docRoot.slice(0, docRoot.lastIndexOf('/')) : '';
  const pagePath = (docRootDir ? docRootDir + '/' : '') + baseLoc + '/Page.xml';
  const pageXml = await readXml(filePath, pagePath);
  const page = pickKey(pageXml, 'Page');
  const area = pickKey(page, 'Area');
  if (!area) throw new Error('missing Page/Area');
  const physicalBox = boxToRect(area.PhysicalBox);
  const contentXml = await readXml(filePath, (docRootDir ? docRootDir + '/' : '') + baseLoc + '/Content.xml');
  const pageContent = pickKey(contentXml, 'PageContent');
  const layer = pickKey(pageContent, 'Layer');
  const objects = layer ? parseLayer(layer) : [];
  return {
    index: pageIndex,
    width: physicalBox.w,
    left: physicalBox.x,
    height: physicalBox.h,
    top: physicalBox.y,
    objects,
    rawResources: {}
  };
}
