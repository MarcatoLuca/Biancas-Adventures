import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';

vi.mock('../src/auth/useAuth', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' }, loading: false, signOut: vi.fn() }),
}));
vi.mock('../src/lib/workerApi', () => ({ request: vi.fn() }));
vi.mock('../src/map/MapView', () => ({ MapView: () => null }));
vi.mock('maplibre-gl', () => ({
  Map: class { on() {} remove() {} },
  Marker: class { setLngLat() { return this; } addTo() { return this; } remove() {} },
}));
import { request } from '../src/lib/workerApi';
import App from '../src/App';

describe('album workspace', () => {
  beforeEach(() => {
    vi.mocked(request).mockImplementation(async (path) => {
      if (path === '/albums') return { albums: [{
        album_id: 'a1', role: 'owner',
        albums: { id: 'a1', name: 'Vacanze', invite_code: 'ABC123', icloud_album_token: 'token' },
      }] };
      return { photos: [{
        album_id: 'a1', photo_guid: 'p1', caption: 'Al mare', date_created: null,
        thumb_url: null, full_url: null, latitude: 42, longitude: 12, location_label: 'Roma',
        media_asset_type: null,
      }] };
    });
  });

  it('provides access to all photos without requiring map interaction and can resync', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /tutte le foto/i });
    await waitFor(() => expect(screen.getByRole('button', { name: /sincronizza/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /tutte le foto/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /al mare/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /chiudi/i }));
    fireEvent.click(screen.getByRole('button', { name: /sincronizza/i }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  });

  it('shows album-load failures with an actionable retry', async () => {
    vi.mocked(request).mockRejectedValue(new Error('unauthorized: invalid token'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/accedi.*nuovo/i);
    expect(screen.getByRole('button', { name: /riprova/i })).toBeInTheDocument();
  });

  it('keeps album management behind the floating menu and preserves nested dialogs', async () => {
    render(<App />);
    const menu = await screen.findByRole('button', { name: /album e account/i });
    await waitFor(() => expect(screen.getByRole('button', { name: /sincronizza/i })).toBeEnabled());
    expect(screen.queryByRole('button', { name: /crea album/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Riepilogo album')).not.toBeInTheDocument();
    menu.focus();
    fireEvent.click(menu);
    expect(screen.getByRole('dialog', { name: /le tue avventure/i })).toBeInTheDocument();
    const create = screen.getByRole('button', { name: /crea album/i });
    create.focus();
    fireEvent.click(create);
    expect(screen.getByRole('dialog', { name: /nuovo album/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome album')).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog', { name: /nuovo album/i }), { key: 'Escape' });
    expect(screen.getByRole('button', { name: /crea album/i })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog', { name: /le tue avventure/i }), { key: 'Escape' });
    expect(menu).toHaveFocus();
  });

  it('opens album settings directly from the map HUD', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /tutte le foto/i });
    await waitFor(() => expect(screen.getByRole('button', { name: /impostazioni album/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /impostazioni album/i }));
    expect(screen.getByRole('dialog', { name: /impostazioni album/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome album')).toHaveValue('Vacanze');
  });

  it('keeps icon-only HUD controls named and offers supplementary hints', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /sincronizza/i })).toBeEnabled());
    for (const name of ['Album e account', 'Sincronizza foto', 'Tutte le foto', 'Impostazioni album']) {
      const button = screen.getByRole('button', { name, exact: true });
      expect(button).toHaveAttribute('title', name);
      expect(button).not.toHaveTextContent(name);
    }
    expect(screen.getByRole('button', { name: 'Da posizionare: 0' })).toHaveAttribute('title', 'Da posizionare');
  });

  it('keeps menu zoom unavailable until the map is ready', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /sincronizza/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /album e account/i }));
    expect(screen.getByRole('button', { name: /avvicina/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /allontana/i })).toBeDisabled();
  });

  it('returns to the map after selecting an album in the menu', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /sincronizza/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /album e account/i }));
    fireEvent.click(screen.getByRole('button', { name: /vacanze il tuo album/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vacanze', exact: true })).toBeInTheDocument();
  });

  it('exposes an accessible workspace and navigable album controls', async () => {
    const { container } = render(<App />);
    await screen.findByRole('button', { name: /tutte le foto/i });
    await waitFor(() => expect(screen.getByRole('button', { name: /sincronizza/i })).toBeEnabled());
    const canvas = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    try {
      const result = await axe.run(container, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
        rules: { 'color-contrast': { enabled: false } },
      });

      expect(result.violations.map(({ id }) => id)).toEqual([]);
    } finally {
      canvas.mockRestore();
    }
  });

  it.each([
    ['unchanged coordinates preserve the label', '42', '12', '{"latitude":42,"longitude":12,"locationLabel":"Roma"}'],
    ['moved coordinates request a new label', '45', '9', '{"latitude":45,"longitude":9}'],
  ])('%s', async (_, latitude, longitude, body) => {
    render(<App />);
    await screen.findByRole('button', { name: /tutte le foto/i });
    await waitFor(() => expect(screen.getByRole('button', { name: /sincronizza/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /tutte le foto/i }));
    fireEvent.click(screen.getByRole('button', { name: /apri al mare/i }));
    fireEvent.click(screen.getByRole('button', { name: /modifica posizione/i }));
    fireEvent.change(screen.getByLabelText('Latitudine'), { target: { value: latitude } });
    fireEvent.change(screen.getByLabelText('Longitudine'), { target: { value: longitude } });
    fireEvent.click(screen.getByRole('button', { name: /conferma posizione/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/albums/a1/photos/p1/location', {
      method: 'PATCH',
      body,
    }));
  });
});
