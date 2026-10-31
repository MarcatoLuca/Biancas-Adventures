import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const createMap = vi.hoisted(() => vi.fn());
vi.mock('maplibre-gl', () => ({
  Map: class {
    constructor(options: unknown) { createMap(options); }
    on() {}
    off() {}
    remove() {}
  },
}));

import { MapView } from '../../src/map/MapView';

it('configures main map zoom limits for all MapLibre interactions', () => {
  render(<MapView />);
  expect(createMap).toHaveBeenCalledWith(expect.objectContaining({ minZoom: 2, maxZoom: 9, zoom: 2 }));
});
