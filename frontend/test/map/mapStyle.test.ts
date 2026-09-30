import { describe, it, expect } from 'vitest';
import { buildMapStyle } from '../../src/map/mapStyle';

describe('buildMapStyle', () => {
  it('uses the OpenFreeMap vector source', () => {
    const style = buildMapStyle();
    expect(style.sources.openfreemap).toMatchObject({
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    });
  });

  it('defines flat, saturated biome colors for water and landcover layers', () => {
    const style = buildMapStyle();
    const water = style.layers.find((l) => l.id === 'water-fill');
    const forest = style.layers.find((l) => l.id === 'landcover-forest');
    expect(water).toBeDefined();
    expect(forest).toBeDefined();
    expect((water as any).paint['fill-color']).toMatch(/^#/);
    expect((forest as any).paint['fill-color']).toMatch(/^#/);
  });

  it('omits detailed road/POI label layers for a clean cartoon look', () => {
    const style = buildMapStyle();
    const hasRoadLabels = style.layers.some((l) => l.id.includes('road-label'));
    expect(hasRoadLabels).toBe(false);
  });
});
