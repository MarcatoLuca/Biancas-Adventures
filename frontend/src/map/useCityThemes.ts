import { useEffect, useState } from 'react';
import { request } from '../lib/workerApi';
import type { Photo } from '../photos/usePhotos';

interface CityTheme {
  primary: string;
  secondary: string;
  accent: string;
}

export function useCityThemes(photos: Photo[]): Record<string, CityTheme> {
  const [themes, setThemes] = useState<Record<string, CityTheme>>({});

  const labels = Array.from(
    new Set(photos.map((p) => p.locationLabel).filter((l): l is string => !!l))
  );

  useEffect(() => {
    let cancelled = false;
    labels
      .filter((label) => !(label in themes))
      .forEach((label) => {
        request<{ theme: CityTheme | null }>(`/city-themes/${encodeURIComponent(label)}`).then((res) => {
          if (cancelled || !res.theme) return;
          setThemes((prev) => ({ ...prev, [label]: res.theme! }));
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels.join('|')]);

  return themes;
}
