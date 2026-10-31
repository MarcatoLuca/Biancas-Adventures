import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../lib/workerApi';

export interface Photo {
  albumId: string;
  photoGuid: string;
  caption: string;
  dateCreated: string | null;
  thumbUrl: string | null;
  fullUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  mediaAssetType?: 'video';
}

interface RawPhotoRow {
  album_id: string;
  photo_guid: string;
  caption: string;
  date_created: string | null;
  thumb_url: string | null;
  full_url: string | null;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  media_asset_type: string | null;
}

function toPhoto(row: RawPhotoRow): Photo {
  return {
    albumId: row.album_id,
    photoGuid: row.photo_guid,
    caption: row.caption,
    dateCreated: row.date_created,
    thumbUrl: row.thumb_url,
    fullUrl: row.full_url,
    latitude: row.latitude,
    longitude: row.longitude,
    locationLabel: row.location_label,
    mediaAssetType: row.media_asset_type === 'video' ? 'video' : undefined,
  };
}

export function usePhotos(albumId: string | null) {
  const [data, setData] = useState<{ albumId: string | null; photos: Photo[] }>({ albumId: null, photos: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    if (!albumId) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await request<{ photos: RawPhotoRow[] }>(`/albums/${albumId}/photos`);
      if (id === requestId.current) setData({ albumId, photos: res.photos.map(toPhoto) });
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'unknown_error');
      setData((current) => current.albumId === albumId ? current : { albumId, photos: [] });
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    reload();
    return () => { requestId.current++; };
  }, [reload]);

  async function updateLocation(photoGuid: string, latitude: number, longitude: number, locationLabel?: string) {
    if (!albumId) throw new Error('album_not_found_or_forbidden');
    await request(`/albums/${albumId}/photos/${encodeURIComponent(photoGuid)}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ latitude, longitude, ...(locationLabel ? { locationLabel } : {}) }),
    });
    setData((current) => current.albumId !== albumId ? current : {
      ...current,
      photos: current.photos.map((photo) => photo.photoGuid === photoGuid ? {
        ...photo, latitude, longitude, locationLabel: locationLabel ?? null,
      } : photo),
    });
    await reload();
  }

  const photos = data.albumId === albumId ? data.photos : [];
  const unplaced = photos.filter((p) => p.latitude === null || p.longitude === null);

  return { photos, unplaced, loading: !!albumId && (loading || data.albumId !== albumId), error: albumId ? error : null, reload, updateLocation };
}
