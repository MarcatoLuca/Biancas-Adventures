import { describe, it, expect } from 'vitest';
import { pwaManifest } from '../../src/pwa/manifest';

describe('pwaManifest', () => {
  it('declares a standalone display mode and app name', () => {
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.name).toBe("Bianca's Adventures");
  });

  it('declares both required icon sizes', () => {
    const sizes = pwaManifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });
});
