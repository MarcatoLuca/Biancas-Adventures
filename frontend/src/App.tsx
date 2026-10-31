import { useState } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { useAuth } from './auth/useAuth';
import { LoginScreen } from './auth/LoginScreen';
import { useAlbums } from './albums/useAlbums';
import { AlbumSwitcher, type Album } from './albums/AlbumSwitcher';
import { AlbumSettingsScreen } from './settings/AlbumSettingsScreen';
import { CreateAlbumModal } from './albums/CreateAlbumModal';
import { JoinAlbumModal } from './albums/JoinAlbumModal';
import { MapView } from './map/MapView';
import { usePhotos } from './photos/usePhotos';
import { PhotoGalleryPanel } from './photos/PhotoGalleryPanel';
import { LocationPickerMap } from './photos/LocationPickerMap';
import { UnplacedQueuePanel } from './photos/UnplacedQueuePanel';
import { errorMessage } from './lib/errorMessage';
import { Dialog } from './ui/Dialog';
import { HudButton } from './hud/HudButton';
import { HudLayer } from './hud/HudLayer';
import './App.css';

function AdventureWorkspace({ email, signOut }: { email?: string; signOut: () => Promise<void> }) {
  const { albums, activeAlbumId, setActiveAlbumId, createAlbum, joinAlbum, reload, loading, error, updateAlbum } = useAlbums();
  const { photos, unplaced, loading: syncing, error: photosError, reload: syncPhotos, updateLocation } = usePhotos(activeAlbumId);
  const [modal, setModal] = useState<'create' | 'join' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<MaplibreMap | null>(null);
  const [galleryIds, setGalleryIds] = useState<string[] | 'all' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [settingsAlbum, setSettingsAlbum] = useState<Album | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const activeAlbum = albums.find((album) => album.id === activeAlbumId);
  const editingPhoto = photos.find((photo) => photo.photoGuid === editingId);

  async function handleSignOut() {
    setSessionError(null);
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      setSessionError(errorMessage(err));
    } finally {
      setSigningOut(false);
    }
  }

  function selectAlbum(id: string) {
    setGalleryIds(null);
    setEditingId(null);
    setQueueOpen(false);
    setSettingsAlbum(null);
    setActiveAlbumId(id);
    setMenuOpen(false);
  }

  return (
    <div className="game-shell">
      <a className="skip-link" href="#main-content">Vai al contenuto</a>
      <main id="main-content" className="game-screen" tabIndex={-1} aria-label="La mappa dei ricordi">
        <MapView key={activeAlbumId ?? 'no-album'} photos={photos} onMapReady={setMapInstance} onOpenCluster={(cluster) => setGalleryIds(cluster.photos.map((photo) => photo.photoGuid))} />

        <div className="hud-left">
          <header className="hud-title">
            <h1>
              <svg className="hud-brand-pin" viewBox="0 0 32 40" aria-hidden="true" focusable="false">
                <path d="M16 38S2 24 2 16a14 14 0 0 1 28 0c0 8-14 22-14 22Z" fill="#c33269" stroke="#fffdf5" strokeWidth="3" strokeLinejoin="round" />
                <path d="M16 23s-8-4.8-8-9a4.5 4.5 0 0 1 8-2.6A4.5 4.5 0 0 1 24 14c0 4.2-8 9-8 9Z" fill="#fffdf5" />
              </svg>
              <span className="hud-brand-name">Bianca's</span>{' '}
              <span className="hud-brand-adventures">Adventures</span>
            </h1>
            <h2 id="album-heading" className="hud-album-name" title={activeAlbum?.name}>{activeAlbum?.name ?? 'Il mondo ci aspetta!'}</h2>
          </header>
          <HudButton icon="sync" label="Sincronizza foto" tone="sky" disabled={!activeAlbum || syncing} busy={syncing} onClick={() => syncPhotos()} />
        </div>

        <div className="game-notices">
          {error && <div role="alert" className="notice notice-error"><p>{errorMessage(new Error(error))}</p><button className="btn btn-ghost" type="button" onClick={() => reload()} disabled={loading}>Riprova</button></div>}
          {loading && <p role="status" className="notice">Caricamento album…</p>}
          {photosError && <div role="alert" className="notice notice-error"><p>{errorMessage(new Error(photosError))}</p><button type="button" className="btn btn-ghost" disabled={syncing} onClick={() => syncPhotos()}>Riprova sincronizzazione</button></div>}
          {activeAlbum && !syncing && !photosError && photos.length === 0 && <p role="status" className="notice">Nessuna foto trovata. Verifica che l’album iCloud sia pubblico e contenga foto.</p>}
        </div>

        <HudLayer>
          <div className="hud-right">
            <HudButton icon="menu" label="Album e account" tone="grape" onClick={() => setMenuOpen(true)} expanded={menuOpen} />
            <HudButton icon="settings" label="Impostazioni album" tone="grass" disabled={!activeAlbum} onClick={() => activeAlbum && setSettingsAlbum(activeAlbum)} />
            <HudButton icon="photos" label="Tutte le foto" tone="coral" disabled={!activeAlbum} onClick={() => setGalleryIds('all')} />
            <HudButton icon="pin" label="Da posizionare" tone="sun" count={unplaced.length} disabled={!activeAlbum} onClick={() => setQueueOpen(true)} />
          </div>
        </HudLayer>

        {!activeAlbum && !loading && !error && (
          <section className="game-welcome" aria-labelledby="welcome-title">
            <span className="welcome-illustration" aria-hidden="true">✿</span>
            <h2 id="welcome-title">La tua avventura inizia qui!</h2>
            <p>Aggiungi un album iCloud e dai un posto ai vostri ricordi.</p>
            <button type="button" className="btn btn-primary" onClick={() => setModal('create')}>Crea il tuo primo album</button>
            <button type="button" className="btn btn-outline" onClick={() => setModal('join')}>Unisciti con codice</button>
          </section>
        )}
        {activeAlbum && <p role="status" className="sr-only">{syncing ? 'Cerco nuovi ricordi su iCloud…' : photosError ? '' : `${photos.length} foto nell’album. ${unplaced.length} da posizionare.`}</p>}
      </main>

      {menuOpen && (
        <Dialog title="Le tue avventure" onClose={() => setMenuOpen(false)} busy={signingOut}>
          <div className="form-stack">
            <p className="muted">Scegli un album e torna a esplorare il mondo.</p>
            <AlbumSwitcher albums={albums} activeAlbumId={activeAlbumId} onSelect={selectAlbum} onOpenSettings={setSettingsAlbum} />
            <div className="button-row">
              <button type="button" className="btn btn-primary" onClick={() => setModal('create')}>Crea album</button>
              <button type="button" className="btn btn-secondary" onClick={() => setModal('join')}>Unisciti con codice</button>
            </div>
            <div className="settings-section">
              <h3>Zoom della mappa</h3>
              <p className="field-help">Puoi usare anche rotella, gesto a due dita oppure i tasti + e − quando la mappa ha il focus.</p>
              <div className="button-row">
                <button type="button" className="btn btn-outline" disabled={!mapInstance} onClick={() => { mapInstance?.zoomIn({ duration: 0 }); setMenuOpen(false); }}>Avvicina</button>
                <button type="button" className="btn btn-outline" disabled={!mapInstance} onClick={() => { mapInstance?.zoomOut({ duration: 0 }); setMenuOpen(false); }}>Allontana</button>
              </div>
            </div>
            <div className="settings-section">
              <h3>Il tuo account</h3>
              <p className="account-email">{email}</p>
              {sessionError && <p role="alert" className="notice notice-error">{sessionError}</p>}
              <button type="button" className="btn btn-outline" onClick={handleSignOut} disabled={signingOut}>{signingOut ? 'Uscita…' : 'Esci'}</button>
            </div>
          </div>
        </Dialog>
      )}
      {modal === 'create' && <CreateAlbumModal onCreate={async (name, url) => { await createAlbum(name, url); setMenuOpen(false); }} onClose={() => setModal(null)} />}
      {modal === 'join' && <JoinAlbumModal onJoin={async (code) => { await joinAlbum(code); setMenuOpen(false); }} onClose={() => setModal(null)} />}
      {galleryIds && <PhotoGalleryPanel photos={galleryIds === 'all' ? photos : photos.filter((photo) => galleryIds.includes(photo.photoGuid))} onClose={() => setGalleryIds(null)} onEditLocation={(photo) => setEditingId(photo.photoGuid)} />}
      {queueOpen && <UnplacedQueuePanel photos={unplaced} totalPhotos={photos.length} onSelect={(photo) => setEditingId(photo.photoGuid)} onClose={() => setQueueOpen(false)} />}
      {editingPhoto && (
        <LocationPickerMap
          key={editingPhoto.photoGuid}
          initialLat={editingPhoto.latitude}
          initialLng={editingPhoto.longitude}
          onCancel={() => setEditingId(null)}
          onConfirm={async (lat, lng) => {
            const unchanged = lat === editingPhoto.latitude && lng === editingPhoto.longitude;
            await updateLocation(editingPhoto.photoGuid, lat, lng, unchanged ? editingPhoto.locationLabel ?? undefined : undefined);
            setEditingId(null);
          }}
        />
      )}
      {settingsAlbum && <AlbumSettingsScreen album={settingsAlbum} onClose={() => setSettingsAlbum(null)} onUpdated={(album) => { updateAlbum(album); setSettingsAlbum(album); }} />}
    </div>
  );
}

function App() {
  const { user, loading, error, signInWithPassword, signOut } = useAuth();
  if (loading) return <main className="app-loading"><p role="status">Preparo la tua prossima avventura…</p></main>;
  if (!user) return <LoginScreen onSubmit={signInWithPassword} initialError={error} />;
  return <AdventureWorkspace key={user.id} email={user.email} signOut={signOut} />;
}

export default App;
