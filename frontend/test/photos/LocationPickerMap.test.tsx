import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

const flyTo = vi.hoisted(() => vi.fn());
const createMap = vi.hoisted(() => vi.fn());

vi.mock('maplibre-gl', () => {
  const handlers: Record<string, (e: any) => void> = {};
  class MapMock {
    constructor(options: unknown) { createMap(options); }
    flyTo = flyTo;
    on(event: string, cb: (e: any) => void) {
      handlers[event] = cb;
      if (event === 'load') cb({});
    }
    remove() {}
  }
  class MarkerMock {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }
  return { Map: MapMock, Marker: MarkerMock };
});

import { LocationPickerMap } from '../../src/photos/LocationPickerMap';

describe('LocationPickerMap', () => {
  it('limits picker zoom while allowing more precise positioning than the main map', () => {
    render(<LocationPickerMap initialLat={null} initialLng={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(createMap).toHaveBeenLastCalledWith(expect.objectContaining({ minZoom: 2, maxZoom: 16, zoom: 2 }));
  });
  it('renders confirm and cancel controls', () => {
    render(<LocationPickerMap initialLat={null} initialLng={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /conferma/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /annulla/i })).toBeInTheDocument();
  });

  it('disables confirm until a point has been picked', () => {
    render(<LocationPickerMap initialLat={null} initialLng={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /conferma/i })).toBeDisabled();
  });

  it('enables confirm immediately when an initial position is provided', () => {
    render(<LocationPickerMap initialLat={41.9} initialLng={12.5} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /conferma/i })).not.toBeDisabled();
  });

  it('calls onCancel when cancel is pressed', () => {
    const onCancel = vi.fn();
    render(<LocationPickerMap initialLat={null} initialLng={null} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /annulla/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('allows placing a photo without interacting with the map', async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    render(<LocationPickerMap initialLat={null} initialLng={null} onConfirm={confirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/latitudine/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/longitudine/i), { target: { value: '12.5' } });
    fireEvent.click(screen.getByRole('button', { name: /conferma/i }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(0, 12.5));
  });

  it('rejects invalid coordinates and reports save errors without closing', async () => {
    const confirm = vi.fn().mockRejectedValue(new Error('could_not_update_location'));
    render(<LocationPickerMap initialLat={41.9} initialLng={12.5} onConfirm={confirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/latitudine/i), { target: { value: '91' } });
    expect(screen.getByRole('button', { name: /conferma/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/latitudine/i), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: /conferma/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/posizione/i));
    expect(screen.getByRole('button', { name: /conferma/i })).toBeEnabled();
  });

  it('searches explicitly and selects coordinates without saving until confirmed', async () => {
    const fetchPlaces = vi.fn().mockResolvedValue({
      ok: true, json: async () => [{ lat: '45.4642', lon: '9.19', display_name: 'Milano, Lombardia, Italia' }],
    });
    vi.stubGlobal('fetch', fetchPlaces);
    const confirm = vi.fn();
    render(<LocationPickerMap initialLat={null} initialLng={null} onConfirm={confirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Cerca località'), { target: { value: 'Milano' } });
    expect(fetchPlaces).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cerca', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Milano, Lombardia, Italia' }));
    expect(screen.getByLabelText('Latitudine')).toHaveValue(45.4642);
    expect(screen.getByLabelText('Longitudine')).toHaveValue(9.19);
    expect(flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [9.19, 45.4642] }));
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /conferma posizione/i }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(45.4642, 9.19));
  });

  it.each([
    ['empty', true, [], /nessuna località/i],
    ['service failure', false, null, /ricerca.*non disponibile/i],
    ['invalid response', true, [{ lat: 'abc', lon: '9', display_name: 'Errore' }], /ricerca.*non disponibile/i],
  ])('reports %s without changing existing coordinates', async (_, ok, body, message) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => body }));
    render(<LocationPickerMap initialLat={42} initialLng={12} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Cerca località'), { target: { value: 'Roma' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerca', exact: true }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText('Latitudine')).toHaveValue(42);
    expect(screen.getByLabelText('Longitudine')).toHaveValue(12);
    if (!ok || body?.length) expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('ignores a search response after the query changes', async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((done) => { resolve = done; })));
    render(<LocationPickerMap initialLat={null} initialLng={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Cerca località'), { target: { value: 'Roma' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerca', exact: true }));
    fireEvent.change(screen.getByLabelText('Cerca località'), { target: { value: 'Torino' } });
    await act(async () => {
      resolve({ ok: true, json: async () => [{ lat: '42', lon: '12', display_name: 'Roma, Italia' }] });
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Roma, Italia' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Latitudine')).toHaveValue(null);
  });

  it('reuses search results without another request and accepts zero coordinates', async () => {
    const fetchPlaces = vi.fn().mockResolvedValue({
      ok: true, json: async () => [{ lat: '0', lon: '0', display_name: 'Golfo di Guinea' }],
    });
    vi.stubGlobal('fetch', fetchPlaces);
    render(<LocationPickerMap initialLat={null} initialLng={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Cerca località'), { target: { value: 'Golfo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerca', exact: true }));
    await screen.findByRole('button', { name: 'Golfo di Guinea' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerca', exact: true }));
    expect(fetchPlaces).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Golfo di Guinea' }));
    expect(screen.getByLabelText('Latitudine')).toHaveValue(0);
    expect(screen.getByLabelText('Longitudine')).toHaveValue(0);
    expect(screen.getByRole('button', { name: /conferma posizione/i })).toBeEnabled();
  });
});
