import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface HudButtonProps {
  icon: ReactNode;
  count?: number;
  onClick: () => void;
  label: string;
}

export function HudButton({ icon, count, onClick, label }: HudButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={label}
      style={{
        position: 'relative',
        width: 56,
        height: 56,
        borderRadius: 18,
        border: '3px solid white',
        background: 'var(--color-coral)',
        color: 'white',
        boxShadow: '0 4px 0 rgba(0,0,0,0.15), 0 6px 14px rgba(0,0,0,0.18)',
        fontSize: 22,
      }}
    >
      {icon}
      {!!count && (
        <span
          className="badge"
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            background: 'var(--color-sun-dark)',
          }}
        >
          {count}
        </span>
      )}
    </motion.button>
  );
}
