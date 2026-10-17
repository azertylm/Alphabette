import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Crop, ExternalLink, RotateCcw, Sparkles, X } from 'lucide-react';
import { GoatPlayer } from './types';
import { playerPhotoUrl } from './images';
import {
  DEFAULT_FRAME,
  FRAME_PRESETS,
  MAX_ZOOM,
  MIN_ZOOM,
  PhotoFrame,
  clearPhotoFrame,
  frameImageStyle,
  normalizeFrame,
  savePhotoFrame,
  usePhotoFrame,
} from './photoFrames';

/**
 * @file PhotoFrameEditor.tsx
 * Éditeur de cadrage d'une photo de joueur : glisser pour décaler, régler le zoom,
 * ou choisir un préréglage (image entière, visage, buste). Le réglage est conservé
 * dans le navigateur et appliqué partout (réserve, pyramide, image de partage).
 */

interface PhotoFrameEditorProps {
  player: GoatPlayer;
  onClose: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const PhotoFrameEditor: React.FC<PhotoFrameEditorProps> = ({ player, onClose }) => {
  const stored = usePhotoFrame(player.id);
  const [frame, setFrame] = useState<PhotoFrame>(stored ?? DEFAULT_FRAME);
  const [isDragging, setIsDragging] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; frame: PhotoFrame } | null>(null);

  const isCrop = frame.mode === 'crop';
  const canAdjust = Boolean(player.image);

  // Fermeture au clavier (Échap) et blocage du défilement de la page.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const previewStyle = useMemo(() => frameImageStyle(frame), [frame]);

  /** Décalage de la photo au glisser (1:1 avec le mouvement du doigt / de la souris). */
  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const preview = previewRef.current;
    const image = imageRef.current;
    if (!drag || !preview || !image?.naturalWidth) return;

    const box = preview.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;

    const coverScale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const overflowX = Math.max(1, image.naturalWidth * coverScale - box.width);
    const overflowY = Math.max(1, image.naturalHeight * coverScale - box.height);
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    // Décalage normalisé : on déplace l'image du même nombre de pixels que le geste.
    setFrame({
      mode: 'crop',
      zoom: drag.frame.zoom,
      x: clamp(drag.frame.x - (dx / overflowX) * 2, -1, 1),
      y: clamp(drag.frame.y - (dy / overflowY) * 2, -1, 1),
    });
  }, []);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canAdjust) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, frame };
    setIsDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture indisponible (souris synthétique) : le glisser reste fonctionnel */
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    setIsDragging(false);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* ignore */
    }
  };

  const handleSave = () => {
    savePhotoFrame(player.id, frame);
    onClose();
  };

  const handleReset = () => {
    clearPhotoFrame(player.id);
    setFrame(DEFAULT_FRAME);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Ajuster la photo de ${player.name}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-800">
          <div className="min-w-0">
            <h3 className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest">
              <Crop className="w-4 h-4 text-amber-400" />
              Ajuster la photo
            </h3>
            <p className="text-xs text-slate-400 mt-1 truncate">
              <span className="font-bold text-slate-200">{player.name}</span> · {player.career}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Fermer"
            className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Aperçu déplaçable */}
        <div className="px-5 pt-4 flex justify-center">
          <div
            ref={previewRef}
            onPointerDown={startDrag}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`relative w-[240px] sm:w-[264px] aspect-[4/5] overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-800/80 to-slate-950 touch-none select-none ${
              canAdjust ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-not-allowed'
            }`}
          >
            <img
              ref={imageRef}
              src={playerPhotoUrl(player.image)}
              alt={player.name}
              draggable={false}
              style={previewStyle}
              className="w-full h-full pointer-events-none"
            />
            {isCrop && (
              <span className="absolute bottom-2 left-2 rounded-lg bg-slate-950/80 px-2 py-1 text-[10px] font-bold text-amber-300">
                Décalage {Math.round(frame.x * 100)}% / {Math.round(frame.y * 100)}%
              </span>
            )}
          </div>
        </div>

        <p className="px-5 pt-3 text-[11px] text-slate-400 text-center">
          {canAdjust
            ? 'Glisse la photo pour la décaler : le geste suit exactement ton doigt.'
            : 'Aucune photo disponible pour ce joueur (avatar de secours).'}
        </p>

        {/* Préréglages */}
        <div className="px-5 pt-3 flex flex-wrap gap-2 justify-center">
          {FRAME_PRESETS.map((preset) => {
            const active =
              frame.mode === preset.frame.mode &&
              (preset.frame.mode === 'contain' ||
                (Math.abs(frame.zoom - preset.frame.zoom) < 0.02 &&
                  Math.abs(frame.x - preset.frame.x) < 0.02 &&
                  Math.abs(frame.y - preset.frame.y) < 0.02));
            return (
              <button
                key={preset.id}
                type="button"
                disabled={!canAdjust}
                onClick={() => setFrame(preset.frame)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  active
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-950/70 border border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {preset.id === 'full' ? <Sparkles className="w-3.5 h-3.5" /> : <Crop className="w-3.5 h-3.5" />}
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Zoom */}
        <div className="px-5 pt-4">
          <label className="flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 shrink-0">Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={frame.zoom}
              disabled={!canAdjust}
              onChange={(event) =>
                setFrame((current) =>
                  normalizeFrame({ ...current, mode: 'crop', zoom: Number(event.target.value) }),
                )
              }
              className="flex-1 accent-amber-400 disabled:opacity-40"
            />
            <span className="w-12 text-right text-[11px] font-bold text-slate-300">
              ×{frame.zoom.toFixed(2)}
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 mt-4 bg-slate-950/50 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Image entière
          </button>

          <div className="flex-1" />

          {player.commonsUrl && (
            <a
              href={player.commonsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300"
              title="Crédit et licence de la photo (Wikimedia Commons)"
            >
              <span>Crédit photo</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};
