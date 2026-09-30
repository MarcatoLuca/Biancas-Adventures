import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/workerApi', () => ({ request: vi.fn() }));
import { request } from '../../src/lib/workerApi';
import { useCityThemes } from '../../src/map/useCityThemes';
import type { Photo } from '../../src/photos/usePhotos';

function photo(label: string | null): Photo {
  return {
    albumId: 'a1', photoGuid: label ?? 'none', caption: '', dateCreated: null,
    thumbUrl: null, fullUrl: null, latitude: label ? 1 : null, longitude: label ? 1 : null,
    locationLabel: label,
  };
}

describe('useCityThemes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches one theme per distinct location label', async () => {
    (request as any).mockImplementation((path: string) =>
      Promise.resolve({ theme: { city_label: decodeURIComponent(path.split('/').pop()!), primary: '#111', secondary: '#222', accent: '#333' } })
    );

    const { result } = renderHook(() => useCityThemes([photo('Napoli, Italia'), photo('Napoli, Italia'), photo('Roma, Italia')]));

    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(2));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('ignores photos without a location label', async () => {
    const { result } = renderHook(() => useCityThemes([photo(null)]));
    await waitFor(() => expect(request).not.toHaveBeenCalled());
    expect(result.current).toEqual({});
  });
});
