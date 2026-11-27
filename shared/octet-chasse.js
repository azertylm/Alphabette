/* =============================================================================
   octet-chasse.js — Chasse au trésor d'Octet entre les applications Alphabette.
   -----------------------------------------------------------------------------
   Chargé tout seul par la double barre (alphabette-barre.js) et par Octet (octet-widget.js) :
   AUCUNE application n'a besoin d'être modifiée pour accueillir un fragment d'indice.

   La chasse en cours est décrite dans UN fichier : /shared/chasse.json (saison, dates, indices, récompense).
   Un indice apparaît sur la page dont l'adresse correspond à son champ « adresse » : un petit bouton
   parchemin (48 px) en bas à gauche, « Un fragment d'indice brille ici ». On le touche : le fragment
   est rangé dans le carnet « Mes petits secrets » d'Octet.

   Stockage local uniquement (jamais de cookie, rien n'est envoyé) :
   les applications vivent sur des sous-domaines (<appli>.alphabette.fr) qui ne partagent pas leur
   localStorage ; on passe donc par une petite page « coffre » d'alphabette.fr (/shared/octet-pont.html)
   ouverte en cadre invisible : même site, même stockage, pour toutes les applis. Ailleurs
   (alphabette.eu, essais en local), le stockage de la page est utilisé directement.

   API exposée : window.OctetCoffre.lire(cle) / .ecrire(cle, valeur)  (promesses)
                 window.OctetChasse.etat() → { chasse, trouves: [ids] }  ·  .rafraichir()
   ============================================================================= */
(function () {
  "use strict";
  if (window.OctetChasse) return;

  var SCRIPT = document.currentScript;
  var CLE_CHASSE = "alphabette_octet_chasse";
  var hote = location.hostname;
  // Origine du hub : celle du script lui-même (https://alphabette.fr en production).
  var HUB = (function () { try { return new URL(SCRIPT && SCRIPT.src || "/", location.href).origin; } catch (e) { return location.origin; } })();
  var surFr = /(^|\.)alphabette\.fr$/i.test(hote);
  var memeOrigine = HUB === location.origin;
  var parPont = surFr && !memeOrigine; // sous-domaine d'appli → coffre commun d'alphabette.fr

  /* ---------------------------------------------------------------- coffre */
  function lireLocal(cle) { try { return JSON.parse(localStorage.getItem(cle) || "null"); } catch (e) { return null; } }
  function ecrireLocal(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* navigation privée */ } }

  var pont = null, attente = {}, compteur = 0, pret = null;
  function ouvrirPont() {
    if (pret) return pret;
    pret = new Promise(function (resoudre) {
      var f = document.createElement("iframe");
      f.src = HUB + "/shared/octet-pont.html";
      f.title = "Coffre d'Octet";
      f.setAttribute("aria-hidden", "true");
      f.tabIndex = -1;
      f.style.cssText = "position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-9999px;top:0";
      var fini = false;
      var finir = function (ok) { if (fini) return; fini = true; if (!ok) parPont = false; resoudre(); };
      f.onload = function () { pont = f.contentWindow; finir(true); };
      setTimeout(function () { finir(!!pont); }, 4000); // coffre injoignable : stockage local de la page
      window.addEventListener("message", function (e) {
        if (e.origin !== HUB || !e.data || e.data.octet !== 1) return;
        var r = attente[e.data.id];
        if (r) { delete attente[e.data.id]; r(e.data.valeur === undefined ? null : e.data.valeur); }
      });
      (document.body || document.documentElement).appendChild(f);
    });
    return pret;
  }
  function demander(op, cle, valeur) {
    if (!parPont) {
      if (op === "ecrire") { ecrireLocal(cle, valeur); return Promise.resolve(valeur); }
      if (op === "lire") return Promise.resolve(lireLocal(cle));
      return fetch(HUB + "/shared/chasse.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    return ouvrirPont().then(function () {
      if (!parPont || !pont) return demander(op, cle, valeur);
      return new Promise(function (resoudre) {
        var id = ++compteur;
        attente[id] = resoudre;
        pont.postMessage({ octet: 1, id: id, op: op, cle: cle, valeur: valeur }, HUB);
        setTimeout(function () { if (attente[id]) { delete attente[id]; resoudre(op === "ecrire" ? valeur : null); } }, 4000);
      });
    });
  }
  window.OctetCoffre = {
    lire: function (cle) { return demander("lire", cle); },
    ecrire: function (cle, v) { return demander("ecrire", cle, v); }
  };

  /* ---------------------------------------------------------------- chasse */
  var jour = function () { return new Date().toISOString().slice(0, 10); };
  var chassePromesse = null;
  function chasse() {
    if (!chassePromesse) chassePromesse = demander("chasse").then(function (c) {
      if (!c || !Array.isArray(c.indices)) return null;
      if ((c.debut && jour() < c.debut) || (c.fin && jour() > c.fin)) return null; // hors saison
      return c;
    });
    return chassePromesse;
  }
  function etat() {
    return Promise.all([chasse(), demander("lire", CLE_CHASSE)]).then(function (r) {
      var c = r[0], s = r[1] || {};
      var trouves = c && s.saison === c.saison && Array.isArray(s.trouves) ? s.trouves : [];
      return { chasse: c, trouves: trouves };
    });
  }
  function marquer(id) {
    return etat().then(function (e) {
      if (!e.chasse || e.trouves.indexOf(id) >= 0) return e;
      var trouves = e.trouves.concat(id);
      return demander("ecrire", CLE_CHASSE, { saison: e.chasse.saison, trouves: trouves }).then(function () {
        try { window.dispatchEvent(new CustomEvent("octet:chasse", { detail: { id: id, trouves: trouves } })); } catch (x) {}
        return { chasse: e.chasse, trouves: trouves };
      });
    });
  }

  /* ---------------------------------------------------------------- l'indice de cette page */
  function normaliser(a) { return String(a || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").toLowerCase(); }
  function ici() { return normaliser(location.host + location.pathname); }
  function echapper(t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function montrer(indice, deja, total, nbTrouves) {
    if (document.getElementById("octet-indice")) return;
    var st = document.createElement("style");
    st.textContent =
      "#octet-indice{position:fixed;left:12px;bottom:14px;z-index:30;font:600 16px/1.35 Georgia,'Times New Roman',serif;color:#2c1a0e}" +
      "#octet-indice button{min-width:48px;min-height:48px;border-radius:14px;border:2px solid #6b4a2b;background:#f6ecd6;color:#2c1a0e;" +
      "font:inherit;padding:6px 12px;cursor:pointer;box-shadow:0 3px 10px rgba(44,26,14,.25);display:inline-flex;align-items:center;gap:8px}" +
      "#octet-indice button:focus-visible{outline:3px solid #1d4ed8;outline-offset:3px}" +
      "#octet-indice .carte{max-width:min(320px,calc(100vw - 24px));background:#f6ecd6;border:2px solid #6b4a2b;border-radius:14px;padding:12px 14px;" +
      "box-shadow:0 6px 18px rgba(44,26,14,.3);font-size:17px}" +
      "#octet-indice .frag{display:block;margin:6px 0;font-size:20px;font-style:italic}" +
      "#octet-indice .carte button{margin-top:8px}" +
      "@media print{#octet-indice{display:none}}";
    document.head.appendChild(st);
    var boite = document.createElement("div");
    boite.id = "octet-indice";
    boite.setAttribute("data-octet-ignore", "");
    var bouton = function () {
      boite.innerHTML = '<button type="button" aria-label="' + (deja ? "Fragment d'indice déjà trouvé : le relire" : "Un fragment d'indice brille ici : le ramasser") + '">' +
        '<span aria-hidden="true">📜</span><span>' + (deja ? "Fragment trouvé" : "Un indice brille ici…") + "</span></button>";
      boite.querySelector("button").addEventListener("click", ouvrir);
    };
    var ouvrir = function () {
      marquer(indice.id).then(function (e) {
        deja = true;
        var n = e.trouves.length, tout = e.chasse && n >= e.chasse.indices.length;
        boite.innerHTML = '<div class="carte" role="dialog" aria-label="Fragment d\'indice de la chasse au trésor">' +
          "<strong>Fragment " + n + " sur " + total + "</strong>" +
          '<span class="frag">« ' + echapper(indice.fragment) + " »</span>" +
          (tout ? "Bravo, vous avez tout trouvé ! Ouvrez le carnet d'Octet sur alphabette.fr pour la suite." : "Il est rangé dans le carnet d'Octet, « Mes petits secrets ».") +
          '<br><button type="button">Fermer</button></div>';
        var b = boite.querySelector(".carte button");
        b.addEventListener("click", bouton);
        b.focus();
      });
    };
    bouton();
    document.body.appendChild(boite);
  }

  function chercherIci() {
    chasse().then(function (c) {
      if (!c) return;
      var page = ici();
      var indice = null;
      c.indices.forEach(function (i) {
        var a = normaliser(i.adresse);
        var vise = a.replace(/\/$/, "");
        var ok = a && (page === vise || page === vise + "/" || (!i.exacte && page.indexOf(vise + "/") === 0));
        if (ok && (!indice || a.length > normaliser(indice.adresse).length)) indice = i;
      });
      if (!indice) return;
      etat().then(function (e) { montrer(indice, e.trouves.indexOf(indice.id) >= 0, c.indices.length, e.trouves.length); });
    });
  }

  window.OctetChasse = { etat: etat, marquer: marquer, rafraichir: function () { chassePromesse = null; return etat(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", chercherIci); else chercherIci();
})();
