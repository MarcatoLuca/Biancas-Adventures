import type { ReactNode } from 'react';

export function HudLayer({ children }: { children: ReactNode }) {
  return <nav className="hud-actions" aria-label="Azioni sulla mappa">{children}</nav>;
}
