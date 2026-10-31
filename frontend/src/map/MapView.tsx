import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Map as MaplibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildMapStyle } from './mapStyle';
import { buildMapPatterns } from './mapPatterns';
import { useClusteredPhotos, type Cluster } from './useClusteredPhotos';
import { AlbumMarker } from './AlbumMarker';
import type { Photo } from '../photos/usePhotos';

interface MapViewProps {
  photos?: Photo[];
  onMapReady?: (map: MaplibreMap | null) => void;
  onOpenCluster?: (cluster: Cluster) => void;
}

const WORLD_BOUNDS: [number, number, number, number] = [-180, -85, 180, 85];

export function MapView({ photos = [], onMapReady, onOpenCluster }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Map<string, { marker: Marker; root: Root }>>(new Map());
  const [mapInstance, setMapInstance] = useState<MaplibreMap | null>(null);
  const [mapError, setMapError] = useState(false);
  const fitted = useRef(false);
  const [viewport, setViewport] = useState<{ zoom: number; bounds: [number, number, number, number] }>({
    zoom: 2,
    bounds: WORLD_BOUNDS,
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: MaplibreMap;
    try {
      map = new MaplibreMap({
        container: containerRef.current,
        style: buildMapStyle(),
        center: [12.5, 41.9],
        zoom: 2,
        minZoom: 2,
        maxZoom: 9,
        attributionControl: { compact: false },
      });
    } catch (error) {
      console.error('Impossibile inizializzare la mappa dei ricordi', error);
      setMapError(true);
      return;
    }
    mapRef.current = map;
    const markers = markersRef.current;
    const patterns = buildMapPatterns();
    map.on('styleimagemissing', ({ id }) => {
      if (Object.hasOwn(patterns, id) && !map.hasImage(id)) {
        map.addImage(id, patterns[id as keyof typeof patterns], { pixelRatio: 2 });
      }
    });
    map.on('error', () => setMapError(true));

    function syncViewport() {
      const b = map.getBounds();
      setViewport({
        zoom: map.getZoom(),
        bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      });
    }

    map.on('load', () => {
      syncViewport();
      setMapInstance(map);
      onMapReady?.(map);
    });
    map.on('moveend', syncViewport);

    return () => {
      onMapReady?.(null);
      for (const entry of markers.values()) {
        queueMicrotask(() => entry.root.unmount());
        entry.marker.remove();
      }
      markers.clear();
      map.off('moveend', syncViewport);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clusters = useClusteredPhotos(photos, viewport.zoom, viewport.bounds);

  useEffect(() => {
    const placed = photos.filter((photo) => photo.latitude !== null && photo.longitude !== null);
    if (!mapInstance || fitted.current || placed.length === 0) return;
    fitted.current = true;
    const longitudes = placed.map((photo) => photo.longitude!);
    const latitudes = placed.map((photo) => photo.latitude!);
    mapInstance.fitBounds(
      [[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]],
      { padding: 70, maxZoom: 9, animate: false },
    );
  }, [mapInstance, photos]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapInstance) return;

    const currentIds = new Set(clusters.map((c) => c.id));

    for (const [id, entry] of markersRef.current) {
      if (!currentIds.has(id)) {
        queueMicrotask(() => entry.root.unmount());
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
  }, [clusters, onOpenCluster, mapInstance]);

  return (
    <div className="map-wrapper">
      <div ref={containerRef} className="adventure-map" role="region" aria-label="Mappa delle foto. Puoi usare anche la galleria per esplorare tutti i ricordi." />
      {mapError && <p role="status" className="map-error notice">La mappa non è disponibile. Tutte le foto e la modifica delle posizioni restano accessibili dalla galleria.</p>}
    </div>
  );
}
