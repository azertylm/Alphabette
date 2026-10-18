import { useState } from 'react';
import { AppShell, type AlphaAppConfig } from '@alphabette/shell';
import '@alphabette/shell/style.css';

/**
 * Aperçu vivant de la base commune (@alphabette/shell).
 *
 * Disponible en développement sur http://localhost:3000/base — sert à valider
 * le rendu des deux barres avant de les intégrer à une application.
 */

const ACCENTS = [
  { label: 'Bleu', value: '#2563eb' },
  { label: 'Vert', value: '#059669' },
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Rose', value: '#db2777' },
  { label: 'Ambre', value: '#d97706' },
];

const demoApp: AlphaAppConfig = {
  key: 'infos-perso',
  name: 'Info Perso',
  tagline: 'Votre curation intelligente hautement personnalisée',
  icon: '📰',
  donUrl: 'https://alphabette.fr/don',
  accountUrl: 'https://alphabette.fr/compte',
  apiKeysUrl: 'https://alphabette.fr/cles',
  counter: { unlocked: 3, total: 16, trialDaysLeft: 7 },
  apiKeyState: 'ok',
  accountState: 'ok',
};

export function BasePreview() {
  const [accent, setAccent] = useState(ACCENTS[0].value);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          padding: '0.6rem 1rem',
          background: '#0a1226',
          color: '#cbd5e1',
          fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <strong style={{ color: '#fff' }}>Aperçu de la base</strong>
        <span>couleur d’identité du site :</span>
        {ACCENTS.map((a) => (
          <button
            key={a.value}
            onClick={() => setAccent(a.value)}
            style={{
              padding: '0.25rem 0.7rem',
              borderRadius: 999,
              border: accent === a.value ? '2px solid #fff' : '1px solid #334155',
              background: a.value,
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      <AppShell app={{ ...demoApp, accent }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.5rem' }}>
            Contenu de l’application
          </h1>
          <p style={{ color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            Ici vient le contenu propre à chaque application. Les deux barres
            ci-dessus sont fournies par <code>@alphabette/shell</code> : elles
            s’adaptent à la couleur du site, se mémorisent (thème et densité) et
            pointent vers le paiement, le compte et les clés d’API du hub.
          </p>

          <ul style={{ color: '#64748b', lineHeight: 1.9, marginTop: '1rem' }}>
            <li><strong>BIG</strong> : 3 crans de densité (Compact → Normal → Grand).</li>
            <li><strong>Jour / Nuit</strong> : bascule de thème, conservée au rechargement.</li>
            <li><strong>Plein Écran</strong> : plein écran total du navigateur.</li>
            <li><strong>Pass 40 €/an</strong> : résumé de l’offre, envoi vers le paiement.</li>
          </ul>
        </div>
      </AppShell>
    </div>
  );
}
