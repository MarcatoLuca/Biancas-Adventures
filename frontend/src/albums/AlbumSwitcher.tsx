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
  if (albums.length === 0) return <p className="empty-albums">Nessun album ancora: creane uno o unisciti con un codice invito.</p>;

  return (
    <ul className="album-list" aria-label="I tuoi album">
      {albums.map((album) => {
        const active = album.id === activeAlbumId;
        return (
          <li key={album.id} className={active ? 'album-item is-active' : 'album-item'}>
            <button type="button" className="album-select" aria-pressed={active} onClick={() => onSelect(album.id)}>
              <span className="album-cover" aria-hidden="true">▧</span>
              <span className="album-item-name">{album.name}{' '}<small>{album.role === 'owner' ? 'Il tuo album' : 'Album condiviso'}</small></span>
            </button>
            {onOpenSettings && active && <button type="button" className="btn btn-ghost album-settings" aria-label={`Impostazioni album ${album.name}`} onClick={() => onOpenSettings(album)}><span aria-hidden="true">⚙</span></button>}
          </li>
        );
      })}
    </ul>
  );
}
