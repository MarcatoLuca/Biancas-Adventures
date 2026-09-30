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
    return <p>Nessun album ancora: creane uno o unisciti con un codice invito.</p>;
  }

  return (
    <ul>
      {albums.map((album) => (
        <li key={album.id}>
          <button
            aria-pressed={album.id === activeAlbumId}
            onClick={() => onSelect(album.id)}
          >
            {album.name}
          </button>
          {onOpenSettings && album.id === activeAlbumId && (
            <button aria-label="Impostazioni album" onClick={() => onOpenSettings(album)}>
              ⚙️
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
