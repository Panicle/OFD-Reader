import React, { useEffect, useRef } from 'react';
import { renderPage } from '../ir/canvas-renderer';
import type { Page as IrPage, FontFace } from '@shared/ir/types';

type Props = {
  pages: IrPage[];
  fonts: Record<string, FontFace>;
  current: number;
  onSelect: (index: number) => void;
};

export default function ThumbnailBar({ pages, fonts, current, onSelect }: Props) {
  return (
    <div className="thumbs">
      {pages.map((p, i) => (
        <Thumbnail key={i} page={p} fonts={fonts} selected={i === current} onClick={() => onSelect(i)} />
      ))}
    </div>
  );
}

function Thumbnail({ page, fonts, selected, onClick }: {
  page: IrPage;
  fonts: Record<string, FontFace>;
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 150 * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = '150px';
    canvas.style.height = '200px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = 150 / page.width;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    renderPage(ctx as unknown as Parameters<typeof renderPage>[0], page, fonts);
  }, [page, fonts]);
  return (
    <canvas
      ref={ref}
      className="thumb"
      style={{ outline: selected ? '2px solid var(--accent)' : 'none' }}
      onClick={onClick}
    />
  );
}
