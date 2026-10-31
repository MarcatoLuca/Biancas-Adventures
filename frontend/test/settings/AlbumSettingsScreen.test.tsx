import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/workerApi', () => ({ request: vi.fn() }));
import { request } from '../../src/lib/workerApi';
import { AlbumSettingsScreen } from '../../src/settings/AlbumSettingsScreen';

const ownerAlbum = {
  id: 'a1',
  name: 'Family',
  inviteCode: 'ABC123',
  iCloudAlbumUrl: 'https://x',
  role: 'owner' as const,
};
const memberAlbum = { ...ownerAlbum, role: 'member' as const };

describe('AlbumSettingsScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows rename and regenerate-invite controls only for the owner', () => {
    render(<AlbumSettingsScreen album={ownerAlbum} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /rinomina/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rigenera codice/i })).toBeInTheDocument();
  });

  it('hides owner-only controls for a regular member', () => {
    render(<AlbumSettingsScreen album={memberAlbum} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /rinomina/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rigenera codice/i })).not.toBeInTheDocument();
  });

  it('shows the current invite code to every member', () => {
    render(<AlbumSettingsScreen album={memberAlbum} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/codice invito/i)).toHaveValue('ABC123');
  });

  it('calls the rename route with the new name', async () => {
    (request as any).mockResolvedValue({ album: { ...ownerAlbum, name: 'New name' } });
    render(<AlbumSettingsScreen album={ownerAlbum} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/nome album/i), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: /rinomina/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/albums/a1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New name' }),
      })
    );
  });

  it('announces a successful rename and updates the album in the parent', async () => {
    vi.mocked(request).mockResolvedValue({ album: { ...ownerAlbum, name: 'Vacanze' } });
    const onUpdated = vi.fn();
    render(<AlbumSettingsScreen album={ownerAlbum} onClose={vi.fn()} onUpdated={onUpdated} />);
    fireEvent.change(screen.getByLabelText(/nome album/i), { target: { value: 'Vacanze' } });
    fireEvent.click(screen.getByRole('button', { name: /rinomina/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/salvato/i));
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ name: 'Vacanze' }));
  });

  it('reports regeneration failure and preserves the existing code', async () => {
    vi.mocked(request).mockRejectedValue(new Error('could_not_regenerate_invite'));
    render(<AlbumSettingsScreen album={ownerAlbum} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /rigenera codice/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/codice/i));
    expect(screen.getByLabelText(/codice invito/i)).toHaveValue('ABC123');
  });
});
