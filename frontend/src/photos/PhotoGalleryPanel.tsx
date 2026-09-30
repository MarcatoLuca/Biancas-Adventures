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
        style={{ position: 'fixed', inset: 0, background: 'var(--color-cream)', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
          <button className="btn btn-ghost" onClick={onClose}>✖️ Chiudi</button>
        </div>
        {selected ? (
          <PhotoDetailView
            photo={selected}
            onEditLocation={onEditLocation}
            onLocationConfirmed={(lat, lng, label) => onLocationConfirmed?.(selected, lat, lng, label)}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '0 12px 12px' }}>
            {photos.map((photo) => (
              <button
                key={photo.photoGuid}
                onClick={() => setSelected(photo)}
                style={{
                  border: '3px solid var(--color-sand)',
                  borderRadius: 16,
                  padding: 0,
                  overflow: 'hidden',
                  background: 'white',
                  cursor: 'pointer',
                  aspectRatio: '1',
                }}
              >
                {photo.thumbUrl ? (
                  <img
                    src={photo.thumbUrl}
                    alt={photo.caption || 'Foto'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontFamily: 'var(--font-display)' }}>
                    {photo.mediaAssetType === 'video' ? '🎬 Video' : '🖼️ Foto'}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
