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
    <div className="panel-sheet">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--color-grape-dark)' }}>⚙️ Impostazioni album</h2>
        <button className="btn btn-ghost" onClick={onClose}>✖️ Chiudi</button>
      </div>
      <div className="card" style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p>
          Codice invito: <strong className="badge" style={{ background: 'var(--color-sun-dark)' }}>{inviteCode}</strong>
        </p>
        {album.role === 'owner' && (
          <>
            <label style={{ fontWeight: 700, display: 'flex', flexDirection: 'column', gap: 6 }}>
              Nome album
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={rename}>✏️ Rinomina</button>
              <button className="btn btn-secondary" onClick={regenerateInvite}>🔄 Rigenera codice</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
