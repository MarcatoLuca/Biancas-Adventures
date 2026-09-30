import { useCallback, useEffect, useState } from 'react';
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
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!albumId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request<{ photos: RawPhotoRow[] }>(`/albums/${albumId}/photos`);
      setPhotos(res.photos.map(toPhoto));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function updateLocation(photoGuid: string, latitude: number, longitude: number, locationLabel?: string) {
    if (!albumId) return;
    await request(`/albums/${albumId}/photos/${photoGuid}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ latitude, longitude, ...(locationLabel ? { locationLabel } : {}) }),
    });
    await reload();
  }

  const unplaced = photos.filter((p) => p.latitude === null || p.longitude === null);

  return { photos, unplaced, loading, error, reload, updateLocation };
}
