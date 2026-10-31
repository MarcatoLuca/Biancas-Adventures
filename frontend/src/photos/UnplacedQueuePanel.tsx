import type { Photo } from './usePhotos';
import { Dialog } from '../ui/Dialog';

interface UnplacedQueuePanelProps {
  photos: Photo[];
  totalPhotos?: number;
  onSelect: (photo: Photo) => void;
  onClose: () => void;
}

export function UnplacedQueuePanel({ photos, totalPhotos, onSelect, onClose }: UnplacedQueuePanelProps) {
  return (
    <Dialog title="Foto da posizionare" onClose={onClose}>
      {photos.length === 0 && totalPhotos === 0 ? (
        <p className="empty-state">Nessuna foto trovata per questo album. Controlla che il link dell’Album Condiviso iCloud sia corretto e pubblico.</p>
      ) : photos.length === 0 ? (
        <p className="notice notice-success">Tutte le foto sono posizionate! Il vostro viaggio è sulla mappa.</p>
      ) : (
        <>
          <p className="muted">Ogni ricordo merita un posto. Scegli una foto e indica dove è stata scattata.</p>
          <ul className="unplaced-list">
            {photos.map((photo, index) => (
              <li key={photo.photoGuid}>
                <button type="button" className="queue-item" onClick={() => onSelect(photo)}>
                  {photo.thumbUrl ? <img src={photo.thumbUrl} alt="" loading="lazy" /> : <span className="queue-placeholder" aria-hidden="true">▧</span>}
                  <span>{photo.caption || `Foto ${index + 1}`}<small>Aggiungi una posizione</small></span>
                  <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
