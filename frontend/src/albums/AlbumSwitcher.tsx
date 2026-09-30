export interface Album {
  id: string;
  name: string;
  role: 'owner' | 'member';
  inviteCode: string;
  iCloudAlbumUrl: string;
}

interface AlbumSwitcherProps {
  albums: Album[];
  activeAlbumId: string | null;
  onSelect: (albumId: string) => void;
  onOpenSettings?: (album: Album) => void;
}

export function AlbumSwitcher({ albums, activeAlbumId, onSelect, onOpenSettings }: AlbumSwitcherProps) {
  if (albums.length === 0) {
    return (
      <p style={{ color: 'var(--color-ink-muted)', fontWeight: 700 }}>
        Nessun album ancora: creane uno o unisciti con un codice invito.
      </p>
    );
  }

  return (
    <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 0, margin: '12px 0', listStyle: 'none' }}>
      {albums.map((album) => {
        const isActive = album.id === activeAlbumId;
        return (
          <li key={album.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              className="btn"
              aria-pressed={isActive}
              onClick={() => onSelect(album.id)}
              style={{
                background: isActive ? 'var(--color-grape)' : 'var(--color-sand)',
                color: isActive ? 'white' : 'var(--color-ink)',
                boxShadow: isActive ? '0 4px 0 rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {isActive ? '📍 ' : ''}
              {album.name}
            </button>
            {onOpenSettings && isActive && (
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="Impostazioni album"
                onClick={() => onOpenSettings(album)}
                style={{ fontSize: 18, padding: '6px 8px' }}
              >
                ⚙️
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
