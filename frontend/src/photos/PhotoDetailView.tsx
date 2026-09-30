import type { Photo } from './usePhotos';

interface PhotoDetailViewProps {
  photo: Photo;
  onEditLocation: (photo: Photo) => void;
}

export function PhotoDetailView({ photo, onEditLocation }: PhotoDetailViewProps) {
  return (
    <div>
      {photo.fullUrl ? (
        <img src={photo.fullUrl} alt={photo.caption || 'Foto'} style={{ maxWidth: '100%' }} />
      ) : photo.mediaAssetType === 'video' ? (
        <div role="img" aria-label="Video non visualizzabile in anteprima">
          Video non visualizzabile in anteprima
        </div>
      ) : (
        <div role="img" aria-label="Anteprima non disponibile">
          Anteprima non disponibile
        </div>
      )}
      <p>{photo.caption}</p>
      <p>{photo.locationLabel ?? 'Posizione non impostata'}</p>
      <button onClick={() => onEditLocation(photo)}>Modifica posizione</button>
    </div>
  );
}
