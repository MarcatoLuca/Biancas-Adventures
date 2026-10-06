import type { Photo } from './usePhotos';

interface UnplacedQueuePanelProps {
  photos: Photo[];
  totalPhotos?: number;
  onSelect: (photo: Photo) => void;
  onClose: () => void;
}

export function UnplacedQueuePanel({ photos, totalPhotos, onSelect, onClose }: UnplacedQueuePanelProps) {
  return (
    <div className="panel-sheet" style={{ top: 0, right: 0, bottom: 0, left: 'auto', width: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--color-sky-dark)' }}>🧭 Da posizionare</h2>
        <button className="btn btn-ghost" onClick={onClose}>✖️</button>
      </div>
      {photos.length === 0 && totalPhotos === 0 ? (
        <p style={{ color: 'var(--color-coral-dark)', fontWeight: 700 }}>
          Nessuna foto trovata per questo album. Controlla che il link dell'Album Condiviso iCloud sia corretto e pubblico.
        </p>
      ) : photos.length === 0 ? (
        <p style={{ color: 'var(--color-grass-dark)', fontWeight: 700 }}>Tutte le foto sono posizionate! 🎉</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {photos.map((photo) => (
            <li key={photo.photoGuid}>
              <button
                className="btn"
                style={{ width: '100%', background: 'var(--color-sun)', color: 'var(--color-ink)' }}
                onClick={() => onSelect(photo)}
              >
                <span aria-hidden="true">📷 </span>
                {photo.caption || `Foto ${photo.photoGuid}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
