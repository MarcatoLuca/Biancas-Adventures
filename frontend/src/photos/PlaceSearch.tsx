import { useEffect, useRef, useState, type FormEvent } from 'react';

interface Place {
  label: string;
  latitude: number;
  longitude: number;
}

function parsePlaces(data: unknown): Place[] {
  if (!Array.isArray(data)) throw new Error('invalid_places');
  return data.map((item: unknown) => {
    if (!item || typeof item !== 'object' ||
      !('display_name' in item) || typeof item.display_name !== 'string' || !item.display_name.trim() ||
      !('lat' in item) || typeof item.lat !== 'string' || !item.lat.trim() ||
      !('lon' in item) || typeof item.lon !== 'string' || !item.lon.trim()) throw new Error('invalid_place');
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error('invalid_coordinates');
    return { label: item.display_name, latitude, longitude };
  });
}

export function PlaceSearch({ disabled, onSelect }: { disabled: boolean; onSelect: (place: Place) => void }) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const lastRequest = useRef(0);
  const cache = useRef(new Map<string, Place[]>());
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function search(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (disabled || searching || term.length < 2) return;
    setError('');
    setMessage('');
    setPlaces([]);
    const cached = cache.current.get(term.toLocaleLowerCase());
    if (cached) {
      setPlaces(cached);
      setMessage(cached.length ? `${cached.length} risultati. Scegli una località.` : 'Nessuna località trovata. Prova con un nome più completo.');
      return;
    }
    if (Date.now() - lastRequest.current < 1100) {
      setMessage('Attendi un secondo prima di una nuova ricerca.');
      return;
    }
    lastRequest.current = Date.now();
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: term, format: 'jsonv2', limit: '5', 'accept-language': 'it' });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        signal: current.signal,
        credentials: 'omit',
        referrerPolicy: 'strict-origin-when-cross-origin',
      });
      if (!response.ok) throw new Error('place_search_failed');
      const results = parsePlaces(await response.json());
      if (current.signal.aborted) return;
      if (cache.current.size >= 30) cache.current.clear();
      cache.current.set(term.toLocaleLowerCase(), results);
      setPlaces(results);
      setMessage(results.length ? `${results.length} risultati. Scegli una località.` : 'Nessuna località trovata. Prova con un nome più completo.');
    } catch (err) {
      if (!current.signal.aborted) {
        console.error('Ricerca località non riuscita', err);
        setError('Ricerca località non disponibile. Riprova oppure scegli il punto sulla mappa o inserisci le coordinate.');
      }
    } finally {
      if (controller.current === current && !current.signal.aborted) setSearching(false);
    }
  }

  return (
    <form className="form-stack place-search" onSubmit={search} aria-label="Ricerca località">
      <label htmlFor="place-query">Cerca località</label>
      <div className="place-search-row">
        <input ref={inputRef} id="place-query" className="input" type="search" placeholder="Città, luogo o indirizzo" minLength={2} maxLength={200} required
          value={query} disabled={disabled} aria-describedby="place-search-help"
          onChange={(event) => {
            controller.current?.abort();
            setSearching(false);
            setQuery(event.target.value);
            setPlaces([]);
            setMessage('');
            setError('');
          }} />
        <button className="btn btn-secondary" type="submit" disabled={disabled || searching || query.trim().length < 2}>{searching ? 'Ricerca…' : 'Cerca'}</button>
      </div>
      <p className="field-help" id="place-search-help">Cerca e scegli un risultato per compilare le coordinate. Ricerca fornita da <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>.</p>
      <p role="status" className="field-help">{searching ? 'Ricerca località in corso…' : message}</p>
      {error && <p role="alert" className="notice notice-error">{error}</p>}
      {places.length > 0 && <ul className="place-results" aria-label="Località trovate">
        {places.map((place, index) => <li key={`${place.latitude}:${place.longitude}:${index}`}>
          <button type="button" className="btn btn-outline" disabled={disabled} onClick={() => {
            onSelect(place);
            setQuery(place.label);
            setPlaces([]);
            setMessage(`Posizione selezionata: ${place.label}. Conferma per salvarla.`);
            inputRef.current?.focus();
          }}>{place.label}</button>
        </li>)}
      </ul>}
    </form>
  );
}
