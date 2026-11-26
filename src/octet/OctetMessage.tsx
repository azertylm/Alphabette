import React, { useState } from 'react';
import type { MessageOctet, PoseOctet, VarianteOctet } from './messages';

/**
 * @file OctetMessage.tsx
 * Message contextuel d'Octet : texte explicite + variante + illustration facultative.
 * - Aucune décision cachée, aucun appel réseau autre que l'image locale, aucune IA, aucun stockage.
 * - L'image est décorative (alt vide) : tout le sens est dans le texte. Si elle ne charge pas, le message reste complet.
 * - Image fixe, ratio conservé (width/height + height:auto), pas d'animation. Voir docs/octet-voice.md.
 * - `live` : à n'utiliser que pour un résultat d'action (envoi) ; sinon le message n'est pas annoncé automatiquement.
 */

export const DOSSIER_OCTET = '/assets/octet/';

interface Props {
  message?: MessageOctet;
  variante?: VarianteOctet;
  titre?: string;
  texte?: string;
  pose?: PoseOctet | null;
  /** Contexte (page, étape) : exposé en data-attribut pour les tests et le style, jamais envoyé nulle part. */
  contexte?: string;
  live?: boolean;
  onFermer?: () => void;
  taille?: number;
  children?: React.ReactNode;
}

export const OctetMessage: React.FC<Props> = ({ message, variante, titre, texte, pose, contexte, live = false, onFermer, taille = 88, children }) => {
  const v = variante ?? message?.variante ?? 'tip';
  const t = titre ?? message?.titre;
  const corps = texte ?? message?.texte;
  const p = pose === undefined ? message?.pose : pose;
  const [imageOk, setImageOk] = useState(true);
  return (
    <aside className={`octet-msg octet-msg--${v}`} data-octet-variante={v} data-octet-contexte={contexte} role={live ? 'status' : undefined}>
      {p && imageOk && (
        <img className="octet-msg__img" src={`${DOSSIER_OCTET}octet-${p}.webp`} alt="" width={taille} height={taille} loading="lazy" decoding="async" onError={() => setImageOk(false)} />
      )}
      <div className="octet-msg__corps">
        {t && <p className="octet-msg__titre">{t}</p>}
        {corps && <p className="octet-msg__texte">{corps}</p>}
        {children}
      </div>
      {onFermer && <button type="button" className="octet-msg__fermer" onClick={onFermer}>Masquer ce message</button>}
    </aside>
  );
};
