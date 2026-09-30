import { useCallback, useEffect, useState } from 'react';
import { request } from '../lib/workerApi';
import type { Album } from './AlbumSwitcher';

export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);

  const reload = useCallback(async () => {
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
    setAlbums(mapped);
    setActiveAlbumId((current) => current ?? mapped[0]?.id ?? null);
  }, []);

  useEffect(() => {
    reload();
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

  return { albums, activeAlbumId, setActiveAlbumId, createAlbum, joinAlbum, reload };
}
