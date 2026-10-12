import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  openDocument: () => ipcRenderer.invoke('document:open'),
  exportPdf: (filePath: string) => ipcRenderer.invoke('document:export-pdf', filePath)
});
