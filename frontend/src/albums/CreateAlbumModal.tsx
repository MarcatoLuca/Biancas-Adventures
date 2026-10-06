import { useState, type FormEvent } from 'react';

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
    setError(null);
    setSubmitting(true);
    try {
      await onCreate(name, url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la creazione dell\'album');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: 'var(--color-coral-dark)' }}>🏝️ Nuovo album</h2>
        <label htmlFor="album-name" style={{ fontWeight: 700 }}>Nome album</label>
        <input id="album-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="icloud-url" style={{ fontWeight: 700 }}>Link Album Condiviso iCloud</label>
        <input id="icloud-url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
        {error && <p style={{ color: 'var(--color-coral-dark)', margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '⏳ Creazione...' : '✨ Crea'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annulla</button>
        </div>
      </form>
    </div>
  );
}
