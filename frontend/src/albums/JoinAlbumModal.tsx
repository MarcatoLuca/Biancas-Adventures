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
    <form onSubmit={handleSubmit}>
      <label htmlFor="invite-code">Codice invito</label>
      <input id="invite-code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
      <button type="submit">Unisciti</button>
      <button type="button" onClick={onClose}>Annulla</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
