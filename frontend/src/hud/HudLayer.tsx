import type { ReactNode } from 'react';

export function HudLayer({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}
