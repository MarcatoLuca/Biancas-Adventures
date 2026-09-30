import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useClusteredPhotos } from '../../src/map/useClusteredPhotos';
import type { Photo } from '../../src/photos/usePhotos';

function photo(guid: string, lat: number | null, lng: number | null): Photo {
  return {
    albumId: 'a1',
    photoGuid: guid,
    caption: '',
    dateCreated: null,
    thumbUrl: null,
    fullUrl: null,
    latitude: lat,
    longitude: lng,
    locationLabel: null,
  };
}

describe('useClusteredPhotos', () => {
  it('ignores photos without coordinates', () => {
    const { result } = renderHook(() =>
      useClusteredPhotos([photo('g1', null, null)], 4, [-180, -85, 180, 85])
    );
    expect(result.current).toHaveLength(0);
  });

  it('groups two nearby photos into one cluster at low zoom', () => {
    const photos = [photo('g1', 41.9, 12.5), photo('g2', 41.91, 12.51)];
    const { result } = renderHook(() => useClusteredPhotos(photos, 3, [-180, -85, 180, 85]));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].isCluster).toBe(true);
    expect(result.current[0].photos).toHaveLength(2);
  });

  it('keeps far-apart photos as separate single markers', () => {
    const photos = [photo('g1', 41.9, 12.5), photo('g2', 40.7, -74.0)];
    const { result } = renderHook(() => useClusteredPhotos(photos, 3, [-180, -85, 180, 85]));
    expect(result.current).toHaveLength(2);
    expect(result.current.every((c) => !c.isCluster)).toBe(true);
  });
});
