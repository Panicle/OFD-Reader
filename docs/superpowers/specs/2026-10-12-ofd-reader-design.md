# OFD Reader 设计稿

**日期**: 2026-10-12
**状态**: 已批准，等待进入实施阶段
**作者**: superpowers brainstorming

## 1. 目标

构建一款本地桌面应用，能打开符合 GB/T 33190-2016 标准的 OFD（Open Fixed-layout Document）文件，提供翻页、缩放、缩略图导航，并将 OFD 导出为矢量 PDF。

## 2. 应用形态

- **形态**: Electron 桌面应用
- **前端**: React + TypeScript（electron-vite 模板）
- **目标 OS**: Windows / macOS / Linux

## 3. 核心思路: IR 中间表示

解析层只输出 IR（与渲染目标解耦的数据结构），渲染目标（Canvas / PDF）各自实现"IR → 自己 API"的转换器。

```text
OFD 文件 → 解析器 → IR (Page/TextRun/Path/Image)
                          ├──→ Canvas 2D 渲染 (Renderer 进程)
                          └──→ pdf-lib 矢量输出 (Main 进程)
```

## 4. 模块拆分

| 模块 | 路径（建议） | 职责 | 依赖 |
|------|-------------|------|------|
| `ofd/unzip` | `src/main/ofd/unzip.ts` | 打开 OFD 容器，列出/读取条目 | yauzl |
| `parse/ofd-parser` | `src/main/parse/ofd-parser.ts` | 解析 `OFD.xml`，得到 Document 树 | unzip, fast-xml-parser |
| `parse/page-parser` | `src/main/parse/page-parser.ts` | 解析 `Page.xml` 与模板页，得到 IR Page | unzip, fast-xml-parser |
| `parse/draw-command-parser` | `src/main/parse/draw-command-parser.ts` | 解析 TextObject / PathObject / ImageObject / Composite | ofd-reader |
| `ir/types` | `src/shared/ir/types.ts` | IR 数据结构定义 | — |
| `render/canvas-renderer` | `src/renderer/ir/canvas-renderer.ts` | IR → Canvas 2D 绘图指令 | ir, fontkit |
| `render/pdf-renderer` | `src/main/render/pdf-renderer.ts` | IR → pdf-lib 矢量绘制 | ir, fontkit, pdf-lib |
| `render/font-resolver` | `src/shared/font/resolver.ts` | OFD 内嵌字体优先，系统字体回退 | fs |
| `app/menu` | `src/main/app/menu.ts` | 应用菜单（打开 / 导出 / 最近） | electron |
| `app/recent` | `src/main/app/recent.ts` | 最近文件列表持久化 | electron-store |

每个模块设计目标 ≤ 300 行；模块通过清晰接口通信；可单独测试。

## 5. IR 数据结构（核心）

```ts
type Document = {
  pages: Page[];
  fonts: Record<string, FontFace>;
};

type Page = {
  index: number;
  width: number;   // 物理像素（基于 PageXML 的 Area)
  left: number;
  height: number;
  top: number;
  objects: DrawObject[];
};

type DrawObject =
  | TextObject | PathObject | ImageObject | CompositeObject;

type TextObject = {
  type: 'text';
  boundary: Rect;
  text: string;
  font: string;       // 引用 Document.fonts key
  fontSize: number;
  color: Color;
  fill: boolean;
  stroke: boolean;
  hScale: number;     // OFD 文字水平缩放
  // ...其他 OFD TextObject 属性（Read only 字段）
};

type PathObject = {
  type: 'path';
  boundary: Rect;
  d: PathCommand[];   // M / L / C / Q / Z 等
  fill?: FillStyle;
  stroke?: StrokeStyle;
};

type ImageObject = {
  type: 'image';
  boundary: Rect;
  resourceId: string; // 引用 Document 解析时预加载的图像
};
```

## 6. 数据流

```text
用户拖入 / 菜单打开 .ofd
  → Main: dialog.showOpenDialog → 文件路径
  → Main: unzip 打开 → 解析 OFD.xml → Document IR
  → 对每页解析 → Page IR（含字体、图片资源句柄）
  → IPC `document:loaded` → Renderer 收到 IR 引用
  → Renderer: 渲染当前页（Canvas 2D）+ 生成缩略图
  → 用户翻页/搜索 → Renderer 重新渲染
  → 用户点「导出 PDF」
    → Main: 取 IR → pdf-renderer → pdf-lib 写出
    → dialog.showSaveDialog → 写入 .pdf
```

## 7. UI 设计

```text
┌────────────────────────────────────────────┐
│  OFD Reader    [打开] [导出PDF]  1 / 5    │  ← 工具栏
├──────┬─────────────────────────────────────┤
│ 缩略 │                                     │
│  栏  │       Canvas 渲染区域               │
│      │       （单页居中、可滚动）         │
│ [1]  │                                     │
│ [2]  │                                     │
│ [3]  │                                     │
└──────┴─────────────────────────────────────┘
```

- 工具栏：打开、导出 PDF、页码输入、缩放控件（适应宽度 / 100% / 50-200%）
- 左侧缩略图栏：每页一张缩略图（Canvas 渲染），点击跳转
- 主区：单页 Canvas 渲染、可滚动

## 8. 错误处理

| 场景 | 处理 |
|------|------|
| 打开非 ZIP / 缺 OFD.xml | 弹错误对话框「不是有效的 OFD 文件」 |
| 缺字体 | 查字体解析器返回 null，使用浏览器默认字体，console.warn |
| 不支持/未知图形 | Canvas 跳过并 warn；PDF 输出该元素降级为位图 |
| 用户中断导出 | 清理流，删除半成品 PDF |
| 单页解析失败 | 该页显示占位「此页无法渲染」，其他页继续 |
| 主进程崩溃 | Renderer 监听 IPC 失败，给错误提示 |

## 9. 测试策略

- **单元测试 (Vitest)**：每个 parser 单元独立，用真实样本断言 IR 形状
- **黄金测试**：3-5 个真实电子发票样本，截图与参考比对（pixelmatch）
- **PDF 转换测试**：导出 PDF 后用 `pdf-parse` 提取文字，中文可还原
- **集成测试 (Playwright)**：打开 → 翻页 → 导出 全流程

## 10. 技术栈与依赖

| 用途 | 选型 | 理由 |
|------|------|------|
| Electron 壳 | electron-vite + TS | 现代、热更新、TS 一等公民 |
| OFD 解压 | yauzl | 纯流式、低内存 |
| XML 解析 | fast-xml-parser | 快、API 简单 |
| Canvas 渲染 | 原生 Canvas 2D | 零依赖 |
| PDF 输出 | pdf-lib | 纯 JS、矢量输出、内嵌字体 |
| 字体 | fontkit (嵌入) + 内置 Noto Sans CJK SC 兜底 | 中文字体 |
| 测试 | Vitest + Playwright + pixelmatch | 全 JS 工具链 |
| 状态 | React useState/useReducer | 应用简单，不上 Redux |
| 持久化 | electron-store | 最近文件列表 |

## 11. 范围

### 包含 (v1.0)

- 打开 OFD 文件、显示页数、翻页（上一页/下一页/页码跳转）
- 缩放（适应宽度 / 100% / 50%-200%）
- 缩略图栏
- 导出矢量 PDF（含内嵌字体）
- 错误提示与基础降级

### 不包含 (v1.0 之后)

- 文本搜索、注释、表单填写
- 数字签名验签
- 多文档对比
- 暗色主题（可后续加）

## 12. 风险与对策

| 风险 | 概率 | 对策 |
|------|------|------|
| OFD 标准实现差异（实际发票有非标扩展） | 中 | IR 设计保留 `read_value`/`extra` 字段宽容扩展；提供样本测试 |
| 中文字体版权与体积 | 中 | 默认嵌入 Noto Sans CJK SC；用户提供自定义字体目录 |
| 复杂 Path/Composite 渲染耗时 | 低 | 离屏 Canvas 缓存；分页懒解析 |
| 大 OFD 内存占用 | 低 | 流式解压，不一次性加载全部图片 |