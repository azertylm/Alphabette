import type { ReactNode } from 'react';
import type { EcosystemApp } from './apps';
import type { AlphaAppConfig, ShellStatus } from './config';
import { IconCheck, IconExternal, IconShield, IconSparkles, IconStar } from './icons';
import type { ShellConfig } from './pricing';

/**
 * Les cinq panneaux que la base sait ouvrir par-dessus le contenu.
 * Le type vit dans config.ts (il fait partie de la surface de configuration) ;
 * on le ré-exporte ici pour que les panneaux s'importent d'un seul endroit.
 */
export type { ShellPanelId } from './config';
import type { ShellPanelId } from './config';

export const SHELL_PANELS: Record<ShellPanelId, { titre: string; sousTitre: string; icone: ReactNode }> = {
  compte: { titre: 'Mon compte alphabette', sousTitre: 'Un seul compte pour tout l’écosystème', icone: '👤' },
  cles: { titre: 'Clé d’API — IA souveraine', sousTitre: 'Mistral AI, hébergé en France', icone: '🔑' },
  pass: { titre: 'Le Pass alphabette', sousTitre: 'Débloquer les applications', icone: '⭐' },
  sites: { titre: 'Les applications de l’écosystème', sousTitre: 'Registre central alphabette.fr', icone: '🧭' },
  dons: { titre: 'Soutenir alphabette.fr', sousTitre: 'Sans publicité, sans revente de données', icone: '♥' },
};

/**
 * Titre d'un panneau, adapté au cas d'une application **gratuite** : on ne peut
 * pas annoncer « Débloquer les applications » à quelqu'un qui n'a rien à
 * débloquer. Les liens vers le hub, eux, restent — c'est là que vit le reste de
 * l'écosystème.
 */
export function infosPanneau(
  id: ShellPanelId,
  app: AlphaAppConfig,
): { titre: string; sousTitre: string; icone: ReactNode } {
  const base = SHELL_PANELS[id];
  if (!app.gratuit) return base;
  if (id === 'pass') {
    return { ...base, icone: '🎁', titre: `${app.name} est gratuite`, sousTitre: 'Aucun prix, aucun essai, aucune carte bancaire' };
  }
  if (id === 'compte') {
    return { ...base, sousTitre: `Gratuite pour toujours — un compte reste utile` };
  }
  return base;
}

export interface PanneauProps {
  app: AlphaAppConfig;
  config: ShellConfig;
  hubUrl: string;
  apps: EcosystemApp[];
  /** Faux quand la liste vient de la liste de secours (hub injoignable). */
  registreOk: boolean;
  /** Ouvre un lien externe dans un nouvel onglet. */
  ouvrir: (url: string) => void;
  /** Bascule vers un autre panneau (sans refermer la feuille). */
  basculer: (id: ShellPanelId) => void;
}

const ETAT: Record<ShellStatus, string> = {
  ok: 'Prêt',
  loading: 'En cours de chargement',
  off: 'Non configurée',
};

const euros = (montant: number) => `${montant} €`;

/** Une ligne d'application dans le panneau « sites ». */
function LigneApp({ app, courant }: { app: EcosystemApp; courant: boolean }) {
  const contenu = (
    <>
      <span className="ab-liste__initial" aria-hidden="true">
        {app.icon ?? app.name.replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase()}
      </span>
      <span className="ab-liste__nom">
        {app.name}
        {app.badge ? <span className="ab-etiquette ab-etiquette--pass" style={{ marginLeft: 6 }}>{app.badge}</span> : null}
      </span>
      {courant ? (
        <span className="ab-etiquette ab-etiquette--accent">Tu es ici</span>
      ) : app.gratuit ? (
        <span className="ab-etiquette ab-etiquette--accent">Gratuit</span>
      ) : app.status && app.status !== 'actif' ? (
        <span className="ab-etiquette">{app.status}</span>
      ) : null}
    </>
  );

  // Site courant, ou application sans adresse publique : pas un lien.
  if (courant || !app.url) {
    return (
      <li>
        <div className="ab-liste__item" style={{ cursor: 'default' }}>
          {contenu}
        </div>
      </li>
    );
  }

  // Navigation dans le même onglet, comme la barre écosystème.
  return (
    <li>
      <a className="ab-liste__item" href={app.url}>
        {contenu}
      </a>
    </li>
  );
}

function PanneauCompte({ app, hubUrl, apps, ouvrir, basculer }: PanneauProps) {
  const compte = app.accountUrl ?? `${hubUrl.replace(/\/$/, '')}/compte`;
  const totalApplications = Math.max(apps.length, app.counter?.total ?? 0);
  return (
    <>
      <div className="ab-panneau">
        <h4>État du compte</h4>
        <p>
          <span className={`ab-status ab-status--${app.accountState ?? 'ok'}`} style={{ display: 'inline-block', marginRight: 8 }} />
          {ETAT[app.accountState ?? 'ok']} — synchronisé avec alphabette.fr.
        </p>
        <p className="ab-note">
          Un seul compte, une seule facturation pour toutes les applications. Aucune publicité, aucune revente de
          données, hébergement en France.
        </p>
      </div>

      <div className="ab-panneau">
        <h4>{app.gratuit ? 'Ce que ton compte apporte' : 'Ce que ton compte débloque'}</h4>
        <p>
          {app.gratuit ? (
            <>
              <strong>{app.name}</strong> est <strong>gratuite</strong> : il n’y a rien à débloquer. Le compte sert à
              retrouver tes données sur tous tes appareils et à gérer les autres applications de l’écosystème.
            </>
          ) : app.counter ? (
            <>
              <strong>{app.counter.unlocked}</strong> application(s) débloquée(s) sur{' '}
              <strong>{app.counter.total}</strong>.
              {typeof app.counter.trialDaysLeft === 'number' && app.counter.trialDaysLeft > 0 && (
                <> Il te reste <strong>{app.counter.trialDaysLeft} jour(s) d’essai</strong>.</>
              )}
            </>
          ) : (
            <>Le compte ouvre les applications débloquées.</>
          )}
        </p>
      </div>

      <div className="ab-actions-ligne">
        <button type="button" className="ab-btn ab-btn--accent ab-btn--lg" onClick={() => ouvrir(compte)}>
          Ouvrir mon espace compte <IconExternal width={14} height={14} />
        </button>
        <button type="button" className="ab-btn ab-btn--ghost ab-btn--lg" onClick={() => basculer('sites')}>
          Voir les {totalApplications} application{totalApplications > 1 ? 's' : ''}
        </button>
        <button type="button" className="ab-btn ab-btn--ghost ab-btn--lg" onClick={() => basculer('pass')}>
          {app.gratuit ? '🎁 Application gratuite' : '⭐ Le Pass'}
        </button>
      </div>

      <p className="ab-note">
        Adresse de l’espace compte : <strong>{compte}</strong>. Une application peut remplacer ce panneau avec la prop{' '}
        <code>onOpenAccount</code> de <code>&lt;AppShell&gt;</code>.
      </p>
    </>
  );
}

function PanneauCles({ app, config, hubUrl, ouvrir, basculer }: PanneauProps) {
  const cles = app.apiKeysUrl ?? `${hubUrl.replace(/\/$/, '')}/cles`;
  const etat = app.apiKeyState ?? 'ok';
  return (
    <>
      <div className="ab-panneau">
        <h4>État de la clé</h4>
        <p>
          <span className={`ab-status ab-status--${etat}`} style={{ display: 'inline-block', marginRight: 8 }} />
          {ETAT[etat]}
        </p>
        <p className="ab-note">
          Fournisseur : <strong>Mistral AI</strong> (Paris, France). Aucune donnée utilisateur n’est utilisée pour
          l’entraînement.
        </p>
      </div>

      <div className="ab-panneau">
        <h4>Deux façons de brancher l’IA</h4>
        <p>
          <IconCheck width={13} height={13} /> <strong>BYOK</strong> : tu apportes ta propre clé Mistral, tu gardes la
          main sur tes quotas et ta facturation.
        </p>
        <p>
          <IconSparkles width={13} height={13} /> <strong>Clé managée Alphabette</strong> :{' '}
          {app.gratuit
            ? 'hébergée par l’écosystème, rien à configurer.'
            : `incluse pendant les ${config.trialDays} jours d’essai et avec le Pass. Rien à configurer.`}
        </p>
      </div>

      <div className="ab-panneau">
        <h4>Ce que fait la base</h4>
        <p className="ab-note">
          Les appels passent par le routeur souverain du hub (<code>{hubUrl.replace(/\/$/, '')}/api/ai/ask</code>), qui
          choisit le fournisseur disponible et journalise le minimum. Aucune clé n’est stockée dans le navigateur.
        </p>
      </div>

      <div className="ab-actions-ligne">
        <button type="button" className="ab-btn ab-btn--accent ab-btn--lg" onClick={() => ouvrir(cles)}>
          Gérer mes clés <IconExternal width={14} height={14} />
        </button>
        <button type="button" className="ab-btn ab-btn--ghost ab-btn--lg" onClick={() => basculer('pass')}>
          {app.gratuit ? '🧭 L’écosystème' : '⭐ Incluse dans le Pass'}
        </button>
      </div>

      <p className="ab-note">
        Adresse de gestion : <strong>{cles}</strong>. Remplaçable par la prop <code>onOpenApiKeys</code> ou en
        surchargeant le panneau.
      </p>
    </>
  );
}

/**
 * Panneau « Pass » d’une application **gratuite** : aucun prix, aucune
 * promotion, aucun bouton de paiement pour elle. On explique la gratuité, et on
 * garde les liens vers le hub — c’est l’écosystème qui finance l’application.
 */
function PanneauGratuit({ app, config, apps, hubUrl, ouvrir, basculer }: PanneauProps) {
  const base = hubUrl.replace(/\/$/, '');
  const total = apps.length || app.counter?.total || 16;
  const gratuites = apps.filter((entree) => entree.gratuit).length;
  return (
    <>
      <div className="ab-panneau">
        <h4>🎁 Gratuite, pour toujours</h4>
        <p>
          <strong>{app.name}</strong> est une application gratuite de l’écosystème alphabette : aucun prix, aucun essai
          qui se transforme en abonnement, aucune carte bancaire, aucune publicité.
        </p>
        <p className="ab-note">
          Elle vit sur les dons et sur ce que financent les autres applications. Rien ne t’est demandé pour l’utiliser,
          ni aujourd’hui ni plus tard.
        </p>
      </div>

      <div className="ab-actions-ligne">
        <button type="button" className="ab-btn ab-btn--accent ab-btn--lg" onClick={() => ouvrir(base)}>
          🧭 alphabette.fr <IconExternal width={14} height={14} />
        </button>
        <button type="button" className="ab-btn ab-btn--ghost ab-btn--lg" onClick={() => basculer('sites')}>
          Voir les {total} application{total > 1 ? 's' : ''}
        </button>
        <button type="button" className="ab-btn ab-btn--don ab-btn--lg" onClick={() => basculer('dons')}>
          ♥ Faire un don
        </button>
      </div>

      <div className="ab-panneau">
        <h4>Et les autres applications ?</h4>
        <p>
          {gratuites > 0 && (
            <>
              <strong>{gratuites}</strong> application{gratuites > 1 ? 's' : ''} de l’écosystème{' '}
              {gratuites > 1 ? 'sont gratuites' : 'est gratuite'} — tu peux les ouvrir sans rien payer. Les autres se
              débloquent avec le Pass :{' '}
            </>
          )}
          {gratuites === 0 && <>Les autres applications se débloquent avec le Pass : </>}
          <strong>{euros(config.perAppPerYear)} / an</strong> pour une application,{' '}
          <strong>{euros(config.ecosystemPerYear)} / an</strong> pour tout l’écosystème. C’est ce qui finance, entre
          autres, les applications gratuites comme celle-ci.
        </p>
        <p className="ab-note">
          Les prix viennent du hub (<code>/api/config.json</code>) et les applications gratuites du registre
          (<code>/api/apps</code>) : les deux se mettent à jour tout seuls.
        </p>
      </div>
    </>
  );
}

function PanneauPass(props: PanneauProps) {
  if (props.app.gratuit) return <PanneauGratuit {...props} />;
  const { app, config, ouvrir, basculer } = props;
  const promo = config.promotion;
  return (
    <>
      {promo && (
        <div className="ab-promo">
          <IconStar width={16} height={16} />
          <span>
            {promo.badgeLabel ?? 'Offre en cours'}
            {promo.discountPercent ? ` — ${promo.discountPercent} %` : ''}
            {promo.couponCode ? ` avec le code ${promo.couponCode}` : ''}
          </span>
        </div>
      )}

      <div className="ab-offres">
        <div className="ab-offre">
          <span className="ab-etiquette">Une application</span>
          <span className="ab-offre__prix">
            {euros(config.perAppPerYear)} <small>/ an</small>
          </span>
          <ul>
            <li>L’application de ton choix, débloquée à vie de l’abonnement</li>
            <li>Clé IA Mistral managée incluse</li>
            <li>{config.trialDays} jours d’essai avant de payer</li>
          </ul>
          <button type="button" className="ab-btn ab-btn--ghost ab-btn--lg" onClick={() => ouvrir(config.paymentLinks.perApp)}>
            Débloquer une application
          </button>
        </div>

        <div className="ab-offre ab-offre--vedette">
          <span className="ab-etiquette ab-etiquette--pass">Le plus choisi</span>
          <span className="ab-offre__prix">
            {euros(config.ecosystemPerYear)} <small>/ an</small>
          </span>
          <ul>
            <li><strong>Tout l’écosystème</strong>, applications présentes et futures</li>
            <li>Clé IA Mistral managée incluse</li>
            <li>{config.trialDays} jours d’essai, sans carte bancaire</li>
          </ul>
          <button
            type="button"
            className="ab-btn ab-btn--pass ab-btn--lg"
            onClick={() => ouvrir(config.paymentLinks.ecosystem)}
          >
            <IconStar width={14} height={14} /> Prendre le Pass {euros(config.ecosystemPerYear)}/an
          </button>
        </div>
      </div>

      <div className="ab-panneau">
        <h4>Ce qui est inclus</h4>
        <p className="ab-note">
          {app.counter?.total ?? 16} applications, l’IA souveraine Mistral AI, l’hébergement en France, les sauvegardes
          et les évolutions. Pas de publicité, pas de revente de données, résiliable en un clic.
        </p>
      </div>

      <div className="ab-actions-ligne">
        <button type="button" className="ab-btn ab-btn--ghost ab-btn--lg" onClick={() => basculer('compte')}>
          👤 Mon compte
        </button>
        <button type="button" className="ab-btn ab-btn--ghost ab-btn--lg" onClick={() => basculer('sites')}>
          🧭 Voir les applications
        </button>
      </div>

      <p className="ab-note">
        Paiement sécurisé par Stripe. Les prix et les liens affichés viennent du hub (
        <code>{'/api/config.json'}</code>) : ils se mettent à jour tout seuls.
      </p>
    </>
  );
}

function PanneauSites({ app, apps, registreOk, hubUrl, ouvrir, basculer }: PanneauProps) {
  const total = app.counter?.total ?? apps.length;
  const gratuites = apps.filter((entree) => entree.gratuit).length;
  // Les applications gratuites d'abord : ce sont celles que l'on peut ouvrir
  // tout de suite. Le tri est stable, l'ordre du registre est conservé ensuite.
  const liste = [...apps].sort((a, b) => Number(Boolean(b.gratuit)) - Number(Boolean(a.gratuit)));
  return (
    <>
      <div className="ab-panneau">
        <h4>{app.gratuit ? 'Ton accès' : 'Compteur'}</h4>
        <p>
          {app.gratuit ? (
            <>
              <strong>{app.name}</strong> est <strong>gratuite</strong> : rien à débloquer ici. Voici les {total}{' '}
              application{total > 1 ? 's' : ''} de l’écosystème
              {gratuites > 0 && (
                <>
                  , dont <strong>{gratuites} gratuite{gratuites > 1 ? 's' : ''}</strong> (signalée
                  {gratuites > 1 ? 's' : ''} « Gratuit » ci-dessous)
                </>
              )}{' '}
              — c’est là que le Pass, lui, sert.
            </>
          ) : app.counter ? (
            <>
              <strong>{app.counter.unlocked}</strong> / <strong>{app.counter.total}</strong> applications débloquées
              {typeof app.counter.trialDaysLeft === 'number' && app.counter.trialDaysLeft > 0 && (
                <> · essai : {app.counter.trialDaysLeft} jour(s) restant(s)</>
              )}
              {gratuites > 0 && <> · {gratuites} gratuite{gratuites > 1 ? 's' : ''}</>}
              .
            </>
          ) : (
            <>Le registre central publie la liste des applications.</>
          )}
        </p>
      </div>

      <ul className="ab-liste">
        {liste.map((entree) => (
          <LigneApp key={entree.key} app={entree} courant={entree.key === app.key} />
        ))}
      </ul>

      {!registreOk && (
        <p className="ab-note">
          Liste de secours : le registre du hub n’a pas répondu ({apps.length} sur {total} applications). Réessaie
          quand alphabette.fr est joignable.
        </p>
      )}

      <div className="ab-actions-ligne">
        {app.gratuit ? (
          <button
            type="button"
            className="ab-btn ab-btn--accent ab-btn--lg"
            onClick={() => ouvrir(hubUrl.replace(/\/$/, ''))}
          >
            🧭 Ouvrir alphabette.fr <IconExternal width={14} height={14} />
          </button>
        ) : (
          <button type="button" className="ab-btn ab-btn--ghost ab-btn--lg" onClick={() => basculer('pass')}>
            ⭐ Débloquer avec le Pass
          </button>
        )}
      </div>
    </>
  );
}

function PanneauDons({ app, hubUrl, ouvrir }: PanneauProps) {
  const don = app.donUrl ?? `${hubUrl.replace(/\/$/, '')}/don`;
  return (
    <>
      <div className="ab-panneau">
        <h4>À quoi sert un don</h4>
        <p>
          L’écosystème vit sans publicité et sans revente de données. Les dons financent les serveurs en France, les
          modèles IA et le temps de développement.
        </p>
        <p className="ab-note">
          <IconShield width={13} height={13} /> Un don n’est pas un abonnement : il ne débloque pas les applications.
          Pour cela, c’est le Pass.
        </p>
      </div>

      <div className="ab-actions-ligne">
        <button type="button" className="ab-btn ab-btn--don ab-btn--lg" onClick={() => ouvrir(don)}>
          ♥ Faire un don <IconExternal width={14} height={14} />
        </button>
        <button type="button" className="ab-btn ab-btn--ghost ab-btn--lg" onClick={() => ouvrir(`${hubUrl.replace(/\/$/, '')}/ecosysteme`)}>
          Découvrir l’écosystème <IconExternal width={14} height={14} />
        </button>
      </div>

      <p className="ab-note">
        Page de dons : <strong>{don}</strong>. Modifiable dans <code>src/alphabette.app.ts</code> (champ{' '}
        <code>donUrl</code>).
      </p>
    </>
  );
}

/** Rend le panneau demandé. */
export function PanneauShell({ id, ...props }: PanneauProps & { id: ShellPanelId }) {
  switch (id) {
    case 'compte':
      return <PanneauCompte {...props} />;
    case 'cles':
      return <PanneauCles {...props} />;
    case 'pass':
      return <PanneauPass {...props} />;
    case 'sites':
      return <PanneauSites {...props} />;
    case 'dons':
      return <PanneauDons {...props} />;
    default:
      return null;
  }
}
