import { useState, type FormEvent } from 'react';
import { Dialog } from '../ui/Dialog';
import { errorMessage } from '../lib/errorMessage';

interface JoinAlbumModalProps {
  onJoin: (inviteCode: string) => Promise<void>;
  onClose: () => void;
}

export function JoinAlbumModal({ onJoin, onClose }: JoinAlbumModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onJoin(inviteCode.trim());
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog title="Unisciti a un album" onClose={onClose} busy={submitting}>
      <form onSubmit={handleSubmit} className="form-stack" aria-busy={submitting}>
        <p className="muted">Chiedi il codice invito a chi ha creato l’album.</p>
        <label htmlFor="invite-code">Codice invito</label>
        <input id="invite-code" className="input invite-input" required autoCapitalize="characters" spellCheck={false} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} disabled={submitting} />
        <div className="button-row">
          <button type="submit" className="btn btn-secondary" disabled={submitting}>{submitting ? 'Attendi…' : 'Unisciti'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Annulla</button>
        </div>
        {error && (
          <p role="alert" className="notice notice-error">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
