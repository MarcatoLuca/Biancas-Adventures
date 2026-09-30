import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import type { Photo } from './usePhotos';
import { PhotoDetailView } from './PhotoDetailView';

interface PhotoGalleryPanelProps {
  photos: Photo[];
  onClose: () => void;
  onEditLocation: (photo: Photo) => void;
  onLocationConfirmed?: (photo: Photo, lat: number, lng: number, label: string) => void;
}

export function PhotoGalleryPanel({ photos, onClose, onEditLocation, onLocationConfirmed }: PhotoGalleryPanelProps) {
  const [selected, setSelected] = useState<Photo | null>(null);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={{ position: 'fixed', inset: 0, background: 'white', overflow: 'auto' }}
      >
        <button onClick={onClose}>Chiudi</button>
        {selected ? (
          <PhotoDetailView
            photo={selected}
            onEditLocation={onEditLocation}
            onLocationConfirmed={(lat, lng, label) => onLocationConfirmed?.(selected, lat, lng, label)}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {photos.map((photo) => (
              <button key={photo.photoGuid} onClick={() => setSelected(photo)}>
                {photo.thumbUrl ? (
                  <img src={photo.thumbUrl} alt={photo.caption || 'Foto'} style={{ width: '100%' }} />
                ) : (
                  <span>{photo.mediaAssetType === 'video' ? 'Video' : 'Foto'}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
