/* lot6.js — petits outils communs aux pages du Lot 6 (/transfert, /aidant, /idees, /kits, /presse).
   Aucun traceur, aucune ressource externe. AB6P.* ; les briques du shell sont dans window.AB6 (alphabette-lot6.js). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); });
    (enfants || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function lire(r) { return r.json().catch(function () { return {}; }).then(function (d) { d._s = r.status; return d; }); }
  function appeler(url, corps) {
    return fetch(url, { method: corps ? 'POST' : 'GET', headers: corps ? { 'Content-Type': 'application/json' } : {}, body: corps ? JSON.stringify(corps) : undefined,
      credentials: 'same-origin', cache: 'no-store' }).then(lire).catch(function () { return { _s: 0, erreur: 'Pas de connexion : réessayez dans un instant.' }; });
  }
  /** Session anonyme de cet appareil (32 caractères hexadécimaux) : 1 vote par idée, jamais un identifiant personnel. */
  function session() {
    try {
      var j = localStorage.getItem('alphabette.session6');
      if (j && /^[a-f0-9]{32}$/.test(j)) return j;
      var o = new Uint8Array(16); crypto.getRandomValues(o);
      j = Array.prototype.map.call(o, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      localStorage.setItem('alphabette.session6', j); return j;
    } catch (e) { return ''; }
  }
  function message(zone, texte, ok) { zone.textContent = texte || ''; zone.className = 'message ' + (ok ? 'ok' : 'err'); zone.setAttribute('role', 'status'); }
  /** Applications visibles (registre figé au build). */
  function applis() {
    return appeler('/api/apps').then(function (d) { return (d.apps || []).filter(function (a) { return a && a.slug && a.name && a.status !== 'brouillon'; }); });
  }
  function qr(texte) { return typeof window.qrSvg === 'function' ? window.qrSvg(texte) : ''; }
  function b64(obj) { var u = new TextEncoder().encode(JSON.stringify(obj)); return window.AB6.passeport.versBase64Url(u); }
  function deb64(s) { return JSON.parse(new TextDecoder().decode(window.AB6.passeport.depuisBase64Url(s))); }
  function nomLisible(n) { return /^[A-ZÀ-Ý0-9 '’.!?\-]+$/.test(n) ? n.charAt(0) + n.slice(1).toLowerCase() : n; }
  window.AB6P = { $: $, el: el, appeler: appeler, session: session, message: message, applis: applis, qr: qr, b64: b64, deb64: deb64, nomLisible: nomLisible };
})();
