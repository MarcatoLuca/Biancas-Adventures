import { useMemo } from 'react';
import Supercluster from 'supercluster';
import type { Photo } from '../photos/usePhotos';

export interface Cluster {
  id: string;
  latitude: number;
  longitude: number;
  photos: Photo[];
  isCluster: boolean;
}

export function useClusteredPhotos(
  photos: Photo[],
  zoom: number,
  bounds: [number, number, number, number]
): Cluster[] {
  return useMemo(() => {
    const placed = photos.filter(
      (p): p is Photo & { latitude: number; longitude: number } =>
        p.latitude !== null && p.longitude !== null
    );
    if (placed.length === 0) return [];

    const index = new Supercluster<{ photo: Photo }>({ radius: 60, maxZoom: 16 });
    index.load(
      placed.map((p) => ({
        type: 'Feature',
        properties: { photo: p },
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
      }))
    );

    const results = index.getClusters(bounds, Math.round(zoom));

    return results.map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      const properties = feature.properties;
      if ('cluster' in properties && properties.cluster) {
        const leaves = index.getLeaves(properties.cluster_id, Infinity);
        return {
          id: `cluster-${properties.cluster_id}`,
          latitude,
          longitude,
          photos: leaves.map((leaf) => leaf.properties.photo),
          isCluster: true,
        };
      }
      const photo = (properties as { photo: Photo }).photo;
      return {
        id: `photo-${photo.photoGuid}`,
        latitude,
        longitude,
        photos: [photo],
        isCluster: false,
      };
    });
  }, [photos, zoom, bounds]);
}
