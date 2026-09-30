import type { Photo } from './usePhotos';

interface UnplacedQueuePanelProps {
  photos: Photo[];
  onSelect: (photo: Photo) => void;
  onClose: () => void;
}

export function UnplacedQueuePanel({ photos, onSelect, onClose }: UnplacedQueuePanelProps) {
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 320, background: 'white', overflow: 'auto' }}>
      <button onClick={onClose}>Chiudi</button>
      <h2>Da posizionare</h2>
      {photos.length === 0 ? (
        <p>Tutte le foto sono posizionate! 🎉</p>
      ) : (
        <ul>
          {photos.map((photo) => (
            <li key={photo.photoGuid}>
              <button onClick={() => onSelect(photo)}>{photo.caption || `Foto ${photo.photoGuid}`}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
