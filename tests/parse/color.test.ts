import { describe, it, expect } from 'vitest';
import { parseOFDColor } from '@main/parse/color';

describe('parseOFDColor', () => {
  it('parses 0..1 RGB', () => {
    expect(parseOFDColor('1 0 0')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('parses 0..255 RGB', () => {
    expect(parseOFDColor('128 64 32')).toEqual({ r: 128/255, g: 64/255, b: 32/255, a: 1 });
  });

  it('parses RGBA with 0..255 alpha', () => {
    expect(parseOFDColor('0 0 0 128')).toEqual({ r: 0, g: 0, b: 0, a: 128/255 });
  });

  it('parses RGBA with 0..1 alpha', () => {
    expect(parseOFDColor('1 0 0 0.5')).toEqual({ r: 1, g: 0, b: 0, a: 0.5 });
  });

  it('returns black for missing value', () => {
    expect(parseOFDColor(undefined)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(parseOFDColor('')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('returns black for malformed input', () => {
    expect(parseOFDColor('not a color')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});
