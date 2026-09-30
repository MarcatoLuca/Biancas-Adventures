import { useCallback, useState } from 'react';
import { useAuth } from './auth/useAuth';
import { LoginScreen } from './auth/LoginScreen';
import { useAlbums } from './albums/useAlbums';
import { AlbumSwitcher, type Album } from './albums/AlbumSwitcher';
import { AlbumSettingsScreen } from './settings/AlbumSettingsScreen';
import { CreateAlbumModal } from './albums/CreateAlbumModal';
import { JoinAlbumModal } from './albums/JoinAlbumModal';
import { MapView } from './map/MapView';
import { usePhotos, type Photo } from './photos/usePhotos';
import { PhotoGalleryPanel } from './photos/PhotoGalleryPanel';
import { LocationPickerMap } from './photos/LocationPickerMap';
import { UnplacedQueuePanel } from './photos/UnplacedQueuePanel';
import { HudLayer } from './hud/HudLayer';
import { HudButton } from './hud/HudButton';
import type { Cluster } from './map/useClusteredPhotos';
import './App.css';

function App() {
  const { user, loading, signInWithPassword, signOut } = useAuth();
  const { albums, activeAlbumId, setActiveAlbumId, createAlbum, joinAlbum } = useAlbums();
  const { photos, unplaced, updateLocation } = usePhotos(activeAlbumId);
  const [modal, setModal] = useState<'create' | 'join' | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[] | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [settingsAlbum, setSettingsAlbum] = useState<Album | null>(null);

  const handleMapReady = useCallback(() => {
    // Later tasks (city themes, HUD) attach layers here.
  }, []);

  const handleOpenCluster = useCallback((cluster: Cluster) => {
    setGalleryPhotos(cluster.photos);
  }, []);

  const handleEditLocation = useCallback((photo: Photo) => {
    setEditingPhoto(photo);
  }, []);

  if (loading) return <p className="app-loading">Caricamento...</p>;
  if (!user) return <LoginScreen onSubmit={signInWithPassword} />;

  return (
    <div>
      <MapView photos={photos} onMapReady={handleMapReady} onOpenCluster={handleOpenCluster} />

      <HudLayer>
        <HudButton
          icon="📷"
          count={unplaced.length}
          label="Foto da posizionare"
          onClick={() => setQueueOpen(true)}
        />
      </HudLayer>

      <header className="app-header" style={{ position: 'relative', zIndex: 1 }}>
        <h1 className="app-title">🗺️ Bianca's Adventures</h1>
        <span className="app-welcome">Ciao, {user.email}</span>
        <button type="button" className="btn btn-ghost" onClick={signOut}>Esci</button>
      </header>

      <div style={{ position: 'relative', zIndex: 1, padding: '0 16px' }}>
        <AlbumSwitcher
          albums={albums}
          activeAlbumId={activeAlbumId}
          onSelect={setActiveAlbumId}
          onOpenSettings={setSettingsAlbum}
        />

        <button type="button" className="btn btn-primary" onClick={() => setModal('create')}>
          ➕ Crea album
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setModal('join')}>
          🔑 Unisciti con codice
        </button>

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
          onLocationConfirmed={async (photo, lat, lng, label) => {
            await updateLocation(photo.photoGuid, lat, lng, label);
          }}
        />
      )}

      {queueOpen && (
        <UnplacedQueuePanel
          photos={unplaced}
          onSelect={(photo) => {
            setQueueOpen(false);
            setEditingPhoto(photo);
          }}
          onClose={() => setQueueOpen(false)}
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
      {settingsAlbum && (
        <AlbumSettingsScreen album={settingsAlbum} onClose={() => setSettingsAlbum(null)} />
      )}
    </div>
  );
}

export default App;
