import { useLayoutEffect, useRef, useState } from 'react';
import type { Photo } from './usePhotos';
import { PhotoDetailView } from './PhotoDetailView';
import { Dialog } from '../ui/Dialog';

interface PhotoGalleryPanelProps {
  photos: Photo[];
  onClose: () => void;
  onEditLocation: (photo: Photo) => void;
  onLocationConfirmed?: (photo: Photo, lat: number, lng: number, label: string) => void;
}

export function PhotoGalleryPanel({ photos, onClose, onEditLocation }: PhotoGalleryPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = photos.find((photo) => photo.photoGuid === selectedId);
  const opener = useRef<HTMLButtonElement | null>(null);
  const returnPhotoId = useRef<string | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);
  const wasSelected = useRef(false);

  useLayoutEffect(() => {
    if (selected) backRef.current?.focus();
    else if (wasSelected.current) opener.current?.focus();
    wasSelected.current = !!selected;
  }, [selected]);

  return (
    <Dialog title={selected ? 'Dettaglio foto' : 'Tutte le foto'} onClose={onClose} wide>
      {selected ? (
        <>
          <button ref={backRef} type="button" className="btn btn-ghost gallery-back" onClick={() => setSelectedId(null)}>← Torna alle foto</button>
          <PhotoDetailView photo={selected} onEditLocation={onEditLocation} />
        </>
      ) : (
        <>
          <p className="muted gallery-summary">{photos.length} {photos.length === 1 ? 'ricordo da esplorare' : 'ricordi da esplorare'}. Apri una foto per vederla o cambiarne la posizione.</p>
          {photos.length === 0 && <p className="empty-state">Nessuna foto in questo album. Sincronizza per cercare nuovi ricordi.</p>}
          <div className="photo-grid">
            {photos.map((photo) => (
              <button
                type="button"
                key={photo.photoGuid}
                className="photo-tile"
                ref={(element) => { if (photo.photoGuid === returnPhotoId.current) opener.current = element; }}
                data-photo-id={photo.photoGuid}
                onClick={(event) => { returnPhotoId.current = photo.photoGuid; opener.current = event.currentTarget; setSelectedId(photo.photoGuid); }}
                aria-label={`Apri ${photo.caption || 'foto senza titolo'}${photo.locationLabel ? `, ${photo.locationLabel}` : ', da posizionare'}`}
              >
                {photo.thumbUrl ? <img src={photo.thumbUrl} alt="" loading="lazy" /> : <span className="photo-placeholder" aria-hidden="true">{photo.mediaAssetType === 'video' ? '▶' : '▧'}</span>}
                <span className="photo-tile-caption">{photo.caption || 'Un bel ricordo'}<small>{photo.locationLabel || 'Da posizionare'}</small></span>
              </button>
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
}
