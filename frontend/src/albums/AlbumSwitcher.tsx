export interface Album {
  id: string;
  name: string;
  role: 'owner' | 'member';
}

interface AlbumSwitcherProps {
  albums: Album[];
  activeAlbumId: string | null;
  onSelect: (albumId: string) => void;
}

export function AlbumSwitcher({ albums, activeAlbumId, onSelect }: AlbumSwitcherProps) {
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
        </li>
      ))}
    </ul>
  );
}
