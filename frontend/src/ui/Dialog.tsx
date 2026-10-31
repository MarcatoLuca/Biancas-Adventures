import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  busy?: boolean;
}

export function Dialog({ title, onClose, children, wide = false, busy = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const target = dialog.querySelector<HTMLElement>('input, [data-initial-focus]') ??
      dialog.querySelector<HTMLElement>('button');
    target?.focus();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus();
      else {
        const remaining = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
        remaining[remaining.length - 1]?.querySelector<HTMLElement>('button')?.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? ' dialog-wide' : ''}`}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          if (!busy) onClose();
        }
      }}
    >
      <header className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy} aria-label={`Chiudi: ${title}`}>
          <span aria-hidden="true">×</span> Chiudi
        </button>
      </header>
      {children}
    </dialog>
  );
}
