import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AlbumSwitcher } from '../../src/albums/AlbumSwitcher';

describe('AlbumSwitcher', () => {
  it('lists albums and calls onSelect when one is chosen', () => {
    const onSelect = vi.fn();
    render(
      <AlbumSwitcher
        albums={[
          { id: 'a1', name: 'Famiglia', role: 'owner', inviteCode: 'CODE1', iCloudAlbumUrl: 'https://x' },
          { id: 'a2', name: 'Amici', role: 'member', inviteCode: 'CODE2', iCloudAlbumUrl: 'https://y' },
        ]}
        activeAlbumId="a1"
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByText('Amici'));
    expect(onSelect).toHaveBeenCalledWith('a2');
  });

  it('renders a message when there are no albums yet', () => {
    render(<AlbumSwitcher albums={[]} activeAlbumId={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/nessun album/i)).toBeInTheDocument();
  });

  it('shows a settings button next to the active album and calls onOpenSettings with it', () => {
    const onOpenSettings = vi.fn();
    render(
      <AlbumSwitcher
        albums={[
          { id: 'a1', name: 'Famiglia', role: 'owner', inviteCode: 'CODE1', iCloudAlbumUrl: 'https://x' },
          { id: 'a2', name: 'Amici', role: 'member', inviteCode: 'CODE2', iCloudAlbumUrl: 'https://y' },
        ]}
        activeAlbumId="a1"
        onSelect={vi.fn()}
        onOpenSettings={onOpenSettings}
      />
    );

    const settingsButtons = screen.getAllByRole('button', { name: /impostazioni/i });
    expect(settingsButtons).toHaveLength(1);
    fireEvent.click(settingsButtons[0]);
    expect(onOpenSettings).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', name: 'Famiglia', role: 'owner' })
    );
  });
});
