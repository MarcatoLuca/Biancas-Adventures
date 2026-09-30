import { useEffect, useRef, useState } from 'react';
import { Map as MaplibreMap, Marker } from 'maplibre-gl';
import { buildMapStyle } from '../map/mapStyle';

interface LocationPickerMapProps {
  initialLat: number | null;
  initialLng: number | null;
  onConfirm: (lat: number, lng: number) => void;
  onCancel: () => void;
}

export function LocationPickerMap({ initialLat, initialLng, onConfirm, onCancel }: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [picked, setPicked] = useState<[number, number] | null>(
    initialLat !== null && initialLng !== null ? [initialLat, initialLng] : null
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MaplibreMap({
      container: containerRef.current,
      style: buildMapStyle(),
      center: [initialLng ?? 12.5, initialLat ?? 41.9],
      zoom: initialLat !== null ? 10 : 1.5,
    });
    mapRef.current = map;
    map.on('load', () => {
      map.on('click', (e: { lngLat: { lat: number; lng: number } }) => {
        const { lat, lng } = e.lngLat;
        setPicked([lat, lng]);
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = new Marker().setLngLat([lng, lat]).addTo(map);
      });
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLat, initialLng]);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <button className="btn btn-ghost" style={{ background: 'white' }} onClick={onCancel}>
          Annulla
        </button>
        <button
          className="btn btn-success"
          disabled={!picked}
          style={{ opacity: picked ? 1 : 0.5 }}
          onClick={() => picked && onConfirm(picked[0], picked[1])}
        >
          📍 Conferma posizione
        </button>
      </div>
    </div>
  );
}
