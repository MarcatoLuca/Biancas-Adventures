import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoGalleryPanel } from '../../src/photos/PhotoGalleryPanel';
import type { Photo } from '../../src/photos/usePhotos';

const photo: Photo = {
  albumId: 'a1', photoGuid: 'p1', caption: 'Al mare', dateCreated: null,
  thumbUrl: null, fullUrl: null, latitude: null, longitude: null, locationLabel: null,
};

describe('PhotoGalleryPanel', () => {
  it('opens a photo and lets keyboard users return to the gallery', () => {
    render(<PhotoGalleryPanel photos={[photo]} onClose={vi.fn()} onEditLocation={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /al mare/i }));
    expect(screen.getByRole('button', { name: /modifica posizione/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /torna.*foto/i }));
    expect(screen.getByRole('button', { name: /al mare/i })).toHaveFocus();
  });
});
