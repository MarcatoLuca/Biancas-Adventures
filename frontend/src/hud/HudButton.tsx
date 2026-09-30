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
        borderRadius: 16,
        border: 'none',
        background: 'rgba(20, 20, 30, 0.75)',
        color: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
      }}
    >
      {icon}
      {!!count && (
        <span
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            background: '#e0533d',
            borderRadius: 999,
            padding: '2px 6px',
            fontSize: 12,
          }}
        >
          {count}
        </span>
      )}
    </motion.button>
  );
}
