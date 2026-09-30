import { useEffect, useState } from 'react';
import { request } from '../lib/workerApi';

interface Suggestion {
  suggested_label: string;
  reasoning: string;
  suggested_lat: number;
  suggested_lng: number;
}

export function useAiSuggestion(albumId: string, photoGuid: string, enabled: boolean) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    request<{ suggestion: Suggestion | null }>(`/albums/${albumId}/photos/${photoGuid}/ai-suggest`, {
      method: 'POST',
    })
      .then((res) => setSuggestion(res.suggestion))
      .finally(() => setLoading(false));
  }, [albumId, photoGuid, enabled]);

  async function respond(action: 'accept' | 'reject') {
    if (!suggestion) return;
    try {
      await request(`/albums/${albumId}/photos/${photoGuid}/ai-suggest/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setResolved(true);
      return { conflict: false as const };
    } catch {
      setResolved(true);
      return { conflict: true as const };
    }
  }

  return { suggestion, loading, resolved, respond };
}
