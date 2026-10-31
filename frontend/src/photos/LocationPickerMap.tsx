import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Map as MaplibreMap, Marker } from 'maplibre-gl';
import { buildMapStyle } from '../map/mapStyle';
import { Dialog } from '../ui/Dialog';
import { errorMessage } from '../lib/errorMessage';
import { PlaceSearch } from './PlaceSearch';

interface LocationPickerMapProps {
  initialLat: number | null;
  initialLng: number | null;
  onConfirm: (lat: number, lng: number) => void | Promise<void>;
  onCancel: () => void;
}

export function LocationPickerMap({ initialLat, initialLng, onConfirm, onCancel }: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [latitude, setLatitude] = useState(initialLat?.toString() ?? '');
  const [longitude, setLongitude] = useState(initialLng?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState(false);
  const lat = Number(latitude);
  const lng = Number(longitude);
  const valid = latitude.trim() !== '' && longitude.trim() !== '' &&
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

  useEffect(() => {
    if (!containerRef.current) return;
    let map: MaplibreMap;
    try {
      map = new MaplibreMap({
        container: containerRef.current,
        style: buildMapStyle(),
        center: [initialLng ?? 12.5, initialLat ?? 41.9],
        zoom: initialLat !== null ? 10 : 2,
        minZoom: 2,
        maxZoom: 16,
      });
    } catch (err) {
      console.error('Impossibile inizializzare la mappa di posizionamento', err);
      setMapError(true);
      return;
    }
    mapRef.current = map;
    map.on('error', () => setMapError(true));
    map.on('click', (event: { lngLat: { lat: number; lng: number } }) => {
      setLatitude(event.lngLat.lat.toFixed(6));
      setLongitude((((event.lngLat.lng + 180) % 360 + 360) % 360 - 180).toFixed(6));
    });
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, [initialLat, initialLng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !valid) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) markerRef.current = new Marker().setLngLat([lng, lat]).addTo(map);
    else markerRef.current.setLngLat([lng, lat]);
  }, [lat, lng, valid]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setError(null);
    setBusy(true);
    try {
      await onConfirm(lat, lng);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Scegli una posizione" onClose={onCancel} wide busy={busy}>
      <p className="muted">Cerca una località, tocca un punto sulla mappa oppure inserisci le coordinate. Conferma per salvare la posizione.</p>
      <PlaceSearch disabled={busy} onSelect={(place) => {
        setLatitude(String(place.latitude));
        setLongitude(String(place.longitude));
        setError(null);
        mapRef.current?.flyTo({ center: [place.longitude, place.latitude], zoom: 12, duration: 0 });
      }} />
      <div className="location-map" ref={containerRef} role="region" aria-label="Mappa per scegliere la posizione" />
      {mapError && <p role="status" className="notice">Mappa non disponibile. Puoi comunque cercare una località o inserire le coordinate qui sotto.</p>}
      <form className="form-stack" onSubmit={save} aria-busy={busy}>
        <div className="coordinate-fields">
          <label htmlFor="latitude">Latitudine
            <input id="latitude" type="number" step="any" min="-90" max="90" required className="input" value={latitude} onChange={(event) => setLatitude(event.target.value)} aria-describedby="coordinates-help" disabled={busy} />
          </label>
          <label htmlFor="longitude">Longitudine
            <input id="longitude" type="number" step="any" min="-180" max="180" required className="input" value={longitude} onChange={(event) => setLongitude(event.target.value)} aria-describedby="coordinates-help" disabled={busy} />
          </label>
        </div>
        <p id="coordinates-help" className="field-help">Latitudine da −90 a 90, longitudine da −180 a 180. Esempio: Roma 41.9028, 12.4964.</p>
        {error && <p role="alert" className="notice notice-error">{error}</p>}
        <div className="button-row">
          <button type="submit" className="btn btn-success" disabled={!valid || busy}>{busy ? 'Salvataggio…' : 'Conferma posizione'}</button>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Annulla</button>
        </div>
      </form>
    </Dialog>
  );
}
