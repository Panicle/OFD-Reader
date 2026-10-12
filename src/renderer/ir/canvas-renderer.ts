import type { Page, FontFace, TextObject, PathObject } from '@shared/ir/types';
import { resolveFont } from '@shared/font/resolver';

export interface RendererContext {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void;
  quadraticCurveTo(x1: number, y1: number, x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  drawImage(img: any, x: number, y: number): void;
}

function colorToCss(c: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
}

function drawText(ctx: RendererContext, t: TextObject, font: FontFace): void {
  ctx.save();
  ctx.font = `${t.fontSize}px ${font.family}`;
  ctx.fillStyle = colorToCss(t.color);
  ctx.fillText(t.text, t.boundary.x, t.boundary.y + t.fontSize);
  ctx.restore();
}

function drawPath(ctx: RendererContext, p: PathObject): void {
  ctx.save();
  ctx.beginPath();
  for (const cmd of p.d) {
    switch (cmd.op) {
      case 'M':
        ctx.moveTo(p.boundary.x + cmd.x, p.boundary.y + cmd.y);
        break;
      case 'L':
        ctx.lineTo(p.boundary.x + cmd.x, p.boundary.y + cmd.y);
        break;
      case 'C':
        ctx.bezierCurveTo(
          p.boundary.x + cmd.x1, p.boundary.y + cmd.y1,
          p.boundary.x + cmd.x2, p.boundary.y + cmd.y2,
          p.boundary.x + cmd.x,  p.boundary.y + cmd.y
        );
        break;
      case 'Q':
        ctx.quadraticCurveTo(
          p.boundary.x + cmd.x1, p.boundary.y + cmd.y1,
          p.boundary.x + cmd.x,  p.boundary.y + cmd.y
        );
        break;
      case 'Z':
        ctx.closePath();
        break;
    }
  }
  if (p.fill) {
    ctx.fillStyle = colorToCss(p.fill);
    ctx.fill();
  }
  if (p.stroke) {
    ctx.strokeStyle = colorToCss(p.stroke.color);
    ctx.lineWidth = p.stroke.width;
    ctx.stroke();
  }
  ctx.restore();
}

export function renderPage(
  ctx: RendererContext,
  page: Page,
  fonts: Record<string, FontFace>
): void {
  for (const obj of page.objects) {
    if (obj.type === 'text') {
      drawText(ctx, obj, resolveFont(obj.font, fonts));
    } else if (obj.type === 'path') {
      drawPath(ctx, obj);
    }
    // v1: image / composite skipped
  }
}
