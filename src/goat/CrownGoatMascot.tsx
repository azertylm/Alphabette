import React from 'react';

/**
 * @file CrownGoatMascot.tsx
 * Mascotte officielle « Goat Chèvre The King » : une chèvre couronnée,
 * dessinée en SVG (aucune image externe, net sur tous les écrans).
 */

interface CrownGoatMascotProps {
  className?: string;
  /** Variante dorée (par défaut) ou monochrome claire pour les fonds sombres. */
  variant?: 'gold' | 'light';
}

export const CrownGoatMascot: React.FC<CrownGoatMascotProps> = ({
  className = 'w-12 h-12',
  variant = 'gold',
}) => {
  const fur = variant === 'gold' ? '#1e293b' : '#0f172a';
  const crownMain = '#fbbf24';
  const crownDark = '#b45309';

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Chèvre couronnée Goat Chèvre The King"
    >
      {/* Couronne */}
      <path
        d="M14 20 L20 27 L26 15 L32 26 L38 15 L44 27 L50 20 L47 31 H17 Z"
        fill={crownMain}
        stroke={crownDark}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="12" r="2.6" fill="#fef3c7" stroke={crownDark} strokeWidth="1" />
      <circle cx="20" cy="17" r="1.7" fill="#fef3c7" />
      <circle cx="44" cy="17" r="1.7" fill="#fef3c7" />

      {/* Cornes */}
      <path
        d="M20 33 C14 30 12 24 15 20 C16 26 19 28 22 30 Z"
        fill="#e2e8f0"
        stroke="#94a3b8"
        strokeWidth="1.2"
      />
      <path
        d="M44 33 C50 30 52 24 49 20 C48 26 45 28 42 30 Z"
        fill="#e2e8f0"
        stroke="#94a3b8"
        strokeWidth="1.2"
      />

      {/* Tête */}
      <path
        d="M18 32 Q32 24 46 32 Q48 45 32 56 Q16 45 18 32 Z"
        fill={fur}
        stroke="#0b1220"
        strokeWidth="1.4"
      />

      {/* Oreilles */}
      <ellipse cx="16" cy="36" rx="5" ry="3" fill={fur} transform="rotate(-20 16 36)" />
      <ellipse cx="48" cy="36" rx="5" ry="3" fill={fur} transform="rotate(20 48 36)" />

      {/* Yeux */}
      <ellipse cx="26" cy="38" rx="2.4" ry="2.8" fill="#f8fafc" />
      <ellipse cx="38" cy="38" rx="2.4" ry="2.8" fill="#f8fafc" />
      <circle cx="26.6" cy="38.4" r="1.2" fill="#0b1220" />
      <circle cx="38.6" cy="38.4" r="1.2" fill="#0b1220" />

      {/* Museau + barbiche */}
      <path d="M27 48 Q32 51 37 48 Q32 53 27 48 Z" fill="#0b1220" />
      <path d="M30 52 L32 58 L34 52 Z" fill="#e2e8f0" />
    </svg>
  );
};
