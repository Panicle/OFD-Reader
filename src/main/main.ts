import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'path';
import { parseDocument } from '@main/parse/document';
import { exportDocumentToPdf } from '@main/render/pdf-renderer';

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(createWindow);

ipcMain.handle('document:open', async () => {
  const res = await dialog.showOpenDialog({
    filters: [{ name: 'OFD', extensions: ['ofd'] }],
    properties: ['openFile']
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  const filePath = res.filePaths[0];
  const doc = await parseDocument(filePath);
  return { filePath, doc };
});

ipcMain.handle('document:export-pdf', async (_e, filePath: string) => {
  const doc = await parseDocument(filePath);
  const out = await dialog.showSaveDialog({
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (out.canceled || !out.filePath) return null;
  const bytes = await exportDocumentToPdf(doc, out.filePath);
  return { path: out.filePath, size: bytes.length };
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
