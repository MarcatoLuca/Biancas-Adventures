import { useState } from 'react';
import { useAuth } from './auth/useAuth';
import { LoginScreen } from './auth/LoginScreen';
import { useAlbums } from './albums/useAlbums';
import { AlbumSwitcher } from './albums/AlbumSwitcher';
import { CreateAlbumModal } from './albums/CreateAlbumModal';
import { JoinAlbumModal } from './albums/JoinAlbumModal';
import './App.css';

function App() {
  const { user, loading, signInWithPassword, signOut } = useAuth();
  const { albums, activeAlbumId, setActiveAlbumId, createAlbum, joinAlbum } = useAlbums();
  const [modal, setModal] = useState<'create' | 'join' | null>(null);

  if (loading) return <p>Caricamento...</p>;
  if (!user) return <LoginScreen onSubmit={signInWithPassword} />;

  return (
    <div>
      <header>
        <span>Benvenuto, {user.email}</span>
        <button type="button" onClick={signOut}>Esci</button>
      </header>

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
  );
}

export default App;
