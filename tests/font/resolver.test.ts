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

  it('fallback family includes CJK font', () => {
    const font = resolveFont('x', {});
    expect(font.family).toContain('Noto Sans CJK');
  });
});
