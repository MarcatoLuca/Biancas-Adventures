interface PhotoRef {
  photoGuid: string;
  thumbUrl: string | null;
  dateCreated: string | null;
}

interface ContextPhoto extends PhotoRef {
  locationLabel: string;
  latitude: number;
  longitude: number;
}

interface Suggestion {
  latitude: number;
  longitude: number;
  locationLabel: string;
  reasoning: string;
}

export async function suggestLocation(
  apiKey: string,
  target: PhotoRef,
  context: ContextPhoto[]
): Promise<Suggestion | null> {
  if (context.length === 0) return null;

  const prompt = [
    'Sei un assistente che deduce la posizione geografica probabile di una foto di famiglia',
    'basandoti su indizi visivi (vestiti, paesaggio) e sulla vicinanza di data rispetto ad altre',
    'foto dello stesso album gia georeferenziate. Rispondi SOLO con un oggetto JSON con le chiavi',
    'latitude, longitude, locationLabel, reasoning (breve, in italiano). Se non hai abbastanza',
    'indizi per una ipotesi ragionevole, rispondi con {"noSuggestion": true}.',
    '',
    `Foto da geolocalizzare: data=${target.dateCreated ?? 'sconosciuta'}`,
    'Foto gia' + ' posizionate nello stesso album:',
    ...context.map(
      (c) => `- data=${c.dateCreated ?? 'sconosciuta'}, luogo=${c.locationLabel} (lat=${c.latitude}, lng=${c.longitude})`
    ),
  ].join('\n');

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (parsed.noSuggestion) return null;
    if (
      typeof parsed.latitude !== 'number' ||
      typeof parsed.longitude !== 'number' ||
      typeof parsed.locationLabel !== 'string'
    ) {
      return null;
    }
    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      locationLabel: parsed.locationLabel,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch {
    return null;
  }
}
