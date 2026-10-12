import React, { useEffect, useRef } from 'react';
import { renderPage } from '../ir/canvas-renderer';
import type { Page as IrPage, FontFace } from '@shared/ir/types';

type Props = {
  page: IrPage;
  fonts: Record<string, FontFace>;
  zoom: number;
};

export default function PageView({ page, fonts, zoom }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth - 48 : 600;
    // zoom 1 → fit width; zoom 0.5 → 50%; zoom 2 → 100%
    const scale = zoom === 1 ? parentWidth / page.width : zoom === 2 ? 1 : zoom;
    canvas.width = page.width * scale * dpr;
    canvas.height = page.height * scale * dpr;
    canvas.style.width = `${page.width * scale}px`;
    canvas.style.height = `${page.height * scale}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    renderPage(ctx as unknown as Parameters<typeof renderPage>[0], page, fonts);
  }, [page, fonts, zoom]);

  return <canvas ref={canvasRef} />;
}
