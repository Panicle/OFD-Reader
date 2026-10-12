import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFile } from 'fs/promises';
import type { Document, TextObject, PathObject } from '@shared/ir/types';

function colorToRgb(c: { r: number; g: number; b: number; a: number }) {
  return rgb(c.r, c.g, c.b);
}

function drawTextObject(pdfPage: any, t: TextObject, pageHeight: number): void {
  // pdf-lib text uses baseline-y; OFD baseline approximated as boundary.y + fontSize
  const baselineY = pageHeight - (t.boundary.y + t.fontSize);
  pdfPage.drawText(t.text, {
    x: t.boundary.x,
    y: baselineY,
    size: t.fontSize,
    color: colorToRgb(t.color)
  });
}

function drawPathObject(_pdfPage: any, _p: PathObject, _pageHeight: number): void {
  // v1: PathObject rendering is a future task (pdf-lib lacks SVG path support natively).
}

export async function exportDocumentToPdf(
  doc: Document,
  outPath: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  await pdfDoc.embedFont(StandardFonts.Helvetica);
  for (const irPage of doc.pages) {
    const pdfPage = pdfDoc.addPage([irPage.width, irPage.height]);
    for (const obj of irPage.objects) {
      if (obj.type === 'text') {
        drawTextObject(pdfPage, obj, irPage.height);
      } else if (obj.type === 'path') {
        drawPathObject(pdfPage, obj, irPage.height);
      }
    }
  }
  const bytes = await pdfDoc.save();
  await writeFile(outPath, bytes);
  return bytes;
}
