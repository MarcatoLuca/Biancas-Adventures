import { useState, type FormEvent } from 'react';

interface CreateAlbumModalProps {
  onCreate: (name: string, icloudAlbumUrl: string) => Promise<void>;
  onClose: () => void;
}

export function CreateAlbumModal({ onCreate, onClose }: CreateAlbumModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onCreate(name, url);
    onClose();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="album-name">Nome album</label>
      <input id="album-name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="icloud-url">Link Album Condiviso iCloud</label>
      <input id="icloud-url" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button type="submit">Crea</button>
      <button type="button" onClick={onClose}>Annulla</button>
    </form>
  );
}
