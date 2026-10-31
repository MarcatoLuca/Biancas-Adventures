import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateAlbumModal } from '../../src/albums/CreateAlbumModal';
import { JoinAlbumModal } from '../../src/albums/JoinAlbumModal';

describe('album dialogs', () => {
  it('names the create dialog, focuses its first field and handles Escape', () => {
    const close = vi.fn();
    render(<CreateAlbumModal onCreate={vi.fn()} onClose={close} />);
    expect(screen.getByRole('dialog', { name: /nuovo album/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nome album/i)).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });

  it('prevents duplicate joins while waiting and announces failures', async () => {
    let rejectJoin!: (reason: Error) => void;
    const join = vi.fn(() => new Promise<void>((_, reject) => { rejectJoin = reject; }));
    render(<JoinAlbumModal onJoin={join} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/codice invito/i), { target: { value: 'ABC123' } });
    fireEvent.click(screen.getByRole('button', { name: /unisciti$/i }));
    expect(screen.getByRole('button', { name: /accesso|attendi|unione/i })).toBeDisabled();
    rejectJoin(new Error('invalid_invite_code'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/codice.*non.*valido/i));
    expect(join).toHaveBeenCalledOnce();
  });
});
