import type { StyleSpecification } from 'maplibre-gl';

export function buildMapStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      openfreemap: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#7fd4ff' },
      },
      {
        id: 'landcover-forest',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: { 'fill-color': '#3fb26a' },
      },
      {
        id: 'landuse-sand',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landuse',
        filter: ['==', ['get', 'class'], 'sand'],
        paint: { 'fill-color': '#ffe08a' },
      },
      {
        id: 'land',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'grass'],
        paint: { 'fill-color': '#7de08a' },
      },
      {
        id: 'water-fill',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'water',
        paint: { 'fill-color': '#3aa6ff' },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'building',
        paint: { 'fill-color': '#ffcf8a', 'fill-outline-color': '#e8944a' },
      },
    ],
  };
}
