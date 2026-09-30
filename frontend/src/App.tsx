import { useCallback, useState } from 'react';
import { useAuth } from './auth/useAuth';
import { LoginScreen } from './auth/LoginScreen';
import { useAlbums } from './albums/useAlbums';
import { AlbumSwitcher } from './albums/AlbumSwitcher';
import { CreateAlbumModal } from './albums/CreateAlbumModal';
import { JoinAlbumModal } from './albums/JoinAlbumModal';
import { MapView } from './map/MapView';
import { usePhotos, type Photo } from './photos/usePhotos';
import { PhotoGalleryPanel } from './photos/PhotoGalleryPanel';
import { LocationPickerMap } from './photos/LocationPickerMap';
import type { Cluster } from './map/useClusteredPhotos';
import './App.css';

function App() {
  const { user, loading, signInWithPassword, signOut } = useAuth();
  const { albums, activeAlbumId, setActiveAlbumId, createAlbum, joinAlbum } = useAlbums();
  const { photos, updateLocation } = usePhotos(activeAlbumId);
  const [modal, setModal] = useState<'create' | 'join' | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[] | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);

  const handleMapReady = useCallback(() => {
    // Later tasks (city themes, HUD) attach layers here.
  }, []);

  const handleOpenCluster = useCallback((cluster: Cluster) => {
    setGalleryPhotos(cluster.photos);
  }, []);

  const handleEditLocation = useCallback((photo: Photo) => {
    setEditingPhoto(photo);
  }, []);

  if (loading) return <p>Caricamento...</p>;
  if (!user) return <LoginScreen onSubmit={signInWithPassword} />;

  return (
    <div>
      <MapView photos={photos} onMapReady={handleMapReady} onOpenCluster={handleOpenCluster} />

      <header style={{ position: 'relative', zIndex: 1 }}>
        <span>Benvenuto, {user.email}</span>
        <button type="button" onClick={signOut}>Esci</button>
      </header>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <AlbumSwitcher albums={albums} activeAlbumId={activeAlbumId} onSelect={setActiveAlbumId} />

        <button type="button" onClick={() => setModal('create')}>Crea album</button>
        <button type="button" onClick={() => setModal('join')}>Unisciti con codice</button>

        {modal === 'create' && (
          <CreateAlbumModal
            onCreate={async (name, url) => {
              await createAlbum(name, url);
            }}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'join' && (
          <JoinAlbumModal
            onJoin={async (inviteCode) => {
              await joinAlbum(inviteCode);
            }}
            onClose={() => setModal(null)}
          />
        )}
      </div>

      {galleryPhotos && (
        <PhotoGalleryPanel
          photos={galleryPhotos}
          onClose={() => setGalleryPhotos(null)}
          onEditLocation={handleEditLocation}
        />
      )}

      {editingPhoto && (
        <LocationPickerMap
          initialLat={editingPhoto.latitude}
          initialLng={editingPhoto.longitude}
          onCancel={() => setEditingPhoto(null)}
          onConfirm={async (lat, lng) => {
            await updateLocation(editingPhoto.photoGuid, lat, lng, editingPhoto.locationLabel ?? undefined);
            setEditingPhoto(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
