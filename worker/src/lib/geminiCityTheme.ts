interface CityTheme {
  primary: string;
  secondary: string;
  accent: string;
  reasoning: string;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function generateCityTheme(apiKey: string, cityLabel: string): Promise<CityTheme | null> {
  const prompt = [
    'Genera una palette di 3 colori esadecimali che rappresenti visivamente la citta o il luogo',
    `"${cityLabel}", pensando a paesaggio, architettura e cultura locale.`,
    'Rispondi SOLO con un oggetto JSON con le chiavi primary, secondary, accent (stringhe hex',
    'tipo "#rrggbb") e reasoning (una frase breve in italiano).',
  ].join(' ');

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

    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (![parsed.primary, parsed.secondary, parsed.accent].every((c) => typeof c === 'string' && HEX_RE.test(c))) {
      return null;
    }
    return {
      primary: parsed.primary,
      secondary: parsed.secondary,
      accent: parsed.accent,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch {
    return null;
  }
}
