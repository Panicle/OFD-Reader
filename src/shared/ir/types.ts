// OFD IR (Intermediate Representation) - shared types between parse and render layers.

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