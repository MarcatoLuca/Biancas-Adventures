type Color = readonly [number, number, number, number];

export function buildMapPatterns() {
  const size = 128;
  const waves = { width: size, height: size, data: new Uint8Array(size * size * 4) };
  const trees = { width: size, height: size, data: new Uint8Array(size * size * 4) };
  function pixel(image: typeof waves, x: number, y: number, color: Color) {
    image.data.set(color, (y * size + x) * 4);
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (const [cx, cy] of [[30, 34], [94, 98]]) {
        const dx = x - cx;
        const dy = y - cy;
        if (Math.abs(dx) < 17 && Math.abs(dy - 3 * Math.cos(dx / 5)) < 1.4) {
          pixel(waves, x, y, [227, 255, 249, 160]);
        }
        if (Math.abs(dx) <= 2 && dy >= 6 && dy <= 19) {
          pixel(trees, x, y, [112, 80, 52, 255]);
        }
        const canopy = (dx / 12) ** 2 + (dy / 14) ** 2;
        if (canopy < 1) {
          pixel(trees, x, y, canopy > 0.76 ? [44, 115, 77, 255] : [70, 151, 88, 255]);
          if (((dx + 4) / 5) ** 2 + ((dy + 5) / 6) ** 2 < 1) {
            pixel(trees, x, y, [140, 202, 109, 255]);
          }
        }
      }
    }
  }
  return { 'adventure-waves': waves, 'adventure-trees': trees };
}
