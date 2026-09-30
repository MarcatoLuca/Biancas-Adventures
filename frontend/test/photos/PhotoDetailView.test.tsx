import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/lib/workerApi', () => ({ request: vi.fn() }));

import { request } from '../../src/lib/workerApi';
import { PhotoDetailView } from '../../src/photos/PhotoDetailView';
import type { Photo } from '../../src/photos/usePhotos';

function makePhoto(overrides: Partial<Photo>): Photo {
  return {
    albumId: 'a1',
    photoGuid: 'g1',
    caption: 'Al mare',
    dateCreated: '2024-07-12T18:00:00Z',
    thumbUrl: 'https://example.com/thumb.jpg',
    fullUrl: 'https://example.com/full.jpg',
    latitude: 41.9,
    longitude: 12.5,
    locationLabel: 'Roma, Italia',
    ...overrides,
  };
}

describe('PhotoDetailView', () => {
  it('renders the full image when available', () => {
    render(<PhotoDetailView photo={makePhoto({})} onEditLocation={vi.fn()} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/full.jpg');
  });

  it('shows a video placeholder instead of a broken image for video items', () => {
    render(
      <PhotoDetailView
        photo={makePhoto({ mediaAssetType: 'video', thumbUrl: null, fullUrl: null })}
        onEditLocation={vi.fn()}
      />
    );
    expect(screen.getByText(/video non visualizzabile/i)).toBeInTheDocument();
  });

  it('shows a generic placeholder when there is no url and no video flag', () => {
    render(
      <PhotoDetailView photo={makePhoto({ thumbUrl: null, fullUrl: null })} onEditLocation={vi.fn()} />
    );
    expect(screen.getByText(/anteprima non disponibile/i)).toBeInTheDocument();
  });

  it('calls onEditLocation when the edit button is pressed', () => {
    const onEditLocation = vi.fn();
    const photo = makePhoto({});
    render(<PhotoDetailView photo={photo} onEditLocation={onEditLocation} />);
    fireEvent.click(screen.getByRole('button', { name: /modifica posizione/i }));
    expect(onEditLocation).toHaveBeenCalledWith(photo);
  });

  it('shows the AI suggestion banner when the photo has no coordinates', async () => {
    (request as any).mockResolvedValueOnce({
      suggestion: { suggested_label: 'Napoli, Italia', reasoning: 'x', suggested_lat: 40.85, suggested_lng: 14.27 },
    });
    render(
      <PhotoDetailView
        photo={makePhoto({ latitude: null, longitude: null })}
        onEditLocation={vi.fn()}
        onLocationConfirmed={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText(/suggerimento ai/i)).toBeInTheDocument());
  });

  it('hides the AI suggestion banner when the photo already has coordinates', () => {
    render(<PhotoDetailView photo={makePhoto({})} onEditLocation={vi.fn()} onLocationConfirmed={vi.fn()} />);
    expect(screen.queryByText(/suggerimento ai/i)).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});
