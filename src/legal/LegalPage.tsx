import React from 'react';
import { AppShell, type AlphaAppConfig } from '@alphabette/shell';
import '@alphabette/shell/style.css';
import { MentionsLegales, Confidentialite, Cookies, ConditionsVente } from './contenu';

/**
 * Pages légales de la vitrine alphabette.fr (mentions légales, confidentialité,
 * cookies et stockage local, conditions de vente du Pass).
 *
 * Pas de routeur dans la vitrine : main.tsx regarde l'adresse et appelle
 * `pageLegale(pathname)`. L'hébergement statique (.htaccess) renvoie
 * index.html pour ces adresses.
 */

const HUB_APP: AlphaAppConfig = {
  key: 'alphabette',
  name: 'Alphabette',
  tagline: 'Informations légales',
  accent: '#0f766e',
};

export const PAGES_LEGALES = [
  { chemin: '/mentions-legales', titre: 'Mentions légales', Contenu: MentionsLegales },
  { chemin: '/confidentialite', titre: 'Confidentialité', Contenu: Confidentialite },
  { chemin: '/cookies', titre: 'Cookies et stockage local', Contenu: Cookies },
  { chemin: '/conditions-de-vente', titre: 'Conditions de vente du Pass', Contenu: ConditionsVente },
] as const;

/** Page légale correspondant à l'adresse, ou undefined. */
export function pageLegale(pathname: string) {
  const propre = pathname.replace(/\/+$/, '').replace(/\.html$/, '') || '/';
  return PAGES_LEGALES.find((p) => p.chemin === propre);
}

export const LegalPage: React.FC<{ chemin: string }> = ({ chemin }) => {
  const page = pageLegale(chemin);
  if (!page) return null;
  const { Contenu, titre } = page;

  React.useEffect(() => {
    document.title = `${titre} — Alphabette`;
  }, [titre]);

  return (
    <AppShell app={HUB_APP}>
      <main className="accueil legal">
        <article className="legal__page">
          <p className="legal__retour">
            <a href="/">← Retour à l'accueil</a>
          </p>
          <h1 className="legal__titre">{titre}</h1>
          <Contenu />
          <nav className="legal__nav" aria-label="Autres pages légales">
            {PAGES_LEGALES.filter((p) => p.chemin !== page.chemin).map((p) => (
              <a key={p.chemin} href={p.chemin}>
                {p.titre}
              </a>
            ))}
          </nav>
        </article>
      </main>
    </AppShell>
  );
};
