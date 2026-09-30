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
        paint: { 'background-color': '#bfe6ff' },
      },
      {
        id: 'landcover-forest',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: { 'fill-color': '#3f8f4f' },
      },
      {
        id: 'landuse-sand',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landuse',
        filter: ['==', ['get', 'class'], 'sand'],
        paint: { 'fill-color': '#f4d35e' },
      },
      {
        id: 'land',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'grass'],
        paint: { 'fill-color': '#8fce6b' },
      },
      {
        id: 'water-fill',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'water',
        paint: { 'fill-color': '#4aa8d8' },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'building',
        paint: { 'fill-color': '#d9a679', 'fill-outline-color': '#8a5a35' },
      },
    ],
  };
}
