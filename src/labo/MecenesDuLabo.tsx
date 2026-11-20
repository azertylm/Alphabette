import React, { useEffect, useState } from 'react';

/**
 * @file MecenesDuLabo.tsx
 * Bloc « Mécènes du Labo » du Tableau d'Honneur (alphabette.eu) : la liste des soutiens qui ont choisi d'afficher
 * un pseudo, et le bouton « Soutenir le laboratoire (hébergement OVH & crédits IA) » : 5 €, 10 € ou montant libre
 * par Stripe, paiement unique, sans abonnement.
 * Sources : api/labo/tableau-honneur.json (« mecenes », ajoutés à la main avec accord, par exemple un virement)
 * + api/paiement.php?honneur (soutiens par carte, case cochée). Jamais de montant affiché ; vide → phrase honnête.
 */

interface Mecene { pseudo: string; depuis?: string }
type Produit = 'mecene_5' | 'mecene_10' | 'mecene_libre';

const PSEUDO = /^[\p{L}\p{N} ._'’-]{2,30}$/u;

async function lireJson(url: string): Promise<any> {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    return r.ok ? await r.json() : {};
  } catch {
    return {};
  }
}

export const MecenesDuLabo: React.FC = () => {
  const [mecenes, setMecenes] = useState<Mecene[] | null>(null);
  const [ouvert, setOuvert] = useState<Record<string, boolean>>({});
  const [afficher, setAfficher] = useState(false);
  const [pseudo, setPseudo] = useState(() => {
    try { return localStorage.getItem('labo_pseudo') || ''; } catch { return ''; }
  });
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    Promise.all([lireJson('/api/paiement.php?honneur'), lireJson('/api/labo/tableau-honneur.json'), lireJson('/api/paiement.php?etat')])
      .then(([vivants, fixes, etat]) => {
        const liste = [...(vivants.mecenes ?? []), ...(fixes.mecenes ?? [])].filter((m: Mecene) => typeof m?.pseudo === 'string' && PSEUDO.test(m.pseudo));
        setMecenes(liste);
        setOuvert(etat?.ouvert ?? {});
      });
  }, []);

  const soutenir = async (produit: Produit) => {
    if (afficher && !PSEUDO.test(pseudo.trim())) { setMessage('Pseudo à afficher : 2 à 30 lettres ou chiffres, sans lien.'); return; }
    setEnvoi(true);
    setMessage('Ouverture du paiement sécurisé…');
    try {
      const r = await fetch('/api/paiement.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'commander', produit, afficher, pseudo: afficher ? pseudo.trim() : '' }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.lien) { window.location.href = d.lien; return; }
      setMessage(d.erreur || 'Le soutien par carte n\'est pas encore ouvert.');
    } catch {
      setMessage('Pas de connexion : réessayez.');
    }
    setEnvoi(false);
  };

  const carteOuverte = Boolean(ouvert.mecene_5 || ouvert.mecene_10 || ouvert.mecene_libre);
  const mois = (m?: string) => (m && /^\d{4}-\d{2}$/.test(m) ? new Date(`${m}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '');

  return (
    <div className="mecenes" id="soutenir">
      <h3 className="mecenes__titre">💚 Mécènes du Labo</h3>
      {mecenes === null ? (
        <p className="accueil__message">Chargement…</p>
      ) : mecenes.length === 0 ? (
        <p className="communaute__vide">Personne encore : le premier nom ici peut être le vôtre.</p>
      ) : (
        <ul className="mecenes__liste">
          {mecenes.map((m, i) => (
            <li key={`${m.pseudo}-${i}`}><strong>{m.pseudo}</strong>{mois(m.depuis) && <span> · depuis {mois(m.depuis)}</span>}</li>
          ))}
        </ul>
      )}

      <div className="mecenes__soutien">
        <p className="mecenes__phrase">
          <strong>Soutenir le laboratoire (hébergement OVH &amp; crédits IA).</strong> Le Laboratoire est gratuit, sans publicité
          ni revente de données. Ce qu'il coûte vraiment : l'hébergement chez OVH et les crédits d'intelligence artificielle
          des débats gratuits. Un soutien ponctuel, quand vous voulez : pas d'abonnement, rien d'autre ne sera prélevé.
        </p>
        {carteOuverte ? (
          <>
            <div className="mecenes__montants">
              {ouvert.mecene_5 && <button type="button" className="labo__bouton labo__bouton--envoyer" disabled={envoi} onClick={() => soutenir('mecene_5')}>5 €</button>}
              {ouvert.mecene_10 && <button type="button" className="labo__bouton labo__bouton--envoyer" disabled={envoi} onClick={() => soutenir('mecene_10')}>10 €</button>}
              {ouvert.mecene_libre && <button type="button" className="labo__bouton" disabled={envoi} onClick={() => soutenir('mecene_libre')}>Montant libre</button>}
            </div>
            <label className="mecenes__case">
              <input type="checkbox" checked={afficher} onChange={(e) => setAfficher(e.target.checked)} />
              <span>Afficher mon pseudo comme Mécène dans le Tableau d'Honneur (facultatif)</span>
            </label>
            {afficher && (
              <label className="mecenes__pseudo">
                Pseudo à afficher <small>(jamais le montant)</small>
                <input value={pseudo} maxLength={30} autoComplete="nickname" onChange={(e) => setPseudo(e.target.value)} />
              </label>
            )}
            <p className="mecenes__note">Paiement sécurisé par Stripe. Un soutien est un don, pas un achat.</p>
          </>
        ) : (
          <p className="mecenes__note">Le soutien par carte ouvre bientôt. En attendant, le bouton ♥ DON en haut des applications explique le virement.</p>
        )}
        {message && <p className="mecenes__note" role="status">{message}</p>}
      </div>
    </div>
  );
};
