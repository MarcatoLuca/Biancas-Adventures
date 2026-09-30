import { motion } from 'framer-motion';
import type { Cluster } from './useClusteredPhotos';

interface AlbumMarkerProps {
  cluster: Cluster;
  onOpen: (cluster: Cluster) => void;
}

export function AlbumMarker({ cluster, onOpen }: AlbumMarkerProps) {
  const previewPhotos = cluster.photos.slice(0, 2);

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => onOpen(cluster)}
      style={{ position: 'relative', width: 72, height: 72, border: 'none', background: 'none' }}
      aria-label={cluster.isCluster ? `${cluster.photos.length} foto in questa zona` : 'Apri foto'}
    >
      {previewPhotos.map((photo, i) => (
        <img
          key={photo.photoGuid}
          src={photo.thumbUrl ?? undefined}
          alt=""
          style={{
            position: 'absolute',
            width: 56,
            height: 56,
            objectFit: 'cover',
            borderRadius: 14,
            border: '4px solid white',
            boxShadow: '0 4px 0 rgba(0,0,0,0.15), 0 6px 14px rgba(0,0,0,0.18)',
            transform: `rotate(${i === 0 ? -8 : 8}deg) translate(${i * 10}px, ${i * 6}px)`,
          }}
        />
      ))}
      {cluster.isCluster && (
        <span
          className="badge"
          style={{
            position: 'absolute',
            bottom: -6,
            right: -6,
            background: 'var(--color-coral)',
            fontSize: 13,
          }}
        >
          {cluster.photos.length}
        </span>
      )}
    </motion.button>
  );
}
