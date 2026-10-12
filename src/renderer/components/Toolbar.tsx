import React from 'react';

type Props = {
  page: number;
  totalPages: number;
  zoom: number;
  onOpen: () => void;
  onExportPdf: () => void;
  onJump: (page: number) => void;
  onZoom: (zoom: number) => void;
  canExport: boolean;
};

export default function Toolbar({ page, totalPages, zoom, onOpen, onExportPdf, onJump, onZoom, canExport }: Props) {
  return (
    <div className="toolbar">
      <button onClick={onOpen}>打开 OFD</button>
      <button onClick={onExportPdf} disabled={!canExport}>导出 PDF</button>
      <span>{page} / {totalPages}</span>
      <input
        type="number"
        min={1}
        max={Math.max(1, totalPages)}
        value={page}
        onChange={e => {
          const v = +e.target.value;
          if (!Number.isNaN(v)) onJump(v);
        }}
      />
      <select value={zoom} onChange={e => onZoom(+e.target.value)}>
        <option value={1}>适应宽度</option>
        <option value={2}>100%</option>
        <option value={0.5}>50%</option>
        <option value={1.5}>150%</option>
      </select>
    </div>
  );
}
