import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginScreen } from '../../src/auth/LoginScreen';

describe('LoginScreen', () => {
  it('calls onSubmit with the entered email and password', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginScreen onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /accedi/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('a@b.com', 'secret123'));
  });

  it('shows an error message when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('invalid_credentials'));
    render(<LoginScreen onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /accedi/i }));

    expect(await screen.findByText(/invalid_credentials/i)).toBeInTheDocument();
  });
});
