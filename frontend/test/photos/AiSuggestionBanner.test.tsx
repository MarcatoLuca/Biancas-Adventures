import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/workerApi', () => ({ request: vi.fn() }));
import { request } from '../../src/lib/workerApi';
import { AiSuggestionBanner } from '../../src/photos/AiSuggestionBanner';

describe('AiSuggestionBanner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches and displays a suggestion automatically', async () => {
    (request as any).mockResolvedValueOnce({
      suggestion: { suggested_label: 'Napoli, Italia', reasoning: 'Stessi vestiti', suggested_lat: 40.85, suggested_lng: 14.27 },
    });

    render(<AiSuggestionBanner albumId="a1" photoGuid="g1" onAccepted={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/napoli, italia/i)).toBeInTheDocument());
    expect(screen.getByText(/stessi vestiti/i)).toBeInTheDocument();
  });

  it('renders nothing when Gemini has no suggestion', async () => {
    (request as any).mockResolvedValueOnce({ suggestion: null });
    render(<AiSuggestionBanner albumId="a1" photoGuid="g1" onAccepted={vi.fn()} />);
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /accetta/i })).not.toBeInTheDocument();
  });

  it('calls onAccepted with coordinates when the user accepts', async () => {
    (request as any)
      .mockResolvedValueOnce({
        suggestion: { suggested_label: 'Napoli, Italia', reasoning: 'x', suggested_lat: 40.85, suggested_lng: 14.27 },
      })
      .mockResolvedValueOnce({ status: 'accepted' });
    const onAccepted = vi.fn();

    render(<AiSuggestionBanner albumId="a1" photoGuid="g1" onAccepted={onAccepted} />);
    await waitFor(() => screen.getByRole('button', { name: /accetta/i }));
    fireEvent.click(screen.getByRole('button', { name: /accetta/i }));

    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith(40.85, 14.27, 'Napoli, Italia'));
  });

  it('shows an already-resolved notice and hides actions on a 409 conflict', async () => {
    (request as any)
      .mockResolvedValueOnce({
        suggestion: { suggested_label: 'Napoli, Italia', reasoning: 'x', suggested_lat: 40.85, suggested_lng: 14.27 },
      })
      .mockRejectedValueOnce(Object.assign(new Error('suggestion_already_resolved'), { status: 409 }));

    render(<AiSuggestionBanner albumId="a1" photoGuid="g1" onAccepted={vi.fn()} />);
    await waitFor(() => screen.getByRole('button', { name: /accetta/i }));
    fireEvent.click(screen.getByRole('button', { name: /accetta/i }));

    await waitFor(() => expect(screen.getByText(/già stata gestita/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /accetta/i })).not.toBeInTheDocument();
  });
});
