import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../lib/workerApi';
import type { Album } from './AlbumSwitcher';

export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await request<{
        albums: {
          album_id: string;
          role: 'owner' | 'member';
          albums: { id: string; name: string; invite_code: string; icloud_album_token: string };
        }[];
      }>('/albums');
      const mapped = res.albums.map((row) => ({
        id: row.albums.id,
        name: row.albums.name,
        role: row.role,
        inviteCode: row.albums.invite_code,
        iCloudAlbumUrl: row.albums.icloud_album_token,
      }));
      if (id !== requestId.current) return;
      setAlbums(mapped);
      setActiveAlbumId((current) => mapped.some((album) => album.id === current) ? current : mapped[0]?.id ?? null);
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : 'unknown_error');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    return () => { requestId.current++; };
  }, [reload]);

  async function createAlbum(name: string, icloudAlbumUrl: string) {
    const res = await request<{ albumId: string }>('/albums', {
      method: 'POST',
      body: JSON.stringify({ name, icloudAlbumUrl }),
    });
    await reload();
    setActiveAlbumId(res.albumId);
    return res.albumId;
  }

  async function joinAlbum(inviteCode: string) {
    const res = await request<{ albumId: string }>('/albums/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    });
    await reload();
    setActiveAlbumId(res.albumId);
    return res.albumId;
  }

  const updateAlbum = (album: Album) => setAlbums((current) => current.map((item) => item.id === album.id ? album : item));

  return { albums, activeAlbumId, setActiveAlbumId, createAlbum, joinAlbum, reload, loading, error, updateAlbum };
}
