import { useState } from 'react';
import { request } from '../lib/workerApi';

interface Album {
  id: string;
  name: string;
  inviteCode: string;
  iCloudAlbumUrl: string;
  role: 'owner' | 'member';
}

interface AlbumSettingsScreenProps {
  album: Album;
  onClose: () => void;
}

export function AlbumSettingsScreen({ album, onClose }: AlbumSettingsScreenProps) {
  const [name, setName] = useState(album.name);
  const [inviteCode, setInviteCode] = useState(album.inviteCode);

  async function rename() {
    await request(`/albums/${album.id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
  }

  async function regenerateInvite() {
    const res = await request<{ inviteCode: string }>(`/albums/${album.id}/invite/regenerate`, {
      method: 'POST',
    });
    setInviteCode(res.inviteCode);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'white' }}>
      <button onClick={onClose}>Chiudi</button>
      <h2>Impostazioni album</h2>
      <p>
        Codice invito: <strong>{inviteCode}</strong>
      </p>
      {album.role === 'owner' && (
        <>
          <label>
            Nome album
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button onClick={rename}>Rinomina</button>
          <button onClick={regenerateInvite}>Rigenera codice</button>
        </>
      )}
    </div>
  );
}
