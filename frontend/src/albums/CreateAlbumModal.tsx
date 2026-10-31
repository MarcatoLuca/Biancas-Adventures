import { useState, type FormEvent } from 'react';
import { Dialog } from '../ui/Dialog';
import { errorMessage } from '../lib/errorMessage';

interface CreateAlbumModalProps {
  onCreate: (name: string, icloudAlbumUrl: string) => Promise<void>;
  onClose: () => void;
}

export function CreateAlbumModal({ onCreate, onClose }: CreateAlbumModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onCreate(name.trim(), url.trim());
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog title="Nuovo album" onClose={onClose} busy={submitting}>
      <form onSubmit={handleSubmit} className="form-stack" aria-busy={submitting}>
        <p className="muted">Raccogli i vostri ricordi sulla mappa. Le foto restano nel tuo album iCloud.</p>
        <label htmlFor="album-name">Nome album</label>
        <input id="album-name" className="input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
        <label htmlFor="icloud-url">Link Album Condiviso iCloud</label>
        <input id="icloud-url" className="input" required type="url" aria-describedby="icloud-help" value={url} onChange={(e) => setUrl(e.target.value)} disabled={submitting} placeholder="https://www.icloud.com/sharedalbum/#…" />
        <p id="icloud-help" className="field-help">In Foto, apri l’album condiviso, attiva “Sito web pubblico” e copia il link.</p>
        {error && <p role="alert" className="notice notice-error">{error}</p>}
        <div className="button-row">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creazione…' : 'Crea'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Annulla</button>
        </div>
      </form>
    </Dialog>
  );
}
