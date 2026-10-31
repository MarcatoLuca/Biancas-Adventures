import type { ReactNode } from 'react';

const icons = {
  menu: <><path d="M5 5h14v14H5z" /><path d="M9 5v14M12 9h4M12 13h4" /></>,
  photos: <><rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="8" cy="10" r="1.5" /><path d="m4 18 5-5 4 3 3-5 5 7M7 2h10" /></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  sync: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></>,
  settings: <><path d="m10 3-.7 2.2-2 .9L5 5.5 3 9l1.7 1.6v2.8L3 15l2 3.5 2.3-.6 2 .9L10 21h4l.7-2.2 2-.9 2.3.6 2-3.5-1.7-1.6v-2.8L21 9l-2-3.5-2.3.6-2-.9L14 3Z" /><circle cx="12" cy="12" r="3" /></>,
} satisfies Record<string, ReactNode>;

interface HudButtonProps {
  icon: keyof typeof icons;
  count?: number;
  onClick: () => void;
  label: string;
  tone?: 'coral' | 'sun' | 'sky' | 'grape' | 'grass';
  disabled?: boolean;
  busy?: boolean;
  expanded?: boolean;
}

export function HudButton({ icon, count, onClick, label, tone = 'coral', disabled = false, busy = false, expanded }: HudButtonProps) {
  return (
    <button
      type="button"
      className={`hud-button hud-${tone}${busy ? ' is-busy' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={count === undefined ? label : `${label}: ${count}`}
      aria-expanded={expanded}
      aria-haspopup={expanded === undefined ? undefined : 'dialog'}
      aria-busy={busy || undefined}
    >
      <span className="hud-candy">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[icon]}</svg>
        {count !== undefined && count > 0 && <span className="hud-count" aria-hidden="true">{count}</span>}
      </span>
    </button>
  );
}
