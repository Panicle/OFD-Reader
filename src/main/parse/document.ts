import { parsePage } from './page-parser';
import type { Document } from '@shared/ir/types';

export async function parseDocument(filePath: string): Promise<Document> {
  const page = await parsePage(filePath, 0);
  return {
    pages: [page],
    fonts: {},
    totalPages: 1
  };
}
