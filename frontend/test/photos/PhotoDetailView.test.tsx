import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
});
