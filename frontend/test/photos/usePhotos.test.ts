import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/workerApi', () => ({ request: vi.fn() }));
import { request } from '../../src/lib/workerApi';
import { usePhotos } from '../../src/photos/usePhotos';

describe('usePhotos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('splits photos into placed and unplaced', async () => {
    (request as any).mockResolvedValue({
      photos: [
        { album_id: 'a1', photo_guid: 'g1', caption: '', date_created: null, thumb_url: null, full_url: null, latitude: 41.9, longitude: 12.5, location_label: 'Roma', media_asset_type: null },
        { album_id: 'a1', photo_guid: 'g2', caption: '', date_created: null, thumb_url: null, full_url: null, latitude: null, longitude: null, location_label: null, media_asset_type: null },
      ],
    });

    const { result } = renderHook(() => usePhotos('a1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.photos).toHaveLength(2);
    expect(result.current.unplaced).toEqual([expect.objectContaining({ photoGuid: 'g2' })]);
  });

  it('surfaces a clear error when the sync fails', async () => {
    (request as any).mockRejectedValue(new Error('icloud_album_unreachable'));

    const { result } = renderHook(() => usePhotos('a1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('icloud_album_unreachable');
    expect(result.current.photos).toEqual([]);
  });

  it('does nothing when albumId is null', () => {
    const { result } = renderHook(() => usePhotos(null));
    expect(result.current.loading).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
