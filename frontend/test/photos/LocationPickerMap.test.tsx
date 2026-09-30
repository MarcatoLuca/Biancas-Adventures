import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('maplibre-gl', () => {
  const handlers: Record<string, (e: any) => void> = {};
  class MapMock {
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
});
