/* lot5.js — petits outils communs aux pages du Lot 5 (alphabette.eu). Aucun traceur, aucune ressource externe.
   - AB5.finance(fichier, corps?, get?) : moteur financier (jeton « Bearer » gardé dans ce navigateur, pas de cookie)
   - AB5.labo(fichier, corps?, get?)    : service Créateurs (session par cookie HttpOnly, en-tête anti-CSRF)
   - AB5.connexion(zone, apres)         : connexion sans mot de passe (code à 6 chiffres par e-mail) */
(function () {
  'use strict';
  var CLE = 'alphabette_createur_jeton';
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else if (k === 'html') n.innerHTML = attrs[k]; else n.setAttribute(k, attrs[k]); });
    (enfants || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function jeton() { try { return localStorage.getItem(CLE) || ''; } catch (e) { return ''; } }
  function poserJeton(j) { try { j ? localStorage.setItem(CLE, j) : localStorage.removeItem(CLE); } catch (e) {} }
  function lire(r) { return r.json().catch(function () { return {}; }).then(function (d) { d._s = r.status; return d; }); }
  function horsLigne() { return { _s: 0, erreur: 'Pas de connexion : réessayez dans un instant.' }; }
  function finance(fichier, corps, get) {
    var h = {}; var j = jeton();
    if (j) h.Authorization = 'Bearer ' + j;
    if (corps) h['Content-Type'] = 'application/json';
    return fetch('/api/' + fichier + (get ? '?' + get : ''), { method: corps ? 'POST' : 'GET', headers: h, body: corps ? JSON.stringify(corps) : undefined }).then(lire).catch(horsLigne);
  }
  function labo(fichier, corps, get) {
    var h = { 'X-Alphabette': '1' };
    if (corps) h['Content-Type'] = 'application/json';
    return fetch('/api/createurs/' + fichier + (get ? '?' + get : ''), { method: corps ? 'POST' : 'GET', headers: h, credentials: 'same-origin', body: corps ? JSON.stringify(corps) : undefined }).then(lire).catch(horsLigne);
  }
  function euros(c) { c = Math.trunc(Number(c) || 0); var s = c < 0 ? '-' : ''; c = Math.abs(c); return s + Math.floor(c / 100) + ',' + String(c % 100).padStart(2, '0') + ' €'; }
  function message(zone, texte, ok) { zone.textContent = texte || ''; zone.className = 'message ' + (ok ? 'ok' : 'err'); zone.setAttribute('role', 'status'); }
  function connexion(zone, apres) {
    if (jeton()) { apres(); return; }
    zone.textContent = '';
    var email = el('input', { type: 'email', autocomplete: 'email', required: '', id: 'ab5-email' });
    var code = el('input', { inputmode: 'numeric', pattern: '[0-9]{6}', maxlength: '6', autocomplete: 'one-time-code', id: 'ab5-code' });
    var m = el('p', { class: 'message' });
    var f1 = el('form', {}, [el('label', { class: 'champ', for: 'ab5-email' }, ['Votre adresse e-mail', email]), el('button', { type: 'submit', text: 'Recevoir mon code' })]);
    var f2 = el('form', { class: 'cache' }, [el('label', { class: 'champ', for: 'ab5-code' }, ['Code reçu par e-mail (6 chiffres)', code]), el('button', { type: 'submit', text: 'Valider' })]);
    zone.appendChild(el('div', { class: 'carte' }, [el('h2', { text: 'Se connecter (sans mot de passe)' }), f1, f2, m]));
    f1.addEventListener('submit', function (e) {
      e.preventDefault();
      finance('billing.php', { action: 'connexion', email: email.value.trim() }).then(function (d) {
        if (d._s === 200) { f2.classList.remove('cache'); code.focus(); message(m, d.message, true); } else message(m, d.erreur);
      });
    });
    f2.addEventListener('submit', function (e) {
      e.preventDefault();
      finance('billing.php', { action: 'code', email: email.value.trim(), code: code.value.trim() }).then(function (d) {
        if (d._s === 200) { poserJeton(d.jeton); zone.textContent = ''; apres(); } else message(m, d.erreur);
      });
    });
  }
  function deconnecter() { poserJeton(''); location.reload(); }
  window.AB5 = { $: $, el: el, finance: finance, labo: labo, euros: euros, message: message, connexion: connexion, jeton: jeton, deconnecter: deconnecter };
})();
