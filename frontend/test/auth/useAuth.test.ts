import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../../src/lib/supabaseClient', () => ({ supabase: { auth } }));
import { useAuth } from '../../src/auth/useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it('leaves loading state and reports a session lookup failure', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error('Failed to fetch') });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to fetch');
    expect(result.current.user).toBeNull();
  });

  it('reports an unexpected session lookup rejection instead of leaving a spinner', async () => {
    auth.getSession.mockRejectedValue(new Error('Failed to fetch'));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to fetch');
  });

  it('surfaces sign-out failure so the UI does not pretend the user logged out', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null });
    auth.signOut.mockResolvedValue({ error: new Error('Failed to fetch') });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).not.toBeNull());
    await act(async () => { await expect(result.current.signOut()).rejects.toThrow('Failed to fetch'); });
    expect(result.current.user?.id).toBe('test-user');
  });
});
