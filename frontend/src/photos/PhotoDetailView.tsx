import { useState } from 'react';
import type { Photo } from './usePhotos';

interface PhotoDetailViewProps {
  photo: Photo;
  onEditLocation: (photo: Photo) => void;
  onLocationConfirmed?: (lat: number, lng: number, label: string) => void;
}

export function PhotoDetailView({ photo, onEditLocation }: PhotoDetailViewProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const date = photo.dateCreated ? new Date(photo.dateCreated) : null;
  const hasCoordinates = photo.latitude !== null && photo.longitude !== null;

  return (
    <article className="photo-detail">
      <div className="photo-preview">
        {photo.fullUrl && failedUrl !== photo.fullUrl ? (
          photo.mediaAssetType === 'video' ? (
            <video src={photo.fullUrl} controls preload="metadata" aria-label={photo.caption || 'Video dell’album'} onError={() => setFailedUrl(photo.fullUrl)}>
              Il browser non supporta la riproduzione video.
            </video>
          ) : (
            <img src={photo.fullUrl} alt={photo.caption || 'Foto dell’album senza descrizione'} onError={() => setFailedUrl(photo.fullUrl)} />
          )
        ) : (
          <div role="img" aria-label={photo.mediaAssetType === 'video' ? 'Video non visualizzabile in anteprima' : 'Anteprima non disponibile'} className="media-placeholder">
            <span aria-hidden="true">{photo.mediaAssetType === 'video' ? '▶' : '▧'}</span>
            <p>{photo.mediaAssetType === 'video' ? 'Video non visualizzabile in anteprima' : 'Anteprima non disponibile'}</p>
          </div>
        )}
      </div>
      <div className="photo-info form-stack">
        <span className="eyebrow">Il tuo ricordo</span>
        <h3>{photo.caption || 'Un’avventura da ricordare'}</h3>
        {date && !Number.isNaN(date.getTime()) && <time dateTime={photo.dateCreated!}>{date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</time>}
        <p>{photo.locationLabel ?? (hasCoordinates ? 'Posizione sulla mappa' : 'Posizione non impostata')}</p>
        {hasCoordinates && <p className="field-help">Latitudine {photo.latitude!.toFixed(5)} · Longitudine {photo.longitude!.toFixed(5)}</p>}
        <button type="button" className="btn btn-secondary" onClick={() => onEditLocation(photo)}>Modifica posizione</button>
      </div>
    </article>
  );
}
