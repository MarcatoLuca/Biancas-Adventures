import type { Photo } from './usePhotos';
import { AiSuggestionBanner } from './AiSuggestionBanner';

interface PhotoDetailViewProps {
  photo: Photo;
  onEditLocation: (photo: Photo) => void;
  onLocationConfirmed?: (lat: number, lng: number, label: string) => void;
}

export function PhotoDetailView({ photo, onEditLocation, onLocationConfirmed }: PhotoDetailViewProps) {
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
      {photo.latitude === null && (
        <AiSuggestionBanner
          albumId={photo.albumId}
          photoGuid={photo.photoGuid}
          onAccepted={(lat, lng, label) => onLocationConfirmed?.(lat, lng, label)}
        />
      )}
    </div>
  );
}
