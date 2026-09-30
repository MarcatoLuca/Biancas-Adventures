import type { Photo } from './usePhotos';
import { AiSuggestionBanner } from './AiSuggestionBanner';

interface PhotoDetailViewProps {
  photo: Photo;
  onEditLocation: (photo: Photo) => void;
  onLocationConfirmed?: (lat: number, lng: number, label: string) => void;
}

export function PhotoDetailView({ photo, onEditLocation, onLocationConfirmed }: PhotoDetailViewProps) {
  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {photo.fullUrl ? (
        <img
          src={photo.fullUrl}
          alt={photo.caption || 'Foto'}
          style={{ maxWidth: '100%', borderRadius: 20, border: '4px solid white', boxShadow: '0 8px 24px rgba(58,46,57,0.16)' }}
        />
      ) : photo.mediaAssetType === 'video' ? (
        <div role="img" aria-label="Video non visualizzabile in anteprima" className="card">
          🎬 Video non visualizzabile in anteprima
        </div>
      ) : (
        <div role="img" aria-label="Anteprima non disponibile" className="card">
          🖼️ Anteprima non disponibile
        </div>
      )}
      <p style={{ fontWeight: 700 }}>{photo.caption}</p>
      <p>
        📍{' '}
        <span style={{ color: photo.locationLabel ? 'var(--color-grass-dark)' : 'var(--color-ink-muted)' }}>
          {photo.locationLabel ?? 'Posizione non impostata'}
        </span>
      </p>
      <button className="btn btn-secondary" onClick={() => onEditLocation(photo)} style={{ alignSelf: 'flex-start' }}>
        📌 Modifica posizione
      </button>
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
