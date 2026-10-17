import React, { useEffect, useMemo, useState } from 'react';
import { GoatPlayer } from './types';
import { buildFallbackAvatar } from './fallbackAvatar';
import { frameImageStyle, usePhotoFrame } from './photoFrames';
import { playerPhotoUrl } from './images';

/**
 * @file PlayerAvatar.tsx
 * Photo du joueur (vignette Wikimedia) affichée **en entier** par défaut,
 * avec repli automatique sur un avatar SVG + initiales si l'image est indisponible.
 * Le cadrage personnalisé du joueur (déplacement / zoom) est appliqué automatiquement.
 */

interface PlayerAvatarProps {
  player: GoatPlayer;
  className?: string;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ player, className = '' }) => {
  const fallback = useMemo(() => buildFallbackAvatar(player.name), [player.name]);
  const frame = usePhotoFrame(player.id);
  const photoUrl = useMemo(() => playerPhotoUrl(player.image), [player.image]);
  const [src, setSrc] = useState(photoUrl || fallback);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    photoUrl ? 'loading' : 'error',
  );

  useEffect(() => {
    setSrc(photoUrl || fallback);
    setStatus(photoUrl ? 'loading' : 'error');
  }, [photoUrl, fallback]);

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-b from-slate-800/80 to-slate-950 ${className}`}
    >
      {status === 'loading' && <div className="absolute inset-0 bg-slate-800 animate-pulse" aria-hidden="true" />}
      <img
        src={src}
        alt={player.name}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setStatus('ready')}
        onError={() => {
          if (src !== fallback) {
            setSrc(fallback);
            setStatus('error');
          } else {
            setStatus('error');
          }
        }}
        style={frameImageStyle(status === 'error' ? null : frame)}
        className={`w-full h-full transition-opacity duration-300 ${
          status === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
