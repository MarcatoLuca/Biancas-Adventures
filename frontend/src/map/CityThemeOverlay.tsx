import { useEffect } from 'react';
import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { Cluster } from './useClusteredPhotos';

interface CityThemeOverlayProps {
  map: MaplibreMap | null;
  clusters: Cluster[];
  themes: Record<string, { primary: string; secondary: string; accent: string }>;
}

const SOURCE_ID = 'city-theme-wash';
const LAYER_ID = 'city-theme-wash-layer';

export function CityThemeOverlay({ map, clusters, themes }: CityThemeOverlayProps) {
  useEffect(() => {
    if (!map) return;

    const features = clusters
      .flatMap((cluster) => cluster.photos.map((p) => ({ label: p.locationLabel, lat: cluster.latitude, lng: cluster.longitude })))
      .filter((f) => f.label && themes[f.label])
      .map((f) => ({
        type: 'Feature' as const,
        properties: { color: themes[f.label as string].primary },
        geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
      }));

    const geojson = { type: 'FeatureCollection' as const, features };

    if (map.getSource(SOURCE_ID)) {
      (map.getSource(SOURCE_ID) as GeoJSONSource).setData(geojson as any);
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson as any });
      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 80,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
          'circle-blur': 1,
        },
      });
    }
  }, [map, clusters, themes]);

  return null;
}
