import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Map as MaplibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildMapStyle } from './mapStyle';
import { useClusteredPhotos, type Cluster } from './useClusteredPhotos';
import { AlbumMarker } from './AlbumMarker';
import type { Photo } from '../photos/usePhotos';

interface MapViewProps {
  photos?: Photo[];
  onMapReady?: (map: MaplibreMap) => void;
  onOpenCluster?: (cluster: Cluster) => void;
}

const WORLD_BOUNDS: [number, number, number, number] = [-180, -85, 180, 85];

export function MapView({ photos = [], onMapReady, onOpenCluster }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Map<string, { marker: Marker; root: Root }>>(new Map());
  const [viewport, setViewport] = useState<{ zoom: number; bounds: [number, number, number, number] }>({
    zoom: 2,
    bounds: WORLD_BOUNDS,
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MaplibreMap({
      container: containerRef.current,
      style: buildMapStyle(),
      center: [12.5, 41.9],
      zoom: 2,
    });
    mapRef.current = map;

    function syncViewport() {
      const b = map.getBounds();
      setViewport({
        zoom: map.getZoom(),
        bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      });
    }

    map.on('load', () => {
      syncViewport();
      onMapReady?.(map);
    });
    map.on('moveend', syncViewport);

    return () => {
      map.off('moveend', syncViewport);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clusters = useClusteredPhotos(photos, viewport.zoom, viewport.bounds);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(clusters.map((c) => c.id));

    for (const [id, entry] of markersRef.current) {
      if (!currentIds.has(id)) {
        entry.root.unmount();
        entry.marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const cluster of clusters) {
      const existing = markersRef.current.get(cluster.id);
      if (existing) {
        existing.marker.setLngLat([cluster.longitude, cluster.latitude]);
        existing.root.render(
          <AlbumMarker cluster={cluster} onOpen={(c) => onOpenCluster?.(c)} />
        );
        continue;
      }

      const el = document.createElement('div');
      const root = createRoot(el);
      root.render(<AlbumMarker cluster={cluster} onOpen={(c) => onOpenCluster?.(c)} />);
      const marker = new Marker({ element: el })
        .setLngLat([cluster.longitude, cluster.latitude])
        .addTo(map);
      markersRef.current.set(cluster.id, { marker, root });
    }
  }, [clusters, onOpenCluster]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}
    />
  );
}
