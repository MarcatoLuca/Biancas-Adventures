import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UnplacedQueuePanel } from '../../src/photos/UnplacedQueuePanel';
import type { Photo } from '../../src/photos/usePhotos';

function photo(guid: string): Photo {
  return {
    albumId: 'a1',
    photoGuid: guid,
    caption: `Foto ${guid}`,
    dateCreated: null,
    thumbUrl: null,
    fullUrl: null,
    latitude: null,
    longitude: null,
    locationLabel: null,
  };
}

describe('UnplacedQueuePanel', () => {
  it('lists every unplaced photo', () => {
    render(<UnplacedQueuePanel photos={[photo('g1'), photo('g2')]} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Foto g1')).toBeInTheDocument();
    expect(screen.getByText('Foto g2')).toBeInTheDocument();
  });

  it('shows an empty state when there is nothing to place', () => {
    render(<UnplacedQueuePanel photos={[]} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/tutte le foto sono posizionate/i)).toBeInTheDocument();
  });

  it('calls onSelect with the tapped photo', () => {
    const onSelect = vi.fn();
    const p1 = photo('g1');
    render(<UnplacedQueuePanel photos={[p1]} onSelect={onSelect} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Foto g1'));
    expect(onSelect).toHaveBeenCalledWith(p1);
  });
});
