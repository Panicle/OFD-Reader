import yauzl from 'yauzl';

export type OfdZip = yauzl.ZipFile;

export type EntryInfo = { name: string; size: number };

export function openOfd(filePath: string): Promise<OfdZip> {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err);
      resolve(zip);
    });
  });
}

export function listEntries(zip: OfdZip): Promise<EntryInfo[]> {
  return new Promise((resolve, reject) => {
    const entries: EntryInfo[] = [];
    zip.on('entry', (e) => {
      entries.push({ name: e.fileName, size: e.uncompressedSize });
      zip.readEntry();
    });
    zip.on('end', () => resolve(entries));
    zip.on('error', reject);
    zip.readEntry();
  });
}

export function readEntry(zip: OfdZip, name: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const onEntry = (e: yauzl.Entry) => {
      if (e.fileName === name) {
        zip.removeListener('entry', onEntry);
        zip.openReadStream(e, (err, stream) => {
          if (err || !stream) return reject(err);
          const chunks: Buffer[] = [];
          stream.on('data', (c) => chunks.push(c as Buffer));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        });
      } else {
        zip.readEntry();
      }
    };
    zip.on('entry', onEntry);
    zip.on('end', () => reject(new Error(`entry not found: ${name}`)));
    zip.on('error', reject);
    zip.readEntry();
  });
}
