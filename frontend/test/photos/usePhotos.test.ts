import { act, renderHook, waitFor } from '@testing-library/react';
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

  it('does not show a previous album while the next album is loading', async () => {
    vi.mocked(request).mockResolvedValueOnce({ photos: [
      { album_id: 'a1', photo_guid: 'old', caption: 'Old album', latitude: null, longitude: null },
    ] });
    const { result, rerender } = renderHook(({ id }) => usePhotos(id), { initialProps: { id: 'a1' } });
    await waitFor(() => expect(result.current.photos).toHaveLength(1));
    vi.mocked(request).mockReturnValueOnce(new Promise(() => {}));
    rerender({ id: 'a2' });
    expect(result.current.photos).toEqual([]);
    rerender({ id: '' });
    expect(result.current.photos).toEqual([]);
  });

  it('ignores a stale response after changing albums', async () => {
    let resolveOld!: (value: unknown) => void;
    vi.mocked(request).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
    const { result, rerender } = renderHook(({ id }) => usePhotos(id), { initialProps: { id: 'a1' } });
    vi.mocked(request).mockResolvedValueOnce({ photos: [] });
    rerender({ id: 'a2' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { resolveOld({ photos: [{ album_id: 'a1', photo_guid: 'old', caption: '', latitude: null, longitude: null }] }); });
    expect(result.current.photos).toEqual([]);
  });

  it('preserves displayed photos and reports a failed resync', async () => {
    vi.mocked(request).mockResolvedValueOnce({ photos: [
      { album_id: 'a1', photo_guid: 'g1', caption: 'Keep me', latitude: null, longitude: null },
    ] });
    const { result } = renderHook(() => usePhotos('a1'));
    await waitFor(() => expect(result.current.photos).toHaveLength(1));
    vi.mocked(request).mockRejectedValueOnce(new Error('icloud_album_unreachable'));
    await act(async () => { await result.current.reload(); });
    expect(result.current.photos[0].caption).toBe('Keep me');
    expect(result.current.error).toBe('icloud_album_unreachable');
  });
});
