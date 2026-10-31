import type { Cluster } from './useClusteredPhotos';

interface AlbumMarkerProps {
  cluster: Cluster;
  onOpen: (cluster: Cluster) => void;
}

export function AlbumMarker({ cluster, onOpen }: AlbumMarkerProps) {
  const previewPhotos = cluster.photos.slice(0, 2);

  return (
    <button
      type="button"
      className="map-photo-marker"
      onClick={() => onOpen(cluster)}
      style={{ position: 'relative', width: 72, height: 72, border: 'none', background: 'none' }}
      aria-label={cluster.isCluster ? `Apri ${cluster.photos.length} foto in questa zona` : `Apri foto: ${cluster.photos[0]?.caption || cluster.photos[0]?.locationLabel || 'ricordo senza titolo'}`}
    >
      {previewPhotos.map((photo, i) => (
        <img
          key={photo.photoGuid}
          src={photo.thumbUrl ?? undefined}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
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
            background: 'var(--color-coral-dark)',
            fontSize: 13,
          }}
        >
          {cluster.photos.length}
        </span>
      )}
    </button>
  );
}
