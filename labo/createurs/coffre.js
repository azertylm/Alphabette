/* Coffre du bac à sable Alphabette — inséré en tête de chaque page d'une application hébergée pour un
 * créateur du collectif (scripts/labo/bac-a-sable.mjs). L'application tourne dans un cadre isolé (origine
 * « opaque ») : elle ne peut lire ni les cookies ni le stockage d'alphabette.eu. Ce petit script lui rend un
 * localStorage / sessionStorage qui marche, gardé par la page d'accueil du cadre (et seulement pour elle).
 * Garde-fou : si l'isolement manque (en-tête de sécurité absent), la page s'arrête et renvoie vers le cadre. */
(function () {
  'use strict';
  var isole;
  try { isole = self.origin === 'null'; } catch (e) { isole = true; }
  if (!isole) {
    try { window.stop(); } catch (e) { /* rien */ }
    try { document.documentElement.innerHTML = ''; } catch (e) { /* rien */ }
    location.replace(new URL('../', location.href).href);
    throw new Error('Bac à sable Alphabette : ouverture hors du cadre isolé.');
  }
  var MARQUE = '__ab_coffre__';
  var MAX = 2000000;
  var donnees = {};
  try { if (String(window.name).indexOf(MARQUE) === 0) donnees = JSON.parse(String(window.name).slice(MARQUE.length)) || {}; } catch (e) { donnees = {}; }

  function annoncer() {
    var texte;
    try { texte = JSON.stringify(donnees); } catch (e) { return; }
    if (texte.length > MAX) return;
    try { window.name = MARQUE + texte; } catch (e) { /* rien */ }
    try { parent.postMessage({ type: 'ab-coffre', donnees: donnees }, '*'); } catch (e) { /* rien */ }
  }

  function stockage(table, garde) {
    var api = {
      getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(table, k) ? table[k] : null; },
      setItem: function (k, v) { table[String(k)] = String(v); if (garde) annoncer(); },
      removeItem: function (k) { delete table[String(k)]; if (garde) annoncer(); },
      clear: function () { for (var k in table) delete table[k]; if (garde) annoncer(); },
      key: function (i) { var c = Object.keys(table); return i >= 0 && i < c.length ? c[i] : null; },
    };
    return new Proxy(api, {
      get: function (c, p) { if (p === 'length') return Object.keys(table).length; if (p in api) return api[p]; return typeof p === 'string' && Object.prototype.hasOwnProperty.call(table, p) ? table[p] : undefined; },
      set: function (c, p, v) { if (p in api) return true; api.setItem(p, v); return true; },
      deleteProperty: function (c, p) { api.removeItem(p); return true; },
      has: function (c, p) { return p in api || Object.prototype.hasOwnProperty.call(table, p); },
      ownKeys: function () { return Object.keys(table); },
      getOwnPropertyDescriptor: function (c, p) { return Object.prototype.hasOwnProperty.call(table, p) ? { value: table[p], enumerable: true, configurable: true, writable: true } : undefined; },
    });
  }

  var definir = function (nom, valeur) { try { Object.defineProperty(window, nom, { value: valeur, configurable: true, enumerable: true }); } catch (e) { /* rien */ } };
  definir('localStorage', stockage(donnees, true));
  definir('sessionStorage', stockage({}, false));
  try { Object.defineProperty(document, 'cookie', { get: function () { return ''; }, set: function () {}, configurable: true }); } catch (e) { /* rien */ }
})();
