import { useState, type FormEvent } from 'react';

interface JoinAlbumModalProps {
  onJoin: (inviteCode: string) => Promise<void>;
  onClose: () => void;
}

export function JoinAlbumModal({ onJoin, onClose }: JoinAlbumModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await onJoin(inviteCode);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: 'var(--color-sky-dark)' }}>🔑 Unisciti a un album</h2>
        <label htmlFor="invite-code" style={{ fontWeight: 700 }}>Codice invito</label>
        <input id="invite-code" className="input" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button type="submit" className="btn btn-secondary">🤝 Unisciti</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annulla</button>
        </div>
        {error && (
          <p role="alert" style={{ color: 'var(--color-coral-dark)', fontWeight: 700 }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
