import React, { useEffect, useMemo, useState } from 'react';
import { GoatPlayer } from './types';
import { buildFallbackAvatar } from './fallbackAvatar';

/**
 * @file PlayerAvatar.tsx
 * Photo officielle du joueur (vignette Wikimedia 300 px) avec repli automatique
 * sur un avatar SVG silhouetté + initiales si l'image est cassée ou indisponible.
 */

interface PlayerAvatarProps {
  player: GoatPlayer;
  className?: string;
  /** Position du cadrage : « top » privilégie les visages. */
  focus?: 'top' | 'center';
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ player, className = '', focus = 'top' }) => {
  const fallback = useMemo(() => buildFallbackAvatar(player.name), [player.name]);
  const [src, setSrc] = useState(player.image || fallback);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    player.image ? 'loading' : 'error',
  );

  useEffect(() => {
    setSrc(player.image || fallback);
    setStatus(player.image ? 'loading' : 'error');
  }, [player.image, fallback]);

  return (
    <div className={`relative overflow-hidden bg-slate-800 ${className}`}>
      {status === 'loading' && <div className="absolute inset-0 bg-slate-700 animate-pulse" aria-hidden="true" />}
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
        className={`w-full h-full object-cover ${focus === 'top' ? 'object-top' : 'object-center'} transition-opacity duration-300 ${
          status === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
