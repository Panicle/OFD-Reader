import React, { useState } from 'react';
import Toolbar from './components/Toolbar';
import PageView from './components/PageView';
import ThumbnailBar from './components/ThumbnailBar';
import type { Document as IrDocument } from '@shared/ir/types';

declare global {
  interface Window {
    api: {
      openDocument: () => Promise<{ filePath: string; doc: IrDocument } | null>;
      exportPdf: (filePath: string) => Promise<{ path: string; size: number } | null>;
    };
  }
}

export default function App() {
  const [doc, setDoc] = useState<IrDocument | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);

  async function onOpen() {
    const res = await window.api.openDocument();
    if (!res) return;
    setDoc(res.doc);
    setFilePath(res.filePath);
    setPage(1);
  }

  async function onExport() {
    if (!filePath) return;
    await window.api.exportPdf(filePath);
  }

  return (
    <div className="layout">
      <Toolbar
        page={page}
        totalPages={doc?.totalPages ?? 0}
        zoom={zoom}
        onOpen={onOpen}
        onExportPdf={onExport}
        onJump={p => setPage(Math.max(1, Math.min(p, doc?.totalPages ?? 1)))}
        onZoom={z => setZoom(z)}
        canExport={!!doc}
      />
      {doc && <ThumbnailBar pages={doc.pages} fonts={doc.fonts} current={page - 1} onSelect={i => setPage(i + 1)} />}
      <div className="page-view">
        {doc && doc.pages[page - 1] && (
          <PageView page={doc.pages[page - 1]} fonts={doc.fonts} zoom={zoom} />
        )}
      </div>
    </div>
  );
}
