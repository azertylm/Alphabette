/*! Pass Alphabette — petit module partagé des pages du Laboratoire (alphabette.eu/labo/pass.js).
 * Service : /api/paiement.php. Aucune ressource externe, aucun cookie.
 * Rangé dans ce navigateur (localStorage, même adresse que les applis de alphabette.eu) :
 *   alphabette_pass             { jeton, offre:"ecosysteme"|"app", app, app_nom, debut, fin }   Pass 12 mois (achat ou cadeau)
 *   alphabette_decouverte       { jeton, debut, fin }   Pass Découverte 48 h (gardé après la fin : pas de remise à zéro)
 *   alphabette_credits_iadebat  { porte_monnaie, solde, maj }   crédits IA Débat (1 crédit = 1 débat Premium)
 */
(function () {
  var API = '/api/paiement.php';
  var CLES = { pass: 'alphabette_pass', decouverte: 'alphabette_decouverte', credits: 'alphabette_credits_iadebat' };

  function lire(k) { try { var v = JSON.parse(localStorage.getItem(CLES[k]) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  function ecrire(k, v) { try { localStorage.setItem(CLES[k], JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }

  async function appeler(corps, options) {
    try {
      var r = await fetch(API + (options && options.requete ? '?' + options.requete : ''), corps ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps)
      } : { cache: 'no-store', headers: (options && options.entetes) || {} });
      var d = await r.json().catch(function () { return {}; });
      return { ok: r.ok, statut: r.status, d: d };
    } catch (e) {
      return { ok: false, statut: 0, d: { erreur: 'Pas de connexion : réessayez.' } };
    }
  }

  var etatCache = null;
  async function etat() {
    if (etatCache) return etatCache;
    var r = await appeler(null, { requete: 'etat' });
    etatCache = r.ok ? r.d : { gratuit_jusqu_au: null, ouvert: {}, prix: { pass_app: 15, pass_ecosysteme: 40, credits_iadebat: 5 }, credits_par_pack: 50, decouverte: { ouverte: false, heures: 48 }, applis_pass: {}, horsLigne: true };
    return etatCache;
  }

  /** Le Pass à prendre en compte maintenant : Pass 12 mois actif, sinon Pass Découverte actif, sinon null. */
  function actif() {
    var now = Date.now();
    var p = lire('pass');
    if (p && p.fin > now) return { type: 'pass', fin: p.fin, offre: p.offre, app: p.app, app_nom: p.app_nom };
    var d = lire('decouverte');
    if (d && d.fin > now) return { type: 'decouverte', fin: d.fin };
    return null;
  }
  function decouverteTerminee() { var d = lire('decouverte'); return Boolean(d && d.fin <= Date.now()) && !actif(); }

  /** Ouvre le Pass Découverte (48 h). Un deuxième clic ne remet jamais le compteur à zéro. */
  async function lancerDecouverte() {
    var d = lire('decouverte');
    if (d && d.jeton) return { ok: d.fin > Date.now(), deja: true, d: d, message: d.fin > Date.now() ? 'Votre Pass Découverte est déjà ouvert.' : 'Votre Pass Découverte de 48 h est terminé.' };
    var r = await appeler({ action: 'decouverte' });
    if (!r.ok) return { ok: false, message: r.d.erreur || 'Ouverture impossible pour le moment.' };
    var v = { jeton: r.d.jeton, debut: r.d.debut, fin: r.d.fin };
    ecrire('decouverte', v);
    return { ok: true, d: v };
  }

  /** Code cadeau / code d'activation (ALPHA-…) ou code de porte-monnaie (PM-…). */
  async function activer(code) {
    var r = await appeler({ action: 'activer', code: code });
    if (!r.ok) return { ok: false, message: r.d.erreur || 'Code refusé.' };
    if (r.d.type === 'credits') ecrire('credits', { porte_monnaie: r.d.porte_monnaie, solde: r.d.solde, maj: Date.now() });
    if (r.d.type === 'pass') ecrire('pass', { jeton: r.d.jeton, offre: r.d.offre, app: r.d.app, app_nom: r.d.app_nom, debut: r.d.debut, fin: r.d.fin });
    return { ok: true, d: r.d };
  }

  /** Prépare la commande puis part chez Stripe (paiement unique, sans abonnement). */
  async function commander(produit, options) {
    var corps = Object.assign({ action: 'commander', produit: produit }, options || {});
    var c = lire('credits');
    if (produit === 'credits_iadebat' && c && c.porte_monnaie) corps.porte_monnaie = c.porte_monnaie;
    var r = await appeler(corps);
    if (!r.ok || !r.d.lien) return { ok: false, message: r.d.erreur || 'Le paiement en ligne n’est pas encore ouvert.' };
    location.href = r.d.lien;
    return { ok: true };
  }

  async function confirmer(sessionId, app) {
    var r = await appeler({ action: 'confirmer', session_id: sessionId, app: app || undefined });
    if (r.ok && r.d.type === 'pass') ecrire('pass', { jeton: r.d.jeton, offre: r.d.offre, app: r.d.app, app_nom: r.d.app_nom, debut: r.d.debut, fin: r.d.fin });
    if (r.ok && r.d.type === 'credits') {
      var c = lire('credits');
      ecrire('credits', { porte_monnaie: r.d.porte_monnaie || (c && c.porte_monnaie), solde: r.d.solde, maj: Date.now() });
    }
    return r;
  }

  /** Solde de crédits IA Débat (relu sur le serveur, qui décompte les débats). */
  async function credits() {
    var c = lire('credits');
    if (!c || !c.porte_monnaie) return null;
    var r = await appeler(null, { requete: 'solde', entetes: { 'X-Alphabette-Credits': c.porte_monnaie } });
    if (r.ok && typeof r.d.solde === 'number') { c.solde = r.d.solde; c.maj = Date.now(); ecrire('credits', c); }
    return c;
  }

  /** « 47 h 12 min », « 3 jours » : temps restant lisible. */
  function reste(fin) {
    var ms = Math.max(0, fin - Date.now());
    var h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    if (h >= 72) return Math.floor(h / 24) + ' jours';
    if (h >= 1) return h + ' h ' + String(m).padStart(2, '0') + ' min';
    return Math.max(1, m) + ' min';
  }
  function dateFr(t) { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function nomOffre(p) { return p.offre === 'ecosysteme' ? 'Pass Écosystème' : 'Pass ' + (p.app_nom || 'Application'); }

  /** Petit indicateur discret (« ⏳ Pass Découverte : 31 h 05 min ») ; mis à jour chaque minute. */
  function indicateur(el) {
    function maj() {
      var a = actif();
      if (!a) { el.textContent = ''; el.classList.add('cache'); return; }
      el.classList.remove('cache');
      el.textContent = a.type === 'decouverte'
        ? '⏳ Pass Découverte : ' + reste(a.fin) + ' restantes'
        : '✅ ' + nomOffre(a) + ' actif jusqu’au ' + dateFr(a.fin);
    }
    maj();
    setInterval(maj, 60000);
  }

  window.AlphabettePass = { lire: lire, ecrire: ecrire, etat: etat, actif: actif, decouverteTerminee: decouverteTerminee, lancerDecouverte: lancerDecouverte,
    activer: activer, commander: commander, confirmer: confirmer, credits: credits, reste: reste, dateFr: dateFr, nomOffre: nomOffre, indicateur: indicateur };
})();
