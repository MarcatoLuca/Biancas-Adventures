import type { StyleSpecification } from 'maplibre-gl';

export function buildMapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
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
        paint: { 'background-color': '#b9df8b' },
      },
      {
        id: 'landcover-forest',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: { 'fill-color': '#88c987', 'fill-outline-color': '#72b879' },
      },
      {
        id: 'landuse-sand',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'sand'],
        paint: { 'fill-color': '#f8dfa0' },
      },
      {
        id: 'land',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'grass'],
        paint: { 'fill-color': '#c5e799' },
      },
      {
        id: 'water-fill',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'water',
        paint: { 'fill-color': '#65cbd2' },
      },
      {
        id: 'coastline',
        type: 'line',
        source: 'openfreemap',
        'source-layer': 'water',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#fff0bd',
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.5, 6, 4, 12, 7],
        },
      },
      {
        id: 'water-waves',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'water',
        paint: { 'fill-pattern': 'adventure-waves', 'fill-opacity': 0.65 },
      },
      {
        id: 'forest-trees',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landcover',
        minzoom: 5,
        filter: ['==', ['get', 'class'], 'wood'],
        paint: {
          'fill-pattern': 'adventure-trees',
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0, 7, 0.85],
        },
      },
      {
        id: 'boundaries',
        type: 'line',
        source: 'openfreemap',
        'source-layer': 'boundary',
        filter: ['==', ['get', 'admin_level'], 2],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#73975b', 'line-width': 1.2, 'line-dasharray': [2, 4], 'line-opacity': 0.55 },
      },
      {
        id: 'place-labels',
        type: 'symbol',
        source: 'openfreemap',
        'source-layer': 'place',
        filter: ['match', ['get', 'class'], ['country', 'city', 'town'], true, false],
        layout: {
          'text-field': ['coalesce', ['get', 'name:it'], ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 12, 12, 17],
          'text-max-width': 8,
          'text-letter-spacing': 0.04,
          'text-padding': 12,
        },
        paint: { 'text-color': '#405d4d', 'text-halo-color': '#fffbed', 'text-halo-width': 2.5 },
      },
    ],
  };
}
