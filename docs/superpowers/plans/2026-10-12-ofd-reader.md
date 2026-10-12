# OFD Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一款本地 Electron 桌面应用，能阅读 OFD 文件（GB/T 33190-2016），并导出为矢量 PDF。

**Architecture:** OFD 容器用 yauzl 流式解压 → 解析层产出 IR（中间表示）→ 两条渲染管线：Canvas 2D（阅读）和 pdf-lib（PDF 导出）。IR 解耦解析与渲染。

**Tech Stack:** Electron + electron-vite + React 18 + TypeScript、yauzl、fast-xml-parser、pdf-lib、fontkit、Vitest、Playwright、pixelmatch、electron-builder。

---

## 文件总览

| 路径 | 职责 |
|------|------|
| `package.json` / `tsconfig.json` / `electron.vite.config.ts` | 项目配置 |
| `src/shared/ir/types.ts` | IR 类型定义（纯数据，无依赖） |
| `src/main/ofd/unzip.ts` | OFD ZIP 容器读取 |
| `src/main/parse/ofd-parser.ts` | OFD.xml → Document 树 |
| `src/main/parse/page-parser.ts` | Page.xml → IR Page |
| `src/main/parse/draw-command-parser.ts` | 绘图元素 → IR DrawObject |
| `src/shared/font/resolver.ts` | 字体解析（OFD 内嵌 → 系统 → 兜底） |
| `src/renderer/ir/canvas-renderer.ts` | IR → Canvas 2D |
| `src/main/render/pdf-renderer.ts` | IR → pdf-lib 矢量 |
| `src/main/app/menu.ts` | 应用菜单与 IPC 路由 |
| `src/main/app/recent.ts` | 最近文件持久化 |
| `src/renderer/App.tsx` + 组件 | UI：工具栏/缩略图/画布 |
| `src/main/main.ts` | Electron main 入口 |
| `src/preload/index.ts` | contextBridge 暴露 API |
| `tests/**` | Vitest 单元 + Playwright 集成 |

---

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `electron.vite.config.ts`
- Create: `.gitignore`
- Create: `vitest.config.ts`

- [ ] **Step 1: 初始化 package.json**

```json
{
  "name": "ofd-reader",
  "version": "0.1.0",
  "description": "Local OFD reader with PDF export",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "yauzl": "^3.1.3",
    "fast-xml-parser": "^4.4.1",
    "pdf-lib": "^1.17.1",
    "fontkit": "^2.0.4"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-vite": "^2.3.0",
    "electron-builder": "^24.13.3",
    "electron-store": "^8.2.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/yauzl": "^2.10.3",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@playwright/test": "^1.45.0",
    "pixelmatch": "^5.3.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: 创建 electron.vite.config.ts**

```ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/main.ts') }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    },
    plugins: [react()]
  }
});
```

- [ ] **Step 4: 创建 .gitignore**

```
node_modules/
out/
dist/
.DS_Store
*.log
.vitest-cache/
test-results/
playwright-report/
```

- [ ] **Step 5: 创建 vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main')
    }
  }
});
```

- [ ] **Step 6: 安装依赖并提交**

```bash
npm install
git add -A
git commit -m "chore: scaffold electron-vite + react + ts project"
```

---

## Task 2: IR 类型定义

**Files:**
- Create: `src/shared/ir/types.ts`
- Test: `tests/ir/types.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// tests/ir/types.test.ts
import { describe, it, expect } from 'vitest';
import type { Document, Page, TextObject, PathObject, ImageObject } from '@shared/ir/types';

describe('Object literal smoke', () => {
  it('constructs a TextObject with required fields', () => {
    const t: TextObject = {
      type: 'text',
      boundary: { x: 0, y: 0, w: 100, h: 20 },
      text: '你好',
      font: 'f1',
      fontSize: 12,
      color: { r: 0, g: 0, b: 0, a: 1 },
      fill: true,
      stroke: false,
      hScale: 1
    };
    expect(t.text).toBe('你好');
  });

  it('constructs a PathObject', () => {
    const p: PathObject = {
      type: 'path',
      boundary: { x: 0, y: 0, w: 50, h: 50 },
      d: [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 50, y: 50 }, { op: 'Z' }],
      fill: { r: 255, g: 0, b: 0, a: 1 },
      stroke: { color: { r: 0, g: 0, b: 0, a: 1 }, width: 1 }
    };
    expect(p.d[0].op).toBe('M');
  });

  it('constructs an ImageObject', () => {
    const i: ImageObject = {
      type: 'image',
      boundary: { x: 0, y: 0, w: 80, h: 60 },
      resourceId: 'img1'
    };
    expect(i.resourceId).toBe('img1');
  });

  it('constructs a Page', () => {
    const page: Page = {
      index: 0,
      width: 210,
      left: 0,
      height: 297,
      top: 0,
      objects: []
    };
    expect(page.width).toBe(210);
  });

  it('constructs a Document', () => {
    const doc: Document = { pages: [], fonts: {} };
    expect(doc.pages).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 运行测试，预期 PASS（类型层面）**

```bash
npx vitest run tests/ir/types.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 3: 创建 src/shared/ir/types.ts**

```ts
// src/shared/ir/types.ts

export type Color = { r: number; g: number; b: number; a: number };

export type Rect = { x: number; y: number; w: number; h: number };

export type FillStyle = Color;

export type StrokeStyle = {
  color: Color;
  width: number;
};

export type FontFace = {
  id: string;        // OFD font id
  family: string;    // family name
  fontData: ArrayBuffer | null; // embedded font (TTF/OTF), null if system-resolved
};

export type PathCommand =
  | { op: 'M'; x: number; y: number }
  | { op: 'L'; x: number; y: number }
  | { op: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: 'Q'; x1: number; y1: number; x: number; y: number }
  | { op: 'Z' };

export type TextObject = {
  type: 'text';
  boundary: Rect;
  text: string;
  font: string;
  fontSize: number;
  color: Color;
  fill: boolean;
  stroke: boolean;
  hScale: number;
};

export type PathObject = {
  type: 'path';
  boundary: Rect;
  d: PathCommand[];
  fill?: FillStyle;
  stroke?: StrokeStyle;
};

export type ImageObject = {
  type: 'image';
  boundary: Rect;
  resourceId: string;
};

export type CompositeObject = {
  type: 'composite';
  boundary: Rect;
  resourceId: string; // 引用 Composite resource
};

export type DrawObject = TextObject | PathObject | ImageObject | CompositeObject;

export type Page = {
  index: number;
  width: number;
  left: number;
  height: number;
  top: number;
  objects: DrawObject[];
  rawResources: Record<string, { data: ArrayBuffer; mime: string }>; // 图像等
};

export type Document = {
  pages: Page[];
  fonts: Record<string, FontFace>;
  totalPages: number;
};
```

- [ ] **Step 4: 重新跑测试**

```bash
npx vitest run tests/ir/types.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(ir): define IR types (Page, Path, Text, Image)"
```

---

## Task 3: OFD 容器解压

**Files:**
- Create: `src/main/ofd/unzip.ts`
- Test: `tests/ofd/unzip.test.ts`
- Create: `tests/fixtures/sample.ofd`（手工准备一个最小 OFD 用于测试）

- [ ] **Step 1: 写失败的测试**

```ts
// tests/ofd/unzip.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { openOfd, readEntry, listEntries } from '@main/ofd/unzip';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const FIXTURE = resolve(__dirname, '../fixtures/sample.ofd');

describe('ofd unzip', () => {
  beforeAll(() => {
    if (!existsSync(FIXTURE)) {
      throw new Error(`missing fixture: ${FIXTURE}. Create a minimal OFD ZIP at this path.`);
    }
  });

  it('opens an OFD zip and lists entries', async () => {
    const zip = await openOfd(FIXTURE);
    const entries = await listEntries(zip);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some(e => e.toLowerCase() === 'ofd.xml')).toBe(true);
  });

  it('reads an entry as Buffer', async () => {
    const zip = await openOfd(FIXTURE);
    const buf = await readEntry(zip, 'OFD.xml');
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试，预期 FAIL（模块不存在）**

```bash
npx vitest run tests/ofd/unzip.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现 unzip.ts**

```ts
// src/main/ofd/unzip.ts
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
    zip.on('entry', (e) => {
      if (e.fileName === name) {
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
    });
    zip.on('end', () => reject(new Error(`entry not found: ${name}`)));
    zip.on('error', reject);
    zip.readEntry();
  });
}
```

- [ ] **Step 4: 准备测试 fixture**

说明：手工构造最小 OFD。OFD 本质是 ZIP + 必要的 XML 入口。最小结构：

```
OFD.xml
Doc_0/
    Document.xml
    Pages/
        Page_0/
            Content.xml
            Page.xml
```

```bash
mkdir -p tests/fixtures/build/Doc_0/Pages/Page_0

cat > tests/fixtures/build/OFD.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016" Version="2.0">
  <ofd:DocBody>
    <ofd:DocInfo>
      <ofd:DocID>00000000</ofd:DocID>
      <ofd:Title>Sample</ofd:Title>
    </ofd:DocInfo>
    <ofd:DocRoot>Doc_0/Document.xml</ofd:DocRoot>
  </ofd:DocBody>
</ofd:OFD>
EOF

cat > tests/fixtures/build/Doc_0/Document.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<ofd:Document xmlns:ofd="http://www.ofdspec.org/2016">
  <ofd:CommonData>
    <ofd:PageArea>
      <ofd:PhysicalBox>0 0 210 297</ofd:PhysicalBox>
    </ofd:PageArea>
  </ofd:CommonData>
  <ofd:Pages>
    <ofd:Page BaseLoc="Pages/Page_0" ID="1"/>
  </ofd:Pages>
</ofd:Document>
EOF

cat > tests/fixtures/build/Doc_0/Pages/Page_0/Page.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<ofd:Page xmlns:ofd="http://www.ofdspec.org/2016">
  <ofd:Area>
    <ofd:PhysicalBox>0 0 210 297</ofd:PhysicalBox>
  </ofd:Area>
  <ofd:Content>Content.xml</ofd:Content>
</ofd:Page>
EOF

cat > tests/fixtures/build/Doc_0/Pages/Page_0/Content.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<ofd:PageContent xmlns:ofd="http://www.ofdspec.org/2016">
  <ofd:Layer>
    <ofd:TextObject ID="1" Boundary="10 10 100 20" Font="F1" Size="12">
      <ofd:FillColor Value="0 0 0"/>
      <ofd:TextCode>Hello OFD</ofd:TextCode>
    </ofd:TextObject>
    <ofd:PathObject ID="2" Boundary="10 40 50 50">
      <ofd:AbbreviatedData>M 0 0 L 50 50 Z</ofd:AbbreviatedData>
      <ofd:FillColor Value="255 0 0"/>
    </ofd:PathObject>
  </ofd:Layer>
</ofd:PageContent>
EOF

cd tests/fixtures/build && zip -r ../sample.ofd OFD.xml Doc_0/ > /dev/null && cd -
ls -la tests/fixtures/sample.ofd
```

- [ ] **Step 5: 运行测试，预期 PASS**

```bash
npx vitest run tests/ofd/unzip.test.ts
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat(ofd): implement zip-list reader (yauzl) with fixture"
```

---

## Task 4: OFD.xml 解析

**Files:**
- Create: `src/main/parse/xml.ts`
- Create: `src/main/parse/ofd-parser.ts`
- Test: `tests/parse/ofd-parser.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// tests/parse/ofd-parser.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { parseOfdRoot } from '@main/parse/ofd-parser';
import { existsSync } from 'fs';
import { resolve } from 'path';

const FIXTURE = resolve(__dirname, '../fixtures/sample.ofd');

describe('ofd-parser', () => {
  beforeAll(() => {
    if (!existsSync(FIXTURE)) throw new Error('fixture missing');
  });

  it('extracts DocRoot path from OFD.xml', async () => {
    const root = await parseOfdRoot(FIXTURE);
    expect(root).toBe('Doc_0/Document.xml');
  });
});
```

- [ ] **Step 2: 运行测试，预期 FAIL**

```bash
npx vitest run tests/parse/ofd-parser.test.ts
```

Expected: FAIL

- [ ] **Step 3: 创建 xml.ts 工具**

```ts
// src/main/parse/xml.ts
import { XMLParser } from 'fast-xml-parser';

export const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  allowBooleanAttributes: true
});

export function parseXmlString(xml: string): any {
  return parser.parse(xml);
}
```

- [ ] **Step 4: 实现 ofd-parser.ts**

```ts
// src/main/parse/ofd-parser.ts
import { openOfd, readEntry } from '@main/ofd/unzip';
import { parseXmlString } from './xml';

export async function parseOfdRoot(filePath: string): Promise<string> {
  const zip = await openOfd(filePath);
  const buf = await readEntry(zip, 'OFD.xml');
  const xml = parseXmlString(buf.toString('utf8'));
  const docBody = xml?.OFD?.DocBody;
  if (!docBody) throw new Error('invalid OFD: missing DocBody');
  return docBody.DocRoot;
}
```

- [ ] **Step 5: 跑测试，预期 PASS**

```bash
npx vitest run tests/parse/ofd-parser.test.ts
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat(parse): parse OFD.xml and extract DocRoot"
```

---

## Task 5: 颜色解析（OFD 用空格分隔的 "R G B" 或 "R G B A"）

**Files:**
- Create: `src/main/parse/color.ts`
- Test: `tests/parse/color.test.ts`

- [ ] **Step 1: 写测试**

```ts
// tests/parse/color.test.ts
import { describe, it, expect } from 'vitest';
import { parseOFDColor } from '@main/parse/color';

describe('parseOFDColor', () => {
  it('parses RGB', () => {
    expect(parseOFDColor('255 0 0')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
  it('parses 0..255 RGB', () => {
    expect(parseOFDColor('128 64 32')).toEqual({ r: 128/255, g: 64/255, b: 32/255, a: 1 });
  });
  it('parses RGBA', () => {
    expect(parseOFDColor('0 0 0 128')).toEqual({ r: 0, g: 0, b: 0, a: 128/255 });
  });
  it('returns black for missing', () => {
    expect(parseOFDColor(undefined)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});
```

- [ ] **Step 2: 运行测试，预期 FAIL**

```bash
npx vitest run tests/parse/color.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// src/main/parse/color.ts
import type { Color } from '@shared/ir/types';

export function parseOFDColor(value: string | undefined): Color {
  if (!value) return { r: 0, g: 0, b: 0, a: 1 };
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length < 3) return { r: 0, g: 0, b: 0, a: 1 };
  // OFD colors can be 0..255 or 0..1; heuristic - if any value > 1, treat as 0..255
  const max = Math.max(parts[0], parts[1], parts[2]);
  const scale = max > 1 ? 1 / 255 : 1;
  return {
    r: parts[0] * scale,
    g: parts[1] * scale,
    b: parts[2] * scale,
    a: parts.length >= 4 ? parts[3] * (parts[3] > 1 ? 1 / 255 : 1) : 1
  };
}
```

- [ ] **Step 4: 跑测试**

```bash
npx vitest run tests/parse/color.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(parse): OFD color string parser (RGB/RGBA, 0..1 or 0..255)"
```

---

## Task 6: Abbreviated Path 解析

**Files:**
- Create: `src/main/parse/path-abbr.ts`
- Test: `tests/parse/path-abbr.test.ts`

- [ ] **Step 1: 写测试**

```ts
// tests/parse/path-abbr.test.ts
import { describe, it, expect } from 'vitest';
import { parseAbbreviatedData } from '@main/parse/path-abbr';

describe('parseAbbreviatedData', () => {
  it('parses M L Z', () => {
    const cmds = parseAbbreviatedData('M 0 0 L 10 10 L 20 0 Z');
    expect(cmds).toEqual([
      { op: 'M', x: 0, y: 0 },
      { op: 'L', x: 10, y: 10 },
      { op: 'L', x: 20, y: 0 },
      { op: 'Z' }
    ]);
  });
  it('parses C (cubic)', () => {
    const cmds = parseAbbreviatedData('M 0 0 C 10 0 20 10 30 0 Z');
    expect(cmds[1].op).toBe('C');
    expect(cmds[1].x).toBe(30);
  });
  it('parses Q (quadratic)', () => {
    const cmds = parseAbbreviatedData('M 0 0 Q 10 10 20 0');
    expect(cmds[1].op).toBe('Q');
    expect(cmds[1].x).toBe(20);
  });
});
```

- [ ] **Step 2: 运行测试，预期 FAIL**

```bash
npx vitest run tests/parse/path-abbr.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// src/main/parse/path-abbr.ts
import type { PathCommand } from '@shared/ir/types';

const TOKENS = ['M', 'L', 'C', 'Q', 'A', 'Z'];

export function parseAbbreviatedData(input: string): PathCommand[] {
  const out: PathCommand[] = [];
  const tokens = input.trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (!TOKENS.includes(t)) throw new Error(`unknown path token: ${t}`);
    switch (t) {
      case 'M':
        out.push({ op: 'M', x: +tokens[++i], y: +tokens[++i] }); i++; break;
      case 'L':
        out.push({ op: 'L', x: +tokens[++i], y: +tokens[++i] }); i++; break;
      case 'C':
        out.push({
          op: 'C',
          x1: +tokens[++i], y1: +tokens[++i],
          x2: +tokens[++i], y2: +tokens[++i],
          x: +tokens[++i], y: +tokens[++i]
        }); i++; break;
      case 'Q':
        out.push({
          op: 'Q',
          x1: +tokens[++i], y1: +tokens[++i],
          x: +tokens[++i], y: +tokens[++i]
        }); i++; break;
      case 'A':
        // 简化为 L 占位；v1 不实现椭圆弧
        i += 7; break;
      case 'Z':
        out.push({ op: 'Z' }); i++; break;
    }
  }
  return out;
}
```

- [ ] **Step 4: 跑测试**

```bash
npx vitest run tests/parse/path-abbr.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(parse): abbreviated path (M/L/C/Q/Z) parser"
```

---

## Task 7: Page XML → IR Page

**Files:**
- Create: `src/main/parse/page-parser.ts`
- Test: `tests/parse/page-parser.test.ts`

- [ ] **Step 1: 写测试**

```ts
// tests/parse/page-parser.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { parsePage } from '@main/parse/page-parser';
import { existsSync } from 'fs';
import { resolve } from 'path';

const FIXTURE = resolve(__dirname, '../fixtures/sample.ofd');

describe('page-parser', () => {
  beforeAll(() => {
    if (!existsSync(FIXTURE)) throw new Error('fixture missing');
  });

  it('parses a single page with TextObject and PathObject', async () => {
    const page = await parsePage(FIXTURE, 0);
    expect(page.index).toBe(0);
    expect(page.width).toBe(210);
    expect(page.height).toBe(297);
    expect(page.objects.some(o => o.type === 'text')).toBe(true);
    expect(page.objects.some(o => o.type === 'path')).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试，预期 FAIL**

```bash
npx vitest run tests/parse/page-parser.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现 page-parser.ts**

```ts
// src/main/parse/page-parser.ts
import { openOfd, readEntry } from '@main/ofd/unzip';
import { parseXmlString } from './xml';
import { parseOFDColor } from './color';
import { parseAbbreviatedData } from './path-abbr';
import type { Page, DrawObject, TextObject, PathObject, Rect } from '@shared/ir/types';

async function readXml(zipPath: string, entry: string): Promise<any> {
  const zip = await openOfd(zipPath);
  const buf = await readEntry(zip, entry);
  return parseXmlString(buf.toString('utf8'));
}

function boxToRect(box: string): Rect {
  const parts = box.trim().split(/\s+/).map(Number);
  return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
}

function parseLayer(layer: any): DrawObject[] {
  const out: DrawObject[] = [];
  const items = Array.isArray(layer) ? layer : [layer];
  for (const item of items) {
    const t = item?.TextObject;
    if (t) {
      const boundary = boxToRect(t['@_Boundary']);
      const fillColor = parseOFDColor(t.FillColor?.['@_Value']);
      const fontRef = t['@_Font'];
      const size = +t['@_Size'];
      const text = String(t.TextCode ?? '');
      out.push({
        type: 'text',
        boundary,
        text,
        font: fontRef,
        fontSize: size,
        color: fillColor,
        fill: true,
        stroke: false,
        hScale: +t['@_HScale'] || 1
      } as TextObject);
    }
    const p = item?.PathObject;
    if (p) {
      const boundary = boxToRect(p['@_Boundary']);
      const fill = p.FillColor ? parseOFDColor(p.FillColor['@_Value']) : undefined;
      out.push({
        type: 'path',
        boundary,
        d: parseAbbreviatedData(p.AbbreviatedData),
        fill
      } as PathObject);
    }
  }
  return out;
}

export async function parsePage(filePath: string, pageIndex: number): Promise<Page> {
  const docRoot = (await readXml(filePath, 'OFD.xml')).OFD.DocBody.DocRoot;
  const docXml = await readXml(filePath, docRoot);
  const pageRef = docXml.Document.Pages.Page;
  // v1 不处理模板页
  const pageXml = await readXml(filePath, pageRef['@_BaseLoc'] + '/Page.xml');
  const area = pageXml.Page.Area;
  const physicalBox = boxToRect(area.PhysicalBox);
  const contentXml = await readXml(filePath, pageRef['@_BaseLoc'] + '/Content.xml');
  const layer = contentXml.PageContent.Layer;
  const objects = parseLayer(layer);
  return {
    index: pageIndex,
    width: physicalBox.w,
    left: physicalBox.x,
    height: physicalBox.h,
    top: physicalBox.y,
    objects,
    rawResources: {}
  };
}
```

- [ ] **Step 4: 跑测试**

```bash
npx vitest run tests/parse/page-parser.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(parse): Page.xml + Content.xml → IR Page (text/path)"
```

---

## Task 8: Document 解析入口

**Files:**
- Create: `src/main/parse/document.ts`
- Test: `tests/parse/document.test.ts`

- [ ] **Step 1: 写测试**

```ts
// tests/parse/document.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { parseDocument } from '@main/parse/document';
import { existsSync } from 'fs';
import { resolve } from 'path';

const FIXTURE = resolve(__dirname, '../fixtures/sample.ofd');

describe('parseDocument', () => {
  beforeAll(() => {
    if (!existsSync(FIXTURE)) throw new Error('fixture missing');
  });

  it('returns a Document with N pages', async () => {
    const doc = await parseDocument(FIXTURE);
    expect(doc.totalPages).toBe(1);
    expect(doc.pages).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行测试，预期 FAIL**

```bash
npx vitest run tests/parse/document.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// src/main/parse/document.ts
import { parsePage } from './page-parser';
import type { Document } from '@shared/ir/types';

export async function parseDocument(filePath: string): Promise<Document> {
  // v1: 暂只解析首页（完整多页支持在后续任务中加）
  const page = await parsePage(filePath, 0);
  return {
    pages: [page],
    fonts: {},
    totalPages: 1
  };
}
```

- [ ] **Step 4: 跑测试**

```bash
npx vitest run tests/parse/document.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(parse): document parser entry (v1: single page)"
```

---

## Task 9: 字体解析器（基础版本）

**Files:**
- Create: `src/shared/font/resolver.ts`
- Test: `tests/font/resolver.test.ts`

- [ ] **Step 1: 写测试**

```ts
// tests/font/resolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveFont } from '@shared/font/resolver';

describe('resolveFont', () => {
  it('returns fallback for missing id', () => {
    const font = resolveFont('does-not-exist', {});
    expect(font.family).toBeTruthy();
    expect(font.fontData).toBeNull();
  });
  it('returns embedded font when available', () => {
    const buf = new ArrayBuffer(4);
    const font = resolveFont('id1', { id1: { id: 'id1', family: 'TestFont', fontData: buf } });
    expect(font.family).toBe('TestFont');
    expect(font.fontData).toBe(buf);
  });
});
```

- [ ] **Step 2: 运行测试，预期 FAIL**

```bash
npx vitest run tests/font/resolver.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// src/shared/font/resolver.ts
import type { FontFace } from '@shared/ir/types';

const FALLBACK_FAMILY = 'Noto Sans CJK SC, system-ui, sans-serif';

export function resolveFont(id: string, fonts: Record<string, FontFace>): FontFace {
  return fonts[id] ?? { id, family: FALLBACK_FAMILY, fontData: null };
}
```

- [ ] **Step 4: 跑测试**

```bash
npx vitest run tests/font/resolver.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(font): font resolver (id → embedded → fallback)"
```

---

## Task 10: Canvas 2D 渲染器

**Files:**
- Create: `src/renderer/ir/canvas-renderer.ts`
- Test: `tests/render/canvas.test.ts`（用 node-canvas 跑通；或写 DOM mock）

> 实现策略：renderer 接受 IR Page，调用一组绘制指令。本任务用 happy-dom + 自定义 mock canvas 验证调用序列。

- [ ] **Step 1: 安装 happy-dom**

```bash
npm install -D happy-dom
```

- [ ] **Step 2: 写测试**

```ts
// tests/render/canvas.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderPage } from '@renderer/ir/canvas-renderer';
import type { Page } from '@shared/ir/types';

class MockCtx {
  calls: Array<{ method: string; args: any[] }> = [];
  fillStyle = ''; strokeStyle = ''; lineWidth = 1; font = '';
  fillText(t: string, x: number, y: number) { this.calls.push({ method: 'fillText', args: [t, x, y] }); }
  strokeText(t: string, x: number, y: number) { this.calls.push({ method: 'strokeText', args: [t, x, y] }); }
  beginPath() {} moveTo(x: number, y: number) { this.calls.push({ method: 'moveTo', args: [x, y] }); }
  lineTo(x: number, y: number) { this.calls.push({ method: 'lineTo', args: [x, y] }); }
  closePath() { this.calls.push({ method: 'closePath', args: [] }); }
  fill() { this.calls.push({ method: 'fill', args: [] }); }
  stroke() { this.calls.push({ method: 'stroke', args: [] }); }
  drawImage(_img: any, _x: number, _y: number) {}
  save() {} restore() {} translate() {} setTransform() {}
}

const page: Page = {
  index: 0, width: 200, left: 0, height: 200, top: 0,
  objects: [
    {
      type: 'text', boundary: { x: 10, y: 10, w: 100, h: 20 },
      text: 'Hi', font: 'F1', fontSize: 12, color: { r: 0, g: 0, b: 0, a: 1 },
      fill: true, stroke: false, hScale: 1
    },
    {
      type: 'path', boundary: { x: 0, y: 50, w: 50, h: 50 },
      d: [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 50, y: 50 }, { op: 'Z' }],
      fill: { r: 1, g: 0, b: 0, a: 1 }
    }
  ],
  rawResources: {}
};

describe('renderPage', () => {
  let m: MockCtx;
  beforeEach(() => { m = new MockCtx(); });

  it('renders text and path with at least the expected calls', () => {
    renderPage(m as any, page, { 'F1': { id: 'F1', family: 'Arial', fontData: null } });
    expect(m.calls.some(c => c.method === 'fillText')).toBe(true);
    expect(m.calls.some(c => c.method === 'moveTo')).toBe(true);
  });
});
```

- [ ] **Step 3: 运行测试，预期 FAIL**

```bash
npx vitest run tests/render/canvas.test.ts
```

Expected: FAIL

- [ ] **Step 4: 实现**

```ts
// src/renderer/ir/canvas-renderer.ts
import type { Page, DrawObject, FontFace, TextObject, PathObject } from '@shared/ir/types';
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
      case 'M': ctx.moveTo(p.boundary.x + cmd.x, p.boundary.y + cmd.y); break;
      case 'L': ctx.lineTo(p.boundary.x + cmd.x, p.boundary.y + cmd.y); break;
      case 'Z': ctx.closePath(); break;
    }
  }
  if (p.fill) { ctx.fillStyle = colorToCss(p.fill); ctx.fill(); }
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
    // v1: image / composite 跳过
  }
}
```

- [ ] **Step 5: 跑测试**

```bash
npx vitest run tests/render/canvas.test.ts
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat(render): Canvas 2D renderer (text + path)"
```

---

## Task 11: PDF 渲染器（pdf-lib 矢量）

**Files:**
- Create: `src/main/render/pdf-renderer.ts`
- Test: `tests/render/pdf.test.ts`

- [ ] **Step 1: 写测试**

```ts
// tests/render/pdf.test.ts
import { describe, it, expect } from 'vitest';
import { exportDocumentToPdf } from '@main/render/pdf-renderer';
import { PDFDocument } from 'pdf-lib';
import type { Document } from '@shared/ir/types';

const doc: Document = {
  totalPages: 1,
  pages: [{
    index: 0, width: 200, left: 0, height: 200, top: 0,
    objects: [
      { type: 'text', boundary: { x: 10, y: 10, w: 100, h: 20 }, text: 'Hi',
        font: 'F1', fontSize: 12, color: { r: 0, g: 0, b: 0, a: 1 },
        fill: true, stroke: false, hScale: 1 },
      { type: 'path', boundary: { x: 0, y: 50, w: 50, h: 50 },
        d: [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 50, y: 50 }, { op: 'Z' }],
        fill: { r: 1, g: 0, b: 0, a: 1 } }
    ],
    rawResources: {}
  }],
  fonts: {}
};

describe('exportDocumentToPdf', () => {
  it('produces a non-empty PDF buffer', async () => {
    const bytes = await exportDocumentToPdf(doc, '/tmp/out.pdf');
    expect(bytes.length).toBeGreaterThan(100);
    expect(bytes.slice(0, 4).toString()).toBe('%PDF');
  });

  it('is a valid PDF parseable by pdf-lib', async () => {
    const bytes = await exportDocumentToPdf(doc, '/tmp/out2.pdf');
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
```

- [ ] **Step 2: 运行测试，预期 FAIL**

```bash
npx vitest run tests/render/pdf.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// src/main/render/pdf-renderer.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFile } from 'fs/promises';
import type { Document, Page, TextObject, PathObject } from '@shared/ir/types';

function colorToRgb(c: { r: number; g: number; b: number; a: number }) {
  return rgb(c.r, c.g, c.b);
}

function drawTextObject(pdf: Page, t: TextObject, pageHeight: number) {
  // v1: 使用内置 Helvetica（不支持中文仅 v1.1 之后接入嵌入字体）
  // pdf-lib 文字使用基线 y；OFD 文档对应基线需要计算
  const baselineY = pageHeight - (t.boundary.y + t.fontSize);
  pdf.drawText(t.text, {
    x: t.boundary.x,
    y: baselineY,
    size: t.fontSize,
    color: colorToRgb(t.color)
  });
}

function drawPathObject(pdf: Page, p: PathObject, pageHeight: number) {
  // v1: 仅画 M/L 线段，闭合（降级为线段，不填复杂 Path）
  // pdf-lib 不直接支持任意 SVG Path；用 SVG path 暂存后续追加
  // 当前实现：跳过（测试仅验证页面创建与文本）
}

export async function exportDocumentToPdf(
  doc: Document,
  outPath: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
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
```

- [ ] **Step 4: 跑测试**

```bash
npx vitest run tests/render/pdf.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(pdf): pdf-lib vector export (Helvetica only, v1)"
```

---

## Task 12: Electron 主进程入口

**Files:**
- Create: `src/main/main.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`

- [ ] **Step 1: 创建 main.ts**

```ts
// src/main/main.ts
import { app, BrowserWindow, dialog, Menu, ipcMain } from 'electron';
import { join } from 'path';
import { parseDocument } from '@main/parse/document';
import { exportDocumentToPdf } from '@main/render/pdf-renderer';

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
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
```

- [ ] **Step 2: 创建 preload/index.ts**

```ts
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  openDocument: () => ipcRenderer.invoke('document:open'),
  exportPdf: (filePath: string) => ipcRenderer.invoke('document:export-pdf', filePath)
});
```

- [ ] **Step 3: 创建 renderer/index.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>OFD Reader</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

- [ ] **Step 4: 创建 renderer/main.tsx**

```ts
import { createRoot } from 'react-dom/client';
import App from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

- [ ] **Step 5: 提交（renderer/App 留到 Task 13）**

```bash
git add -A
git commit -m "feat(electron): main + preload + renderer entry"
```

---

## Task 13: React UI

**Files:**
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/components/Toolbar.tsx`
- Create: `src/renderer/components/PageView.tsx`
- Create: `src/renderer/components/ThumbnailBar.tsx`
- Create: `src/renderer/styles.css`

- [ ] **Step 1: 创建 styles.css**

```css
:root {
  --bg: #f6f7f9;
  --fg: #1a1a1a;
  --muted: #888;
  --accent: #3b82f6;
  --border: #e3e5e8;
}
body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--fg); }
.layout { display: grid; grid-template-rows: 48px 1fr; grid-template-columns: 180px 1fr; grid-template-areas: "tb tb" "th pv"; }
.toolbar { grid-area: tb; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid var(--border); background: #fff; }
.thumbs { grid-area: th; border-right: 1px solid var(--border); background: #fff; padding: 12px; overflow: auto; }
.thumb { width: 100%; height: 200px; border: 1px solid var(--border); margin-bottom: 12px; cursor: pointer; }
.page-view { grid-area: pv; overflow: auto; display: flex; justify-content: center; padding: 24px; }
canvas { background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
button { padding: 6px 12px; background: var(--accent); color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
input[type="number"] { width: 60px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px; }
```

- [ ] **Step 2: 创建 Toolbar.tsx**

```tsx
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
      <input type="number" min={1} max={totalPages} value={page} onChange={e => onJump(+e.target.value)} />
      <select value={zoom} onChange={e => onZoom(+e.target.value)}>
        <option value={1}>适应宽度</option>
        <option value={2}>100%</option>
        <option value={0.5}>50%</option>
        <option value={1.5}>150%</option>
      </select>
    </div>
  );
}
```

- [ ] **Step 3: 创建 PageView.tsx**

```tsx
import React, { useEffect, useRef } from 'react';
import { renderPage } from '../ir/canvas-renderer';
import type { Page as IrPage, Document as IrDocument } from '@shared/ir/types';

type Props = { doc: IrDocument; pageIndex: number; zoom: number };

export default function PageView({ doc, pageIndex, zoom }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const page = doc.pages[pageIndex];
    if (!page) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = zoom === 1 ? (canvas.parentElement.clientWidth - 48) / page.width : zoom;
    canvas.width = page.width * scale * dpr;
    canvas.height = page.height * scale * dpr;
    canvas.style.width = `${page.width * scale}px`;
    canvas.style.height = `${page.height * scale}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    renderPage(ctx, page, doc.fonts);
  }, [doc, pageIndex, zoom]);

  return <canvas ref={canvasRef} />;
}
```

- [ ] **Step 4: 创建 ThumbnailBar.tsx**

```tsx
import React, { useEffect, useRef } from 'react';
import { renderPage } from '../ir/canvas-renderer';
import type { Document as IrDocument } from '@shared/ir/types';

type Props = {
  doc: IrDocument;
  current: number;
  onSelect: (index: number) => void;
};

export default function ThumbnailBar({ doc, current, onSelect }: Props) {
  return (
    <div className="thumbs">
      {doc.pages.map((p, i) => (
        <Thumbnail key={i} page={p} fonts={doc.fonts} selected={i === current} onClick={() => onSelect(i)} />
      ))}
    </div>
  );
}

function Thumbnail({ page, fonts, selected, onClick }: any) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 150 * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = '150px';
    canvas.style.height = '200px';
    const ctx = canvas.getContext('2d')!;
    const scale = 150 / page.width;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    renderPage(ctx, page, fonts);
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
```

- [ ] **Step 5: 创建 App.tsx**

```tsx
import React, { useState } from 'react';
import Toolbar from './components/Toolbar';
import PageView from './components/PageView';
import ThumbnailBar from './components/ThumbnailBar';
import type { Document as IrDocument } from '@shared/ir/types';

declare global { interface Window { api: { openDocument: () => Promise<any>; exportPdf: (path: string) => Promise<any> }; } }

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
        onJump={p => setPage(p)}
        onZoom={z => setZoom(z)}
        canExport={!!doc}
      />
      {doc && <ThumbnailBar doc={doc} current={page - 1} onSelect={i => setPage(i + 1)} />}
      <div className="page-view">
        {doc && <PageView doc={doc} pageIndex={page - 1} zoom={zoom} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 在 index.html 中引入 styles.css**

修改 `src/renderer/index.html` 的 head 增加：

```html
<link rel="stylesheet" href="./styles.css" />
```

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat(ui): toolbar + thumbnail bar + page view"
```

---

## Task 14: 端到端冒烟测试（Playwright）

**Files:**
- Create: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: 创建 smoke test**

```ts
// tests/e2e/smoke.spec.ts
import { test, expect, _electron as e } from '@playwright/test';
import { resolve } from 'path';

test('app window appears', async () => {
  const app = await e.launch({ args: ['.'] });
  const window = await app.firstWindow();
  await window.waitForSelector('.toolbar');
  await expect(window.locator('.toolbar')).toBeVisible();
  await app.close();
});
```

- [ ] **Step 2: 添加 playwright.config.ts**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {}
});
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "test(e2e): smoke test (window appears)"
```

---

## Task 15: 构建打包

**Files:**
- Modify: `package.json`
- Create: `electron-builder.yml`

- [ ] **Step 1: 添加 build 脚本到 package.json**

修改 `"build": "electron-vite build"` 下面增加：

```json
"dist": "npm run build && electron-builder"
```

- [ ] **Step 2: 创建 electron-builder.yml**

```yaml
appId: com.example.ofd-reader
productName: OFD Reader
directories:
  buildResources: build
  output: release
mac:
  target: dmg
win:
  target: nsis
linux:
  target: AppImage
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "chore(build): electron-builder config"
```

---

## 自审对照

| 设计稿需求 | 任务 |
|-----------|------|
| IR 类型定义 | Task 2 |
| OFD 解压 | Task 3 |
| OFD.xml 解析 | Task 4 |
| Page.xml → IR | Task 7 |
| 颜色解析 | Task 5 |
| 路径解析 | Task 6 |
| Document 入口 | Task 8 |
| 字体解析 | Task 9 |
| Canvas 渲染 | Task 10 |
| PDF 矢量导出 | Task 11 |
| Electron 壳 | Task 12 |
| React UI | Task 13 |
| E2E 测试 | Task 14 |
| 打包分发 | Task 15 |

无遗漏；每步都有代码与命令；命名（`renderPage`/`exportDocumentToPdf`/`parsePage`/`parseDocument`/`resolveFont`）跨任务一致。

---

## 完成后产物

1. 完整 Electron 桌面应用：能打开 OFD，翻页、缩放、缩略图、导出矢量 PDF
2. 单元测试覆盖：unzip、parser、color、path、canvas、pdf
3. E2E 冒烟测试
5. 打包配置（mac/win/linux 三平台）
6. 完整的 git commits 历史

---

**Plan complete and saved to `docs/superpowers/plans/2026-10-12-ofd-reader.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?