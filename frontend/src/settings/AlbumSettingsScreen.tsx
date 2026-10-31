import { useState, type FormEvent } from 'react';
import { request } from '../lib/workerApi';
import { errorMessage } from '../lib/errorMessage';
import { Dialog } from '../ui/Dialog';
import type { Album } from '../albums/AlbumSwitcher';

interface AlbumSettingsScreenProps {
  album: Album;
  onClose: () => void;
  onUpdated?: (album: Album) => void;
}

export function AlbumSettingsScreen({ album, onClose, onUpdated }: AlbumSettingsScreenProps) {
  const [name, setName] = useState(album.name);
  const [inviteCode, setInviteCode] = useState(album.inviteCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    setStatus('');
    try {
      await request(`/albums/${album.id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) });
      onUpdated?.({ ...album, name: name.trim(), inviteCode });
      setStatus('Nome album salvato.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function regenerateInvite() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStatus('');
    try {
      const res = await request<{ inviteCode: string }>(`/albums/${album.id}/invite/regenerate`, { method: 'POST' });
      setInviteCode(res.inviteCode);
      onUpdated?.({ ...album, inviteCode: res.inviteCode });
      setStatus('Nuovo codice creato. Il codice precedente non è più valido.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Impostazioni album" onClose={onClose} busy={busy}>
      <div className="form-stack">
        <p className="muted">{album.name} · {album.role === 'owner' ? 'Proprietario' : 'Membro'}</p>
        <div className="invite-card">
          <h3>Un’avventura da condividere</h3>
          <p>Invia questo codice a chi vuoi aggiungere all’album.</p>
          <label htmlFor="album-invite">Codice invito</label>
          <input id="album-invite" className="input invite-input" value={inviteCode} readOnly onFocus={(event) => event.target.select()} />
        </div>
        {album.role === 'owner' && (
          <>
            <form onSubmit={rename} className="form-stack" aria-busy={busy}>
              <label htmlFor="settings-album-name">Nome album</label>
              <input id="settings-album-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} disabled={busy} />
              <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>Rinomina</button>
            </form>
            <div className="settings-section">
              <h3>Nuovo codice invito</h3>
              <p id="regenerate-help" className="field-help">Il vecchio codice smetterà di funzionare. I membri già presenti manterranno l’accesso.</p>
              <button type="button" className="btn btn-secondary" aria-describedby="regenerate-help" disabled={busy} onClick={regenerateInvite}>Rigenera codice</button>
            </div>
          </>
        )}
        {error && <p role="alert" className="notice notice-error">{error}</p>}
        <p role="status" className={status ? 'notice notice-success' : 'sr-only'}>{status}</p>
      </div>
    </Dialog>
  );
}
