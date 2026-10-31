import { describe, expect, it } from 'vitest';
import { buildMapStyle } from '../../src/map/mapStyle';
import { buildMapPatterns } from '../../src/map/mapPatterns';

describe('illustrated map textures', () => {
  it('adds illustrated textures above terrain while keeping place names legible', () => {
    const layers = buildMapStyle().layers.filter((layer) => layer.type === 'fill' && layer.paint?.['fill-pattern']);
    expect(layers.length).toBeGreaterThanOrEqual(2);
    const style = buildMapStyle();
    const labels = style.layers.findIndex((layer) => layer.id === 'place-labels');
    expect(style.layers.every((layer, index) => layer.type !== 'fill' || !layer.paint?.['fill-pattern'] || index < labels)).toBe(true);
  });

  it('supplies sparse transparent RGBA textures for all referenced illustrations', () => {
    const patterns = buildMapPatterns();
    for (const layer of buildMapStyle().layers) {
      if (layer.type !== 'fill' || !layer.paint?.['fill-pattern']) continue;
      const name = layer.paint['fill-pattern'];
      expect(typeof name).toBe('string');
      expect(Object.hasOwn(patterns, String(name))).toBe(true);
      const image = patterns[name as keyof typeof patterns];
      expect(image.data.length).toBe(image.width * image.height * 4);
      const alpha = image.data.filter((_, index) => index % 4 === 3);
      expect(alpha.some((value) => value > 0)).toBe(true);
      expect(alpha.filter((value) => value === 0).length).toBeGreaterThan(alpha.length / 2);
    }
  });
});
