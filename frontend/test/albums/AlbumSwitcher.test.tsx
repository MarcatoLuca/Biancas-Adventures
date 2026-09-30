import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AlbumSwitcher } from '../../src/albums/AlbumSwitcher';

describe('AlbumSwitcher', () => {
  it('lists albums and calls onSelect when one is chosen', () => {
    const onSelect = vi.fn();
    render(
      <AlbumSwitcher
        albums={[
          { id: 'a1', name: 'Famiglia', role: 'owner' },
          { id: 'a2', name: 'Amici', role: 'member' },
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
});
