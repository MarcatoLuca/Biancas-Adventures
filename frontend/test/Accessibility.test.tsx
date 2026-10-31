import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import { LoginScreen } from '../src/auth/LoginScreen';
import { CreateAlbumModal } from '../src/albums/CreateAlbumModal';
import { JoinAlbumModal } from '../src/albums/JoinAlbumModal';
import { AlbumSettingsScreen } from '../src/settings/AlbumSettingsScreen';
import { PhotoGalleryPanel } from '../src/photos/PhotoGalleryPanel';
import { UnplacedQueuePanel } from '../src/photos/UnplacedQueuePanel';
import { LocationPickerMap } from '../src/photos/LocationPickerMap';
import type { Photo } from '../src/photos/usePhotos';

vi.mock('maplibre-gl', () => ({
  Map: class { on() {} remove() {} },
  Marker: class { setLngLat() { return this; } addTo() { return this; } remove() {} },
}));

const photo: Photo = {
  albumId: 'a1', photoGuid: 'p1', caption: 'Una passeggiata', dateCreated: null,
  thumbUrl: null, fullUrl: null, latitude: null, longitude: null, locationLabel: null,
};
const album = { id: 'a1', name: 'Vacanze', role: 'owner' as const, inviteCode: 'ABC123', iCloudAlbumUrl: 'test' };

async function checkAccessibility(element: HTMLElement) {
  const result = await axe.run(element, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    // Contrast and layout need a real rendering engine; these stay in the browser suite.
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
}

describe('WCAG DOM checks', () => {
  beforeAll(() => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null));
  afterAll(() => vi.restoreAllMocks());
  it('labels login inputs and announces authentication errors', async () => {
    const { container } = render(<LoginScreen onSubmit={vi.fn().mockRejectedValue(new Error('Invalid login credentials'))} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accedi' }));
    await screen.findByRole('alert');
    await checkAccessibility(container);
  });

  it.each([
    ['create', () => <CreateAlbumModal onCreate={vi.fn()} onClose={vi.fn()} />],
    ['join', () => <JoinAlbumModal onJoin={vi.fn()} onClose={vi.fn()} />],
    ['settings', () => <AlbumSettingsScreen album={album} onClose={vi.fn()} />],
    ['queue', () => <UnplacedQueuePanel photos={[photo]} onSelect={vi.fn()} onClose={vi.fn()} />],
    ['coordinates', () => <LocationPickerMap initialLat={null} initialLng={null} onConfirm={vi.fn()} onCancel={vi.fn()} />],
  ] as const)('has accessible %s controls', async (_, component) => {
    render(component());
    await checkAccessibility(screen.getByRole('dialog'));
  });

  it('keeps gallery and detail controls accessible', async () => {
    render(<PhotoGalleryPanel photos={[photo]} onClose={vi.fn()} onEditLocation={vi.fn()} />);
    await checkAccessibility(screen.getByRole('dialog'));
    fireEvent.click(screen.getByRole('button', { name: /una passeggiata/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /torna alle foto/i })).toHaveFocus());
    await checkAccessibility(screen.getByRole('dialog'));
  });
});
