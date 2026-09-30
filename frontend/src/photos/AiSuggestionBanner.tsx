import { useState } from 'react';
import { useAiSuggestion } from './useAiSuggestion';

interface AiSuggestionBannerProps {
  albumId: string;
  photoGuid: string;
  onAccepted: (lat: number, lng: number, label: string) => void;
}

export function AiSuggestionBanner({ albumId, photoGuid, onAccepted }: AiSuggestionBannerProps) {
  const { suggestion, respond } = useAiSuggestion(albumId, photoGuid, true);
  const [conflict, setConflict] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!suggestion || dismissed) return null;

  async function handle(action: 'accept' | 'reject') {
    const result = await respond(action);
    if (result?.conflict) {
      setConflict(true);
      return;
    }
    if (action === 'accept' && suggestion) {
      onAccepted(suggestion.suggested_lat, suggestion.suggested_lng, suggestion.suggested_label);
    }
    setDismissed(true);
  }

  if (conflict) {
    return <p>Questa proposta è già stata gestita da un altro membro dell'album.</p>;
  }

  return (
    <div>
      <p>
        Suggerimento AI: <strong>{suggestion.suggested_label}</strong>
      </p>
      <p>{suggestion.reasoning}</p>
      <button onClick={() => handle('accept')}>Accetta</button>
      <button onClick={() => handle('reject')}>Rifiuta</button>
    </div>
  );
}
