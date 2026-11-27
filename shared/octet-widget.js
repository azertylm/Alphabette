/* ============================================================================
   OctetEngine v3 — Octet, la souris mécanicienne d'Alphabette
   Une seule balise suffit :
     <script src="/shared/octet-widget.js" data-app="hub" data-site="auto" data-assets="/assets/octet/dist" defer></script>
   Personnalisation par application (facultatif, avant la balise) :
     window.OCTET_APP_CONTEXT = { appName, defaultMood, tips: [...], actions: [...], feedbackEndpoint, repoIssuesUrl };
   - Aucune dépendance, aucun traceur, aucun cookie : préférences et progression dans localStorage seulement.
   - Mode Vitrine (alphabette.fr) : « concierge curieuse » sur les cartes [data-octet-card].
   - Mode Laboratoire (alphabette.eu) : « éclaireuse » pour signaler un souci ou proposer une amélioration.
   - Sieste après 35 s d'inactivité, curiosité sur le texte surligné, sons de synthèse (coupés par défaut),
     confort de lecture (taille, contraste AAA, voix Alphabette), mini-jeu « Les engrenages perdus ».
   - Humeurs d'une section : data-octet-mood="compass | wrench | flask | notebook | watering | loupe | hourglass |
     lock | shield | files | scales" (boussole, clé, fiole, carnet, arrosoir, loupe, sablier, cadenas, bouclier, dossiers, balance).
   - Immobile en Mode Calme du site et si l'appareil demande moins d'animations. Aucune fenêtre au démarrage.
   ============================================================================ */
(function () {
  "use strict";
  if (typeof window === "undefined" || window.self !== window.top) return;

  const SCRIPT = document.currentScript;
  const ATTR = (n, d) => (SCRIPT && SCRIPT.getAttribute(n)) || d;

  const CLE_PREFS = "alphabette_octet_pref";
  const CLE_CONFORT = "alphabette_reading_comfort";
  const CLE_ENGRENAGES = "alphabette_octet_gears";
  const CLE_CARTES = "alphabette_octet_cartes_vues";
  const CLE_SECRETS = "alphabette_octet_secrets";
  const CLE_BONJOUR = "alphabette_octet_bonjour";
  const TOTAL_ENGRENAGES = 5;
  // id → [nom une fois découvert, indice tant qu'il ne l'est pas]
  const DECOUVERTES = {
    bonjour: ["Le bonjour du jour", "Revenez un autre jour…"],
    chatouilles: ["Les chatouilles", "Passez vite la souris au-dessus d'elle, plusieurs fois"],
    tournis: ["Le tournis", "Et si on cliquait… beaucoup ?"],
    attraper: ["Attraper Octet", "Elle se laisse peut-être porter"],
    lancer: ["Le grand vol", "Lancez-la… fort"],
    pissenlit: ["Le pissenlit", "Remontez la page très vite"],
    reveil: ["Le réveil en sursaut", "Réveillez-la pendant sa sieste"],
    clicdroit: ["Le menu secret", "Un clic… de l'autre côté"],
    konami: ["Le code de l'atelier", "↑ ↑ ↓ ↓ …"],
    copie: ["Le pouce levé", "Copiez un passage"],
    idee: ["L'ampoule", "Cliquez dans un champ de texte"],
    bout: ["Le drapeau", "Allez tout en bas d'une longue page"],
    remonter: ["La corde", "Remontez d'un coup tout en haut"],
    murs: ["Pousser les murs", "Changez la taille de la fenêtre"],
    cachecache: ["Cache-cache", "Masquez-la, puis faites-la revenir"],
    retour: ["Les retrouvailles", "Partez quelques minutes, puis revenez"],
    reseau: ["L'averse", "Perdez le réseau un instant"],
    avion: ["L'avion de papier", "Préparez un retour pour GitHub"],
    montre: ["La montre à gousset", "Restez 10 minutes"],
    engrenages: ["Les cinq engrenages", "Cherchez les engrenages perdus"]
  };
  const SIESTE_MS = 35000;

  const FICHIERS = {
    // accessoires (data-octet-mood="…" sur une section)
    compass: "octet-boussole", wrench: "octet-cle", flask: "octet-fiole", notebook: "octet-carnet",
    hourglass: "octet-sablier", loupe: "octet-loupe", watering: "octet-arrosoir",
    lock: "octet-cadenas", shield: "octet-bouclier", files: "octet-dossiers", scales: "octet-balance",
    // gestes
    walk: "octet-course", jump: "octet-grand-saut", climb: "octet-escalade", fall: "octet-chute", slide: "octet-glissade",
    sleep: "octet-sieste", joy: "octet-saut-joie", carry: "octet-port-engrenage", map: "octet-lecture-carte", snack: "octet-pause-gouter",
    // réactions et activités
    hello: "octet-bonjour", idea: "octet-idee", surprise: "octet-surprise", peek: "octet-curieux", push: "octet-pousse-caisse",
    rope: "octet-tire-corde", lantern: "octet-lanterne", spyglass: "octet-longue-vue", tiptoe: "octet-pointe-pieds",
    zen: "octet-meditation", dizzy: "octet-etourdi", flag: "octet-drapeau", hammer: "octet-marteau", paint: "octet-pinceau",
    saw: "octet-scie", toolbox: "octet-boite-outils", spool: "octet-bobine", bigkey: "octet-grande-cle", bell: "octet-clochette",
    plan: "octet-plan", candle: "octet-bougie", coil: "octet-corde", umbrella: "octet-parapluie", watch: "octet-montre",
    tea: "octet-the", scarf: "octet-echarpe", point: "octet-direction", book: "octet-livre", plane: "octet-avion",
    acorns: "octet-glands", thumb: "octet-pouce", shrug: "octet-haussement", flute: "octet-flute", dandelion: "octet-pissenlit",
    stretch: "octet-etirement", gift: "octet-cadeau"
  };
  // Accessoires que le dessin SVG de secours sait représenter ; les autres se replient sur l'un d'eux
  const SVG_MOODS = ["compass", "wrench", "flask", "notebook", "hourglass", "loupe", "watering"];
  const REPLI_SVG = { sleep: "hourglass", map: "compass", files: "notebook", lock: "wrench", shield: "wrench", scales: "compass" };
  const PLANCHE = "octet-walk-jump-sheet";

  const lireJSON = (cle, defaut) => {
    try { const v = localStorage.getItem(cle); return v ? { ...defaut, ...JSON.parse(v) } : { ...defaut }; }
    catch { return { ...defaut }; }
  };
  const ecrireJSON = (cle, val) => { try { localStorage.setItem(cle, JSON.stringify(val)); } catch { /* navigation privée */ } };
  const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* --------------------------------------------------------------------------
     Module E — sons de synthèse (Web Audio, 0 fichier). Coupés par défaut.
     -------------------------------------------------------------------------- */
  class OctetSoundEngine {
    constructor(actif) { this.actif = actif; this.ctx = null; this.master = null; }
    _reduit() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    activer(oui) {
      this.actif = oui;
      if (oui && !this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.07;
        this.master.connect(this.ctx.destination);
      }
      if (oui && this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    }
    _pret() { return this.actif && this.ctx && !this._reduit(); }
    _bruit(duree) {
      const n = Math.max(1, Math.floor(this.ctx.sampleRate * duree));
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      return src;
    }
    _enveloppe(attaque, decroissance) {
      const g = this.ctx.createGain(), t = this.ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + attaque);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attaque + decroissance);
      g.connect(this.master);
      return g;
    }
    playLand() {
      if (!this._pret()) return;
      const src = this._bruit(0.06), f = this.ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 650;
      src.connect(f); f.connect(this._enveloppe(0.002, 0.028));
      src.start(); src.stop(this.ctx.currentTime + 0.06);
    }
    playWrench() {
      if (!this._pret()) return;
      const g = this._enveloppe(0.003, 0.09), t = this.ctx.currentTime;
      [[1760, "sine"], [2637, "triangle"]].forEach(([fr, type]) => {
        const o = this.ctx.createOscillator();
        o.type = type; o.frequency.value = fr; o.connect(g); o.start(t); o.stop(t + 0.11);
      });
    }
    playPaper() {
      if (!this._pret()) return;
      const src = this._bruit(0.1), f = this.ctx.createBiquadFilter();
      f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 1.8;
      src.connect(f); f.connect(this._enveloppe(0.004, 0.075));
      src.start(); src.stop(this.ctx.currentTime + 0.1);
    }
    _note(freq, debut, duree, type = "triangle", volume = 0.8) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime + debut;
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(volume, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + duree + 0.02);
    }
    playBell() {
      if (!this._pret()) return;
      this._note(1318.5, 0, 0.9, "sine", 0.9); this._note(2637, 0, 0.5, "sine", 0.3);
      this._note(1318.5, 0.28, 0.9, "sine", 0.7);
    }
    playFlute() {
      if (!this._pret()) return;
      // petit air de cinq notes (do ré mi sol mi), doux
      [[523.3, 0], [587.3, 0.22], [659.3, 0.44], [784, 0.66], [659.3, 0.95]].forEach(([f, d]) => this._note(f, d, 0.3, "triangle", 0.5));
    }
    fermer() { try { this.ctx && this.ctx.close(); } catch { /* déjà fermé */ } this.ctx = null; }
  }

  class OctetEngine {
    static STYLE_ID = "octet-engine-v3-styles";

    constructor(userConfig = {}) {
      const ctx = window.OCTET_APP_CONTEXT || {};
      const site = (userConfig.site || ATTR("data-site", "auto")).toLowerCase();
      this.site = site === "eu" || site === "fr" ? site
        : (/(^|\.)alphabette\.eu$/i.test(location.hostname) || document.documentElement.dataset.univers === "labo" ? "eu" : "fr");
      const assets = (userConfig.assets || ATTR("data-assets", "/assets/octet/dist")).replace(/\/$/, "");

      this.config = {
        appName: ctx.appName || ATTR("data-app", "alphabette"),
        assets,
        defaultMood: ctx.defaultMood || (this.site === "eu" ? "flask" : "compass"),
        selector: "auto",
        ignoreSelector: "[data-octet-ignore], header, nav, dialog, [role='dialog'], [aria-modal='true'], .ab-barre, .ab-shell-bar",
        autoMoods: ["compass", "wrench", "notebook", "watering", "flask", "scales", "files"],
        walkSpeed: 74,
        topSafeMargin: 112,
        bottomSafeMargin: 22,
        spriteDefaultFacing: 1,
        tips: ctx.tips || [
          "Je change d'objet selon l'endroit de la page où je me pose : boussole, clé, carnet, arrosoir, fiole…",
          "Je vous gêne ? « Pause » en bas à droite m'arrête, « Masquer » me cache. Je m'en souviens à votre prochaine visite.",
          "Surlignez un passage : j'arrive avec ma loupe, et en cliquant sur moi vous pouvez le copier ou nous en parler.",
          "Si vous ne bougez plus pendant un moment, je fais la sieste pour ne pas vous distraire.",
          "Raccourci : la touche Échap ferme ce carnet."
        ],
        actions: ctx.actions || null,
        feedbackEndpoint: ctx.feedbackEndpoint || null,
        repoIssuesUrl: ctx.repoIssuesUrl || "https://github.com/azertylm/Alphabette/issues/new",
        ...userConfig
      };

      this.moodLabels = {
        compass: "Boussole", wrench: "Clé à molette", flask: "Fiole", notebook: "Carnet", hourglass: "Sablier",
        loupe: "Loupe", watering: "Arrosoir", lock: "Cadenas", shield: "Bouclier", files: "Dossiers", scales: "Balance",
        walk: "En route", jump: "Hop !", climb: "Escalade", fall: "Oups !", slide: "Glissade", sleep: "Sieste",
        joy: "Youpi !", carry: "Engrenage", map: "Carte", snack: "Goûter",
        hello: "Bonjour", idea: "Idée", surprise: "Oh !", peek: "Coucou", push: "Pousse", rope: "Corde", lantern: "Lanterne",
        spyglass: "Longue-vue", tiptoe: "Chut…", zen: "Zen", dizzy: "Tournis", flag: "Victoire", hammer: "Marteau",
        paint: "Pinceau", saw: "Scie", toolbox: "Outils", spool: "Équilibre", bigkey: "Grande clé", bell: "Clochette",
        plan: "Plans", candle: "Bougie", coil: "Corde", umbrella: "Parapluie", watch: "Montre", tea: "Thé", scarf: "Écharpe",
        point: "Par ici", book: "Lecture", plane: "Envol", acorns: "Glands", thumb: "Bravo", shrug: "Bof", flute: "Flûte",
        dandelion: "Pissenlit", stretch: "Bâillement", gift: "Cadeau"
      };

      this.reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.prefs = lireJSON(CLE_PREFS, { paused: false, hidden: false, debug: false, sound: false });
      this.gears = lireJSON(CLE_ENGRENAGES, { ids: [], inventorMode: false });
      this.confort = lireJSON(CLE_CONFORT, { taille: 100, contraste: false });
      this.sound = new OctetSoundEngine(false);
      this.secrets = lireJSON(CLE_SECRETS, { ids: [] });
      this.champsVus = new WeakSet();
      this.caresse = []; this.caresseDir = 0;
      this.derniereReplique = 0;
      this.debutVisite = performance.now();
      this.rappels = {};
      this.largeurAvant = window.innerWidth;

      this.state = "IDLE";
      this.prevStateBeforeMenu = "IDLE";
      this.activeMood = this.config.defaultMood;
      this.sectionMood = this.config.defaultMood;
      this.menuMoodOverride = null;
      this.x = 120; this.y = 200; this.facing = 1;
      this.scaleX = 1; this.scaleY = 1; this.tiltDeg = 0;
      this.platforms = [];
      this.currentPlatform = null;
      this.lastPlatformId = null;
      this.walkTargetX = 120;
      this.stateTimer = 0;
      this.jump = null;
      this.sheetTimer = 0; this.sheetWalkIdx = 0; this.tipIndex = 0;
      this.lastScrollY = window.scrollY;
      this.lastFrameTime = performance.now();
      this.lastActivity = performance.now();
      this.lastPointer = null;
      this.scrollHistory = [];
      this.lastSelectionText = "";
      this.available = new Set();
      this.timers = new Set();
      this.cardTimers = new Map();
      this.injectedGears = [];
      this.rafId = null; this.scrollRaf = null; this.rescanTimer = null; this.selectionTimer = null;
      this.destroyed = false;

      this._bound = {
        tick: this._tick.bind(this),
        onScroll: this._onScroll.bind(this),
        onResize: this._onResize.bind(this),
        onDocClick: this._onDocClick.bind(this),
        onKeyDown: this._onKeyDown.bind(this),
        onReducedMotionChange: this._onReducedMotionChange.bind(this),
        onActivity: this._onActivity.bind(this),
        onPointerMove: this._onPointerMove.bind(this),
        onSelection: this._onSelection.bind(this),
        onCardEnter: this._onCardEnter.bind(this),
        onCardLeave: this._onCardLeave.bind(this),
        onActorDown: this._onActorPointerDown.bind(this),
        onActorMove: this._onActorPointerMove.bind(this),
        onActorUp: this._onActorPointerUp.bind(this),
        onCopy: this._onCopy.bind(this),
        onReseau: this._onReseau.bind(this),
        onVisibilite: this._onVisibilite.bind(this),
        onFocusChamp: this._onFocusChamp.bind(this)
      };

      this._appliquerConfort();
      this._appliquerInventeur();
      this._injectStyles();
      this._mountDOM();
      this._bindEvents();
      this._initPositionAndState();
      this._scanGears();
      this._scanCards();
      this.preloadAssets();
      if (!this.prefs.paused && !this.prefs.hidden && !this._calme()) this._bonjourDuJour();
    }

    /* -------------------------------------------------------------------------
       Préférences, minuteries, métriques
       ------------------------------------------------------------------------- */
    _savePrefs() { ecrireJSON(CLE_PREFS, this.prefs); }
    _later(fn, ms) {
      const id = setTimeout(() => { this.timers.delete(id); if (!this.destroyed) fn(); }, ms);
      this.timers.add(id);
      return id;
    }
    _getMetrics() {
      const vw = window.innerWidth;
      const isCompact = vw < 640;
      return { size: isCompact ? 70 : 92, minPlatformWidth: isCompact ? 44 : 56, sidePadding: isCompact ? 14 : 24, isCompact, isBottomSheet: vw < 420 };
    }
    _calme() { return this.reducedMotionQuery.matches || document.documentElement.dataset.calme === "oui"; }
    _enMission() { return this.state === "REPAIRING" || !!(this.jump && this.jump.onLand); }
    _bloque() { return this.state === "CELEBRATING" || this._enMission() || this.prefs.hidden || this.state === "PAUSED" || this.state === "MENU_OPEN" || this.state === "REPAIRING"; }

    /* -------------------------------------------------------------------------
       Module A — préchargement réel des images (bascule SVG → WebP seulement si l'image charge)
       ------------------------------------------------------------------------- */
    preloadAssets() {
      const charger = (noms) => {
        noms.forEach((nom) => {
          const im = new Image();
          im.decoding = "async";
          im.onload = () => { if (this.destroyed) return; this.available.add(nom); this._renderVisual(true); };
          im.onerror = () => { /* pose absente : le dessin SVG reste affiché */ };
          im.src = `${this.config.assets}/${nom}.webp`;
        });
      };
      // manifest.json (écrit par scripts/process_octet_assets.py) liste les poses présentes
      const lancer = () => {
        fetch(`${this.config.assets}/manifest.json`, { cache: "no-cache" })
          .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
          .then((m) => { if (!this.destroyed) charger((m.poses || []).filter((n) => /^octet-[a-z-]+$/.test(n))); })
          .catch(() => { if (!this.destroyed) charger(["octet-boussole", "octet-cle", "octet-fiole", "octet-carnet", "octet-sablier", "octet-loupe", "octet-arrosoir"]); });
      };
      if ("requestIdleCallback" in window) this.idleId = window.requestIdleCallback(lancer, { timeout: 2000 });
      else this._later(lancer, 400);
    }
    _url(nom) { return this.available.has(nom) ? `${this.config.assets}/${nom}.webp` : null; }

    /* -------------------------------------------------------------------------
       Styles et DOM
       ------------------------------------------------------------------------- */
    _injectStyles() {
      if (document.getElementById(OctetEngine.STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = OctetEngine.STYLE_ID;
      style.textContent = `
        :root { --octet-size: 92px; }
        @media (max-width: 639px) { :root { --octet-size: 70px; } }

        #octet-debug-layer {
          position: fixed; inset: 0; pointer-events: none; z-index: 9985; display: none;
        }
        #octet-debug-layer.visible { display: block; }
        .octet-debug-plat {
          position: fixed; height: 3px; background: rgba(168, 104, 41, 0.78);
          border-radius: 2px; box-shadow: 0 0 0 1px rgba(44, 26, 14, 0.25);
        }

        #octet-stage {
          position: fixed; inset: 0; pointer-events: none; z-index: 9990; overflow: hidden;
        }

        #octet-actor {
          position: fixed; left: 0; top: 0;
          width: var(--octet-size); height: var(--octet-size);
          margin-left: calc(var(--octet-size) * -0.5);
          margin-top: calc(var(--octet-size) * -0.96);
          padding: 0; border: none; background: transparent;
          cursor: pointer; pointer-events: auto; will-change: transform;
          outline: none; -webkit-tap-highlight-color: transparent;
        }
        #octet-actor:focus-visible {
          filter: drop-shadow(0 0 6px #a86829);
        }
        #octet-actor.hidden-mascot { display: none; }

        .octet-rig {
          width: 100%; height: 100%; transform-origin: 50% 96%;
          transition: filter 0.2s ease;
        }
        #octet-actor:hover .octet-rig {
          filter: drop-shadow(0 4px 8px rgba(44, 26, 14, 0.28));
        }

        /* Sprites externes / Spritesheet */
        .octet-sprite-img {
          width: 100%; height: 100%; object-fit: contain; display: block;
          user-select: none; pointer-events: none;
        }
        #octet-actor[data-state="IDLE"] .octet-sprite-img,
        #octet-actor[data-state="PAUSED"] .octet-sprite-img {
          transform-origin: 50% 100%; animation: octetBreathe 2.8s ease-in-out infinite;
        }
        #octet-actor[data-state="WALKING_ON_TEXT"] .octet-sprite-img {
          transform-origin: 50% 100%; animation: octetWalkBob 0.34s ease-in-out infinite;
        }
        #octet-actor[data-state="MENU_OPEN"] .octet-sprite-img {
          transform-origin: 50% 100%; animation: octetGreet 0.45s cubic-bezier(0.22, 1, 0.36, 1) 1;
        }
        .octet-sheet {
          width: 100%; height: 100%; background-repeat: no-repeat;
          pointer-events: none;
        }

        /* Animations SVG internes */
        .octet-svg { width: 100%; height: 100%; overflow: visible; display: block; }
        .octet-body-group { transform-origin: 55px 86px; }
        .octet-tail       { transform-origin: 36px 86px; }
        .octet-paw-left   { transform-origin: 48px 94px; }
        .octet-paw-right  { transform-origin: 64px 94px; }
        .octet-eyelid     { transform-origin: 69px 45px; transform: scaleY(0); }
        .octet-goggles    { transition: transform 0.22s ease; }

        /* Lunettes baissées sur les yeux en plein saut ou concentration labo/atelier */
        #octet-actor[data-state="JUMPING"] .octet-goggles,
        #octet-actor[data-mood="flask"][data-state="IDLE"] .octet-goggles {
          transform: translate(6px, 11px) rotate(12deg);
        }

        #octet-actor[data-state="IDLE"] .octet-body-group,
        #octet-actor[data-state="PAUSED"] .octet-body-group {
          animation: octetBreathe 2.8s ease-in-out infinite;
        }
        #octet-actor[data-state="IDLE"] .octet-tail {
          animation: octetTailWag 2.6s ease-in-out infinite;
        }
        #octet-actor[data-state="IDLE"] .octet-eyelid,
        #octet-actor[data-state="MENU_OPEN"] .octet-eyelid {
          animation: octetBlink 4.2s infinite;
        }
        #octet-actor[data-state="WALKING_ON_TEXT"] .octet-body-group {
          animation: octetWalkBob 0.34s ease-in-out infinite;
        }
        #octet-actor[data-state="WALKING_ON_TEXT"] .octet-paw-left {
          animation: octetStepA 0.34s linear infinite;
        }
        #octet-actor[data-state="WALKING_ON_TEXT"] .octet-paw-right {
          animation: octetStepB 0.34s linear infinite;
        }
        #octet-actor[data-state="WALKING_ON_TEXT"] .octet-tail {
          animation: octetTailWag 0.58s ease-in-out infinite;
        }
        #octet-actor[data-state="JUMPING"] .octet-paw-left { transform: rotate(22deg) translateY(-3px); }
        #octet-actor[data-state="JUMPING"] .octet-paw-right { transform: rotate(-18deg) translateY(-4px); }
        #octet-actor[data-state="JUMPING"] .octet-tail { transform: rotate(-18deg); }
        #octet-actor[data-state="MENU_OPEN"] .octet-body-group {
          animation: octetGreet 0.45s cubic-bezier(0.22, 1, 0.36, 1) 1;
        }

        @keyframes octetBreathe {
          0%, 100% { transform: translateY(0) scaleY(1); }
          50%      { transform: translateY(-1.5px) scaleY(1.02); }
        }
        @keyframes octetWalkBob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-3.5px) rotate(2.5deg); }
        }
        @keyframes octetStepA {
          0%, 100% { transform: translateX(-4px) translateY(0); }
          50%      { transform: translateX(4px) translateY(-3px); }
        }
        @keyframes octetStepB {
          0%, 100% { transform: translateX(4px) translateY(-3px); }
          50%      { transform: translateX(-4px) translateY(0); }
        }
        @keyframes octetTailWag {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(9deg); }
        }
        @keyframes octetBlink {
          0%, 92%, 100% { transform: scaleY(0); }
          96%           { transform: scaleY(1); }
        }
        @keyframes octetGreet {
          0%   { transform: translateY(0) scale(1); }
          35%  { transform: translateY(-10px) scale(1.05, 0.96); }
          70%  { transform: translateY(2px) scale(0.97, 1.03); }
          100% { transform: translateY(0) scale(1); }
        }

        .octet-dust {
          position: fixed; width: 24px; height: 8px;
          margin-left: -12px; margin-top: -4px; border-radius: 50%;
          background: radial-gradient(circle, rgba(117, 86, 62, 0.48), transparent 72%);
          pointer-events: none; animation: octetDustFade 0.36s ease-out forwards;
        }
        @keyframes octetDustFade {
          0%   { transform: scale(0.4); opacity: 0.9; }
          100% { transform: scale(1.9); opacity: 0; }
        }

        /* ================= BULLE CONTEXTUELLE + BOTTOM SHEET MOBILE ================= */
        #octet-bubble {
          position: fixed;
          width: min(326px, calc(100vw - 24px));
          background: #fdf9f0;
          border: 2px solid #2c1a0e;
          border-radius: 16px;
          box-shadow: 0 12px 30px rgba(44, 26, 14, 0.2), 0 0 0 4px rgba(247, 241, 227, 0.9);
          padding: 16px;
          pointer-events: auto;
          z-index: 9995;
          font-family: system-ui, -apple-system, sans-serif;
          color: #2c1a0e;
          display: none;
        }
        #octet-bubble.open { display: block; animation: octetPopIn 0.18s ease-out; }
        @keyframes octetPopIn {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Mode Bottom Sheet automatique sous 420px */
        #octet-bubble[data-placement="sheet"] {
          left: 10px !important;
          right: 10px !important;
          bottom: 58px !important;
          top: auto !important;
          width: auto !important;
          border-radius: 18px;
          box-shadow: 0 -6px 28px rgba(44, 26, 14, 0.22);
        }
        #octet-bubble[data-placement="sheet"] .bubble-arrow { display: none; }

        .bubble-arrow {
          position: absolute; width: 12px; height: 12px; background: #fdf9f0;
          border-right: 2px solid #2c1a0e; border-bottom: 2px solid #2c1a0e;
          transform: rotate(45deg);
        }
        #octet-bubble[data-placement="top"] .bubble-arrow { bottom: -7px; }
        #octet-bubble[data-placement="bottom"] .bubble-arrow { top: -7px; transform: rotate(-135deg); }

        .bubble-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 10px; margin-bottom: 10px; padding-bottom: 10px;
          border-bottom: 1px dashed #d3be9e;
        }
        .bubble-title { font-family: "Georgia", serif; font-size: 1.02rem; font-weight: 700; margin: 0; }
        .bubble-sub { font-size: 0.82rem; color: #5c402c; margin: 2px 0 0; }

        .bubble-close {
          background: transparent; border: 1.5px solid transparent; color: #2c1a0e;
          font-size: 1.3rem; line-height: 1; cursor: pointer; border-radius: 8px; padding: 3px 8px;
        }
        .bubble-close:hover, .bubble-close:focus-visible {
          background: #efe5d1; border-color: #2c1a0e; outline: none;
        }

        .bubble-actions { display: flex; flex-direction: column; gap: 7px; }
        .bubble-action-btn {
          width: 100%; text-align: left; background: #f7f1e3;
          border: 1.5px solid #c9b290; border-radius: 10px;
          padding: 10px 12px; font-size: 0.9rem; font-weight: 600; color: #2c1a0e;
          cursor: pointer; display: flex; align-items: center; gap: 10px;
          transition: background 0.15s, border-color 0.15s, transform 0.12s;
        }
        .bubble-action-btn:hover, .bubble-action-btn:focus-visible {
          background: #efe5d1; border-color: #2c1a0e; transform: translateX(2px); outline: none;
        }

        .bubble-panel {
          background: #f7f1e3; border: 1px solid #c9b290; border-radius: 10px;
          padding: 12px; font-size: 0.88rem; line-height: 1.48;
        }
        .bubble-panel textarea {
          width: 100%; min-height: 68px; margin-top: 8px; padding: 8px;
          border: 1.5px solid #b89d76; border-radius: 8px; font-family: inherit;
          font-size: 0.88rem; background: #fffdf8; color: #2c1a0e; resize: vertical;
        }
        .bubble-panel-footer {
          display: flex; justify-content: space-between; align-items: center;
          margin-top: 10px; gap: 8px;
        }
        .bubble-mini-btn {
          background: #2c1a0e; color: #fdf9f0; border: 1.5px solid #2c1a0e;
          border-radius: 8px; padding: 7px 12px; font-size: 0.84rem; font-weight: 700; cursor: pointer;
        }
        .bubble-mini-btn.ghost { background: transparent; color: #2c1a0e; }

        /* ================= BARRE DE CONTRÔLE DISCRÈTE ================= */
        #octet-controls {
          position: fixed; right: 12px; bottom: 12px; z-index: 9992;
          display: flex; align-items: center; gap: 4px;
          background: rgba(253, 249, 240, 0.95);
          backdrop-filter: blur(6px);
          border: 1.5px solid #c9b290; border-radius: 999px;
          padding: 4px 8px; box-shadow: 0 4px 14px rgba(44, 26, 14, 0.14);
          font-family: system-ui, -apple-system, sans-serif;
        }
        .octet-mood-pill {
          font-size: 0.74rem; font-weight: 700; color: #7d4a18;
          padding: 3px 8px; border-right: 1px solid #d3be9e; user-select: none;
        }
        @media (max-width: 480px) { .octet-mood-pill { display: none; } }

        .octet-ctrl-btn {
          border: none; background: transparent; color: #2c1a0e;
          font-size: 0.78rem; font-weight: 700; padding: 6px 9px;
          border-radius: 999px; cursor: pointer;
        }
        .octet-ctrl-btn:hover, .octet-ctrl-btn[aria-pressed="true"] {
          background: #efe5d1;
        }

        @media print { #octet-stage, #octet-controls, #octet-debug-layer { display: none !important; } }
        @media (prefers-reduced-motion: reduce) {
          .octet-body-group, .octet-tail, .octet-paw-left, .octet-paw-right, .octet-sprite-img {
            animation: none !important;
          }
        }
      
        #octet-actor[data-state="IDLE"] .octet-sprite-img,
        #octet-actor[data-state="PAUSED"] .octet-sprite-img { transform-origin: 50% 100%; animation: octetBreathe 2.8s ease-in-out infinite; }
        #octet-actor[data-state="SLEEPING"] .octet-sprite-img,
        #octet-actor[data-state="SLEEPING"] .octet-body-group { transform-origin: 50% 100%; animation: octetBreathe 4.6s ease-in-out infinite; }
        #octet-actor[data-state="WALKING_ON_TEXT"] .octet-sprite-img { transform-origin: 50% 100%; animation: octetWalkBob 0.34s ease-in-out infinite; }
        #octet-actor[data-state="MENU_OPEN"] .octet-sprite-img { transform-origin: 50% 100%; animation: octetGreet 0.45s cubic-bezier(0.22, 1, 0.36, 1) 1; }
        #octet-actor[data-state="REPAIRING"] .octet-sprite-img,
        #octet-actor[data-state="REPAIRING"] .octet-body-group { transform-origin: 50% 100%; animation: octetTap 0.32s ease-in-out 2; }
        #octet-actor[data-state="SLEEPING"] .octet-goggles { transform: translate(6px, 11px) rotate(12deg); }
        @keyframes octetTap { 0%,100% { transform: rotate(0); } 40% { transform: rotate(-7deg) translateY(1px); } }

        .octet-zzz { position: absolute; left: 62%; top: -6%; pointer-events: none; display: none; }
        #octet-actor[data-state="SLEEPING"] .octet-zzz { display: block; }
        .octet-zzz span { position: absolute; font: 700 13px Georgia, serif; color: #7d4a18; opacity: 0; animation: octetZ 3s ease-in-out infinite; }
        .octet-zzz span:nth-child(2) { animation-delay: 1s; font-size: 11px; }
        .octet-zzz span:nth-child(3) { animation-delay: 2s; font-size: 9px; }
        @keyframes octetZ { 0% { transform: translate(0, 0); opacity: 0; } 25% { opacity: 0.9; } 100% { transform: translate(14px, -26px); opacity: 0; } }

        .octet-spark { position: fixed; width: 4px; height: 4px; border-radius: 50%; background: #2c1a0e; pointer-events: none; z-index: 9991; animation: octetSpark 0.42s ease-out forwards; }
        @keyframes octetSpark { from { transform: translate(0, 0); opacity: 1; } to { transform: translate(var(--dx), var(--dy)); opacity: 0; } }

        .octet-toast, .octet-pill {
          position: fixed; z-index: 9993; transform: translate(-50%, -100%);
          font: 700 0.82rem system-ui, -apple-system, sans-serif; color: #2c1a0e; background: #fdf9f0;
          border: 1.5px solid #2c1a0e; border-radius: 999px; padding: 6px 12px; white-space: nowrap;
          box-shadow: 0 6px 16px rgba(44, 26, 14, 0.18);
        }
        .octet-toast { pointer-events: none; animation: octetPopIn 0.18s ease-out; }
        .octet-quip { font-family: Georgia, serif; font-style: italic; font-weight: 600; white-space: normal; max-width: min(300px, 80vw); text-align: center; border-radius: 14px; }
        #octet-actor { touch-action: none; }
        #octet-actor[data-state="DRAGGED"] { cursor: grabbing; }
        .octet-confetti { position: fixed; top: -30px; width: 22px; height: 22px; pointer-events: none; z-index: 9994;
          animation: octetConfetti var(--d, 3s) cubic-bezier(0.3, 0.6, 0.6, 1) forwards; }
        @keyframes octetConfetti { to { transform: translateY(110vh) rotate(var(--r, 360deg)); } }
        .octet-secrets { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
        .octet-secrets li { color: #75563e; font-style: italic; }
        .octet-secrets li.ok { color: #2c1a0e; font-style: normal; font-weight: 700; }
        .octet-secrets li span { display: inline-block; width: 1.2em; text-align: center; }
        .octet-pill { cursor: pointer; min-height: 32px; }
        .octet-pill:hover, .octet-pill:focus-visible { background: #efe5d1; outline: 2px solid #7d4a18; outline-offset: 2px; }

        .octet-gear-btn {
          display: inline-flex; align-items: center; justify-content: center; vertical-align: middle;
          width: 22px; height: 22px; padding: 0; margin: 0 4px; border: none; border-radius: 50%;
          background: transparent; cursor: pointer; transition: transform 0.25s ease, opacity 0.35s ease;
        }
        .octet-gear-btn:hover { transform: rotate(35deg) scale(1.12); }
        .octet-gear-btn:focus-visible { outline: 2px solid #7d4a18; outline-offset: 2px; }
        .octet-gear-btn.octet-gone { opacity: 0; transform: scale(0.2) rotate(120deg); }

        .octet-banner { background: #efe5d1; border: 1px solid #c9b290; border-radius: 10px; padding: 9px 10px; margin-bottom: 10px; font-size: 0.84rem; }
        .octet-banner q { display: block; font-style: italic; margin: 4px 0 8px; max-height: 3.2em; overflow: hidden; }
        .octet-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .octet-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #d3be9e; font-size: 0.8rem; color: #4e3422; }
        .bubble-panel label, .bubble-panel legend { font-weight: 700; }
        .bubble-panel fieldset { border: 1px solid #c9b290; border-radius: 8px; margin: 0 0 10px; padding: 6px 10px 8px; }
        .bubble-panel select, .bubble-panel input[type="text"] { width: 100%; margin-top: 6px; padding: 8px; border: 1.5px solid #b89d76; border-radius: 8px; font: inherit; background: #fffdf8; color: #2c1a0e; }
        .bubble-panel details { margin-top: 8px; }
        .bubble-panel details pre { white-space: pre-wrap; font-size: 0.74rem; background: #fffdf8; border-radius: 6px; padding: 6px; }
        .octet-choice { display: inline-flex; align-items: center; gap: 4px; margin-right: 10px; min-height: 32px; }
        .octet-status { margin-top: 8px; font-weight: 700; }
        #octet-bubble .bubble-body-scroll { max-height: min(62vh, 520px); overflow-y: auto; }

        /* Module F — contraste renforcé AAA (≥ 7:1) */
        html.octet-high-contrast body, html.octet-high-contrast main, html.octet-high-contrast section,
        html.octet-high-contrast article, html.octet-high-contrast aside, html.octet-high-contrast div {
          background-color: #fffdf5 !important; color: #111111 !important; border-color: #111111 !important;
          text-shadow: none !important; box-shadow: none !important;
        }
        html.octet-high-contrast p, html.octet-high-contrast li, html.octet-high-contrast h1, html.octet-high-contrast h2,
        html.octet-high-contrast h3, html.octet-high-contrast h4, html.octet-high-contrast span, html.octet-high-contrast label { color: #111111 !important; }
        html.octet-high-contrast a { color: #003380 !important; text-decoration: underline !important; }
        html.octet-high-contrast button { background: #fffdf5 !important; color: #111111 !important; border: 2px solid #111111 !important; }
        html.octet-high-contrast img, html.octet-high-contrast video { filter: none !important; }

        /* Module G — « Mode Carnet d'inventeur » (récompense 5/5) */
        html.octet-inventor-mode body {
          background-color: #f6ecd6 !important;
          background-image:
            radial-gradient(circle at 15% 10%, rgba(168, 104, 41, 0.10), transparent 45%),
            radial-gradient(circle at 85% 90%, rgba(117, 86, 62, 0.12), transparent 50%),
            repeating-linear-gradient(0deg, rgba(125, 74, 24, 0.035) 0 1px, transparent 1px 28px) !important;
        }
        html.octet-inventor-mode main, html.octet-inventor-mode #root { filter: sepia(0.18) saturate(0.95); }

        @media (prefers-reduced-motion: reduce) {
          .octet-sprite-img, .octet-zzz span, .octet-spark, .octet-gear-btn { animation: none !important; transition: none !important; }
          .octet-confetti { display: none !important; }
        }
        @media print { #octet-stage, #octet-controls, #octet-debug-layer, .octet-toast, .octet-pill, .octet-gear-btn { display: none !important; } }
      `;
      document.head.appendChild(style);
    }

    _mountDOM() {
      this.debugLayer = document.createElement("div");
      this.debugLayer.id = "octet-debug-layer";
      this.debugLayer.setAttribute("data-octet-ignore", "");
      this.debugLayer.setAttribute("aria-hidden", "true");

      this.stageEl = document.createElement("div");
      this.stageEl.id = "octet-stage";
      this.stageEl.setAttribute("data-octet-ignore", "");
      this.stageEl.innerHTML = `
        <button id="octet-actor" type="button" data-state="IDLE" data-mood="${this.config.defaultMood}"
          aria-label="Octet, la mascotte d'Alphabette. Ouvrir son carnet."
          aria-haspopup="dialog" aria-expanded="false" aria-controls="octet-bubble">
          <div class="octet-rig" id="octet-rig"></div>
          <div class="octet-zzz" aria-hidden="true"><span>z</span><span>z</span><span>z</span></div>
        </button>
        <div id="octet-bubble" role="dialog" aria-modal="false" aria-labelledby="octet-bubble-title" data-placement="top">
          <div class="bubble-arrow" id="octet-bubble-arrow"></div>
          <div class="bubble-header">
            <div>
              <h2 class="bubble-title" id="octet-bubble-title">Coucou ! Je suis Octet</h2>
              <p class="bubble-sub" id="octet-bubble-sub">Mécanicienne d'Alphabette</p>
            </div>
            <button class="bubble-close" id="octet-bubble-close" type="button" aria-label="Fermer le carnet d'Octet">&times;</button>
          </div>
          <div class="bubble-body-scroll"><div id="octet-bubble-body"></div></div>
          <div class="octet-foot" id="octet-bubble-foot"></div>
        </div>
      `;

      this.controlsEl = document.createElement("div");
      this.controlsEl.id = "octet-controls";
      this.controlsEl.setAttribute("data-octet-ignore", "");
      this.controlsEl.setAttribute("role", "region");
      this.controlsEl.setAttribute("aria-label", "Réglages d'Octet");
      this.controlsEl.innerHTML = `
        <span class="octet-mood-pill" id="octet-mood-pill" aria-hidden="true">Boussole</span>
        <button class="octet-ctrl-btn" id="btn-octet-sound" type="button" aria-pressed="false" aria-label="Sons d'Octet">🔇</button>
        <button class="octet-ctrl-btn" id="btn-octet-pause" type="button" aria-pressed="false">Pause</button>
        <button class="octet-ctrl-btn" id="btn-octet-hide" type="button" aria-pressed="false">Masquer</button>
      `;

      document.body.append(this.debugLayer, this.stageEl, this.controlsEl);
      const q = (id) => document.getElementById(id);
      this.actorEl = q("octet-actor");
      this.rigEl = q("octet-rig");
      this.bubbleEl = q("octet-bubble");
      this.bubbleArrow = q("octet-bubble-arrow");
      this.bubbleBody = q("octet-bubble-body");
      this.bubbleTitle = q("octet-bubble-title");
      this.bubbleSub = q("octet-bubble-sub");
      this.bubbleFoot = q("octet-bubble-foot");
      this.btnClose = q("octet-bubble-close");
      this.moodPillEl = q("octet-mood-pill");
      this.btnSound = q("btn-octet-sound");
      this.btnPause = q("btn-octet-pause");
      this.btnHide = q("btn-octet-hide");
    }

    /* -------------------------------------------------------------------------
       Rendu : planche (marche/saut) → pose WebP → dessin SVG de secours
       ------------------------------------------------------------------------- */
    _getAccessorySVG(mood) {
      switch (mood) {
        case "flask":
          return `
            <g transform="translate(75 50)">
              <path d="M 8 4 L 8 11 C 3 13, 2 22, 8 24 C 14 25, 19 20, 16 13 L 13 11 L 13 4 Z"
                    fill="#fdf9f0" stroke="#2c1a0e" stroke-width="1.8"/>
              <path d="M 5 18 C 7 16, 13 16, 15 18 C 15 22, 11 24, 8 23 C 5 22, 4 20, 5 18 Z"
                    fill="#d8a25e" opacity="0.85"/>
              <line x1="6" y1="4" x2="15" y2="4" stroke="#2c1a0e" stroke-width="2" stroke-linecap="round"/>
              <circle cx="9" cy="-1" r="1.7" fill="#f3dfc1" stroke="#2c1a0e" stroke-width="1.2"/>
              <circle cx="13" cy="-5" r="2.2" fill="#f3dfc1" stroke="#2c1a0e" stroke-width="1.2"/>
            </g>`;
        case "compass":
          return `
            <g transform="translate(76 54)">
              <circle cx="10" cy="11" r="9" fill="#d9b482" stroke="#2c1a0e" stroke-width="1.9"/>
              <circle cx="10" cy="11" r="6.4" fill="#fdf9f0" stroke="#4e3422" stroke-width="1.1"/>
              <polygon points="10,6 12,11 10,16 8,11" fill="#a86829" stroke="#2c1a0e" stroke-width="0.9"/>
              <path d="M 5 3 C 8 -2, 15 -2, 16 4" fill="#e6cca3" stroke="#2c1a0e" stroke-width="1.6"/>
            </g>`;
        case "notebook":
          return `
            <g transform="translate(71 58)">
              <rect x="0" y="5" width="15" height="17" rx="2" transform="rotate(-12 7 13)"
                    fill="#e7cda9" stroke="#2c1a0e" stroke-width="1.8"/>
              <line x1="4" y1="8" x2="12" y2="6" stroke="#4e3422" stroke-width="1.2"/>
              <line x1="5" y1="12" x2="13" y2="10" stroke="#4e3422" stroke-width="1.2"/>
              <path d="M 11 10 C 16 2, 23 -2, 25 -1 C 23 5, 18 9, 12 11 Z"
                    fill="#fdf9f0" stroke="#2c1a0e" stroke-width="1.4"/>
            </g>`;
        case "hourglass":
          return `
            <g transform="translate(75 52)">
              <rect x="2" y="2" width="16" height="2.8" rx="1" fill="#8b5a36" stroke="#2c1a0e" stroke-width="1.5"/>
              <rect x="2" y="22" width="16" height="2.8" rx="1" fill="#8b5a36" stroke="#2c1a0e" stroke-width="1.5"/>
              <path d="M 4 5 L 16 5 L 11 13 L 16 22 L 4 22 L 9 13 Z"
                    fill="#fdf9f0" stroke="#2c1a0e" stroke-width="1.6" stroke-linejoin="round"/>
              <polygon points="6,21 14,21 10,16" fill="#c99352"/>
              <polygon points="7,7 13,7 10,11" fill="#c99352"/>
            </g>`;
        case "loupe":
          return `
            <g transform="translate(74 53) rotate(-18)">
              <line x1="3" y1="20" x2="10" y2="13" stroke="#7c502b" stroke-width="3.6" stroke-linecap="round"/>
              <circle cx="15" cy="8" r="7.5" fill="#fdf9f0" stroke="#2c1a0e" stroke-width="2.2"/>
              <path d="M 11 6 A 5 5 0 0 1 17 4" fill="none" stroke="#c9b290" stroke-width="1.5" stroke-linecap="round"/>
            </g>`;
        case "watering":
          return `
            <g transform="translate(72 58)">
              <rect x="3" y="6" width="15" height="12" rx="2.5" fill="#d9c6a8" stroke="#2c1a0e" stroke-width="1.8"/>
              <path d="M 5 6 C 5 0, 15 0, 15 6" fill="none" stroke="#2c1a0e" stroke-width="1.8"/>
              <path d="M 18 13 L 26 7 L 28 10 L 18 16 Z" fill="#d9c6a8" stroke="#2c1a0e" stroke-width="1.6"/>
              <circle cx="29" cy="14" r="1.2" fill="#a86829"/>
              <circle cx="31" cy="18" r="1.2" fill="#a86829"/>
            </g>`;
        case "wrench":
        default:
          return `
            <g transform="translate(74 62) rotate(-26)">
              <rect x="0" y="5" width="16" height="4.4" rx="2" fill="#d9c6a8" stroke="#2c1a0e" stroke-width="1.8"/>
              <path d="M 14 2 C 20 1, 22 4, 22 7 C 22 10, 20 13, 14 12 L 17 9 L 17 5 Z"
                    fill="#d9c6a8" stroke="#2c1a0e" stroke-width="1.8" stroke-linejoin="round"/>
            </g>`;
      }
    }

    _buildOctetSVG(mood) {
      return `
        <svg class="octet-svg" viewBox="0 0 112 110" aria-hidden="true">
          <defs>
            <linearGradient id="octetFurGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#f7ebd6"/>
              <stop offset="100%" stop-color="#d8b992"/>
            </linearGradient>
            <linearGradient id="octetBagGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#b68352"/>
              <stop offset="100%" stop-color="#7c502b"/>
            </linearGradient>
          </defs>

          <ellipse cx="55" cy="103" rx="22" ry="4" fill="rgba(44,26,14,0.18)"/>

          <!-- UNE SEULE queue courbée -->
          <path class="octet-tail"
            d="M 38 86 C 14 92, 6 72, 16 56 C 21 48, 28 48, 25 54 C 19 64, 21 80, 38 82"
            fill="#e7cda9" stroke="#2c1a0e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>

          <g class="octet-paw-left">
            <path d="M 42 93 C 42 100, 48 102, 54 101 C 51 98, 49 95, 48 92 Z"
                  fill="#ebd4b3" stroke="#2c1a0e" stroke-width="2.2" stroke-linejoin="round"/>
          </g>
          <g class="octet-paw-right">
            <path d="M 59 93 C 60 100, 68 102, 74 100 C 70 97, 67 95, 65 92 Z"
                  fill="#ebd4b3" stroke="#2c1a0e" stroke-width="2.2" stroke-linejoin="round"/>
          </g>

          <g class="octet-body-group">
            <ellipse cx="70" cy="24" rx="10" ry="14" transform="rotate(14 70 24)"
                     fill="#f4e4c8" stroke="#2c1a0e" stroke-width="2.4"/>
            <ellipse cx="70" cy="25" rx="6" ry="9" transform="rotate(14 70 25)"
                     fill="#e3c59e" stroke="#4e3422" stroke-width="1.1"/>

            <path d="M 42 54 C 33 67, 34 90, 52 94 C 71 96, 78 82, 74 63 C 72 54, 64 49, 54 49 Z"
                  fill="url(#octetFurGrad)" stroke="#2c1a0e" stroke-width="2.5"/>

            <path d="M 41 72 L 47 75 M 40 77 L 47 80 M 43 83 L 49 85"
                  stroke="#4e3422" stroke-width="1.1" stroke-linecap="round" opacity="0.65"/>

            <path d="M 43 44 C 42 30, 56 23, 70 29 C 80 34, 87 43, 86 49 C 85 55, 76 58, 66 57 C 53 56, 44 52, 43 44 Z"
                  fill="url(#octetFurGrad)" stroke="#2c1a0e" stroke-width="2.5" stroke-linejoin="round"/>

            <!-- Oreille avant (STRICTEMENT AUCUN CRAYON DERRIÈRE) -->
            <ellipse cx="44" cy="29" rx="13" ry="15" transform="rotate(-24 44 29)"
                     fill="#f6e8cf" stroke="#2c1a0e" stroke-width="2.5"/>
            <ellipse cx="45" cy="30" rx="8" ry="10" transform="rotate(-24 45 30)"
                     fill="#e2c299" stroke="#4e3422" stroke-width="1.2"/>

            <circle cx="69" cy="45" r="3.7" fill="#2c1a0e"/>
            <circle cx="70.2" cy="43.8" r="1.2" fill="#fffdf8"/>
            <ellipse class="octet-eyelid" cx="69" cy="45" rx="4.2" ry="4.2" fill="#e6cca9"/>

            <!-- Lunettes rondes vintage (s'abaissent en action) -->
            <g class="octet-goggles">
              <path d="M 46 39 C 52 33, 62 29, 73 30" fill="none" stroke="#4e3422" stroke-width="4.2" stroke-linecap="round"/>
              <circle cx="59" cy="32" r="7.2" fill="#e9d8bd" stroke="#2c1a0e" stroke-width="2.4"/>
              <circle cx="59" cy="32" r="4.5" fill="#fdf9f0" stroke="#4e3422" stroke-width="1.1"/>
              <circle cx="72" cy="31" r="6.6" fill="#e9d8bd" stroke="#2c1a0e" stroke-width="2.4"/>
              <circle cx="72" cy="31" r="4.0" fill="#fdf9f0" stroke="#4e3422" stroke-width="1.1"/>
            </g>

            <ellipse cx="86" cy="48" rx="3" ry="2.2" fill="#8b5a36" stroke="#2c1a0e" stroke-width="1.6"/>
            <path d="M 74 53 Q 80 56 84 52" fill="none" stroke="#2c1a0e" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M 85 50 L 96 48 M 85 52 L 95 54" stroke="#2c1a0e" stroke-width="1.2" stroke-linecap="round"/>

            <!-- Besace en bandoulière -->
            <path d="M 70 57 L 48 76" stroke="#6d4423" stroke-width="3.6" stroke-linecap="round"/>
            <rect x="34" y="70" width="20" height="16" rx="4" transform="rotate(8 44 78)"
                  fill="url(#octetBagGrad)" stroke="#2c1a0e" stroke-width="2.1"/>
            <path d="M 35 74 L 53 77" stroke="#2c1a0e" stroke-width="1.8"/>
            <rect x="42" y="76" width="4" height="5" rx="1" fill="#e6c89a" stroke="#2c1a0e" stroke-width="1.3"/>

            <!-- Accessoire dynamique selon la section/état -->
            ${this._getAccessorySVG(mood)}

            <path d="M 65 64 C 71 66, 76 66, 79 63" fill="none" stroke="#2c1a0e" stroke-width="2.4" stroke-linecap="round"/>
          </g>
        </svg>
      `;
    }

    _dispo(m) { return this.available.has(FICHIERS[m]); }
    _resolveMoodForState(state) {
      const section = this.sectionMood || this.config.defaultMood;
      if (state === "PAUSED") return this._dispo("zen") ? "zen" : "hourglass";
      if (state === "DRAGGED") return this._dispo("surprise") ? "surprise" : (this._dispo("fall") ? "fall" : section);
      if (state === "WAKING" && this._dispo("stretch")) return "stretch";
      if (state === "SLEEPING") return this._dispo("sleep") ? "sleep" : "hourglass";
      if (state === "REPAIRING") return "wrench";
      if (state === "CELEBRATING") return this._dispo(this.celebMood) ? this.celebMood : "wrench";
      if (state === "MENU_OPEN") return this.menuMoodOverride || "compass";
      if (state === "JUMPING") {
        const j = this.jump;
        if (this.fallJump) return this._dispo(this.fallMood || "fall") ? (this.fallMood || "fall") : (this._dispo("fall") ? "fall" : section);
        if (j && j.startY - j.endY > 180 && this._dispo("climb")) return "climb";
        return this._dispo("jump") ? "jump" : section;
      }
      if (state === "WALKING_ON_TEXT") {
        // après 20 s sans activité, Octet marche sur la pointe des pieds pour ne pas déranger
        if (performance.now() - this.lastActivity > 20000 && this._dispo("tiptoe")) return "tiptoe";
        return this._dispo("walk") ? "walk" : section;
      }
      if (state === "LANDING" && this.landedFromFall) return this._dispo("slide") ? "slide" : section;
      return section;
    }

    _renderVisual(force = false) {
      if (!this.actorEl) return;
      const mood = this._resolveMoodForState(this.state);
      this.activeMood = mood;
      this.actorEl.dataset.mood = mood;
      this.moodPillEl.textContent = this.moodLabels[mood] || "Atelier";
      if (force) this.rigEl.dataset.mode = "";

      const sheetUrl = this._url(PLANCHE);
      if (sheetUrl && (this.state === "WALKING_ON_TEXT" || (this.state === "JUMPING" && !this.fallJump))) {
        const frameIdx = this.state === "JUMPING" ? 2 : this.sheetWalkIdx % 2;
        if (this.rigEl.dataset.mode !== "sheet") {
          this.rigEl.innerHTML = `<div class="octet-sheet"></div>`;
          this.rigEl.dataset.mode = "sheet";
        }
        const el = this.rigEl.firstElementChild;
        el.style.backgroundImage = `url("${sheetUrl}")`;
        el.style.backgroundSize = "300% 100%";
        el.style.backgroundPosition = `${frameIdx * 50}% 50%`;
        return;
      }

      const img = this._url(FICHIERS[mood]) || (this.rigEl.dataset.mode === "img" && !SVG_MOODS.includes(mood) ? this._url(FICHIERS[REPLI_SVG[mood] || "wrench"]) : null);
      if (img) {
        if (this.rigEl.dataset.mode !== "img" || this.rigEl.dataset.src !== img) {
          this.rigEl.innerHTML = `<img class="octet-sprite-img" src="${img}" alt="" draggable="false">`;
          this.rigEl.dataset.mode = "img";
          this.rigEl.dataset.src = img;
        }
        return;
      }
      const svgMood = SVG_MOODS.includes(mood) ? mood
        : REPLI_SVG[mood] || (SVG_MOODS.includes(this.sectionMood) ? this.sectionMood : "wrench");
      if (this.rigEl.dataset.mode !== "svg" || this.rigEl.dataset.mood !== svgMood) {
        this.rigEl.innerHTML = this._buildOctetSVG(svgMood);
        this.rigEl.dataset.mode = "svg";
        this.rigEl.dataset.mood = svgMood;
      }
    }

    _setState(next) {
      this.state = next;
      if (this.actorEl) this.actorEl.dataset.state = next;
      this._renderVisual();
    }

    /* -------------------------------------------------------------------------
       Détection des écritures et physique (base v2)
       ------------------------------------------------------------------------- */
    _isElementVisible(el) {
      if (!el || el.closest(this.config.ignoreSelector)) return false;
      const r0 = el.getBoundingClientRect();
      if (r0.bottom < 0 || r0.top > window.innerHeight || r0.width === 0) return false;
      const st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width >= this._getMetrics().minPlatformWidth && r.height >= 10;
    }

    _candidateElements() {
      if (this.config.selector !== "auto") return document.querySelectorAll(this.config.selector);
      // Parents des textes visibles à l'écran (titres de cartes, paragraphes, liens…)
      const set = new Set();
      const vh = window.innerHeight;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const v = node.nodeValue;
          if (!v || v.trim().length < 3) return NodeFilter.FILTER_REJECT;
          const p = node.parentElement;
          if (!p || p.closest("script, style, noscript, textarea, input, select, svg, #octet-stage, #octet-controls")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let tn;
      while ((tn = walker.nextNode())) {
        const p = tn.parentElement;
        if (set.has(p)) continue;
        const r = p.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        set.add(p);
      }
      return set;
    }

    _autoMood(el) {
      const list = this.config.autoMoods || ["wrench"];
      if (this.site === "eu") return this.config.defaultMood;
      const sec = el.closest("section, article, header, footer, main") || document.body;
      if (!this._moodCache) this._moodCache = new WeakMap();
      if (!this._moodCache.has(sec)) {
        const all = Array.from(document.querySelectorAll("section, article"));
        const idx = Math.max(0, all.indexOf(sec));
        this._moodCache.set(sec, list[idx % list.length]);
      }
      return this._moodCache.get(sec);
    }

    _extractLineRects(el) {
      const rects = [];
      if (el.matches("button, .btn, .eyebrow")) {
        const r = el.getBoundingClientRect();
        rects.push({ left: r.left + 6, right: r.right - 6, top: r.top, height: r.height });
        return rects;
      }

      const this_auto = this.config.selector === "auto";
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          if (node.parentElement !== el && (this_auto || node.parentElement.matches("button, .btn"))) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const range = document.createRange();
      let tn;
      while ((tn = walker.nextNode())) {
        range.selectNodeContents(tn);
        for (const cr of range.getClientRects()) {
          if (cr.width >= 10 && cr.height >= 8) {
            rects.push({ left: cr.left, right: cr.right, top: cr.top, height: cr.height });
          }
        }
      }
      range.detach?.();
      return rects;
    }

    _mergeLineRects(raw) {
      if (!raw.length) return [];
      const sorted = raw.slice().sort((a, b) => (Math.abs(a.top - b.top) > 6 ? a.top - b.top : a.left - b.left));
      const merged = [];
      for (const r of sorted) {
        const prev = merged[merged.length - 1];
        if (prev && Math.abs(prev.top - r.top) <= 6 && r.left <= prev.right + 28) {
          prev.left = Math.min(prev.left, r.left);
          prev.right = Math.max(prev.right, r.right);
          prev.top = Math.min(prev.top, r.top);
        } else {
          merged.push({ ...r });
        }
      }
      return merged;
    }

    scanPlatforms() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const m = this._getMetrics();
      const minY = this.config.topSafeMargin;
      const maxY = vh - this.config.bottomSafeMargin;

      const candidates = [];
      let uid = 0;

      for (const el of this._candidateElements()) {
        if (!this._isElementVisible(el)) continue;
        const moodHolder = el.closest("[data-octet-mood]");
        const mood = moodHolder ? moodHolder.getAttribute("data-octet-mood") : this._autoMood(el);

        for (const line of this._mergeLineRects(this._extractLineRects(el))) {
          const left = Math.max(m.sidePadding, line.left);
          const right = Math.min(vw - m.sidePadding, line.right);
          const width = right - left;
          if (width < m.minPlatformWidth || line.top < minY || line.top > maxY) continue;

          candidates.push({
            id: `p_${uid++}`,
            el,
            tag: el.tagName,
            big: parseFloat(getComputedStyle(el).fontSize) >= 18,
            mood,
            left,
            right,
            width,
            top: line.top
          });
        }
      }

      const deduped = [];
      for (const c of candidates) {
        const dup = deduped.find((d) => {
          if (Math.abs(d.top - c.top) > 8) return false;
          const overlap = Math.min(d.right, c.right) - Math.max(d.left, c.left);
          return overlap > Math.min(d.width, c.width) * 0.65;
        });
        if (!dup) deduped.push(c);
        else if (c.width > dup.width) Object.assign(dup, c);
      }

      this.platforms = deduped;

      if (this.currentPlatform && this.currentPlatform.el) {
        const match = deduped.find(
          (p) => p.el === this.currentPlatform.el && Math.abs(p.top - this.y) < 38
        );
        if (match) this.currentPlatform = match;
      }

      if (this.prefs.debug) this._renderDebugPlatforms();
    }

    _renderDebugPlatforms() {
      this.debugLayer.innerHTML = "";
      if (!this.prefs.debug) return;
      const frag = document.createDocumentFragment();
      for (const p of this.platforms) {
        const bar = document.createElement("div");
        bar.className = "octet-debug-plat";
        bar.style.left = `${p.left}px`;
        bar.style.top = `${p.top}px`;
        bar.style.width = `${p.width}px`;
        frag.appendChild(bar);
      }
      this.debugLayer.appendChild(frag);
    }

    _scheduleRescan(delay = 120) {
      clearTimeout(this.rescanTimer);
      this.rescanTimer = setTimeout(() => this.scanPlatforms(), delay);
    }

    /* -------------------------------------------------------------------------
       5. PHYSIQUE 2D & MACHINE À ÉTATS
       ------------------------------------------------------------------------- */
    _getFloorFallback() {
      return {
        id: "floor_virtual",
        el: null,
        tag: "FLOOR",
        mood: "compass",
        left: 36,
        right: Math.max(150, window.innerWidth - 150),
        width: Math.max(114, window.innerWidth - 186),
        top: window.innerHeight - 16
      };
    }

    _pickNextPlatform() {
      const list = this.platforms.filter((p) => p !== this.currentPlatform);
      if (!list.length) return this._getFloorFallback();

      const scored = list.map((p) => {
        const cx = (p.left + p.right) / 2;
        const dist = Math.hypot(cx - this.x, p.top - this.y);
        let weight = 1;
        if (dist >= 80 && dist <= 450) weight += 2.3;
        else if (dist < 80) weight += 0.6;
        else weight += 0.9;
        if (/^H[1-3]$/.test(p.tag) || p.big) weight += 1.4;
        if (p.id === this.lastPlatformId) weight *= 0.25;
        return { p, weight };
      });

      const total = scored.reduce((s, it) => s + it.weight, 0);
      let r = Math.random() * total;
      for (const it of scored) {
        r -= it.weight;
        if (r <= 0) return it.p;
      }
      return scored[0].p;
    }

    jumpTo(platform) {
      const pad = Math.min(22, platform.width * 0.25);
      const targetX = platform.left + pad + Math.random() * Math.max(1, platform.width - pad * 2);
      const targetY = platform.top;
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.hypot(dx, dy);

      this.facing = dx >= 0 ? 1 : -1;
      const upwardBoost = Math.max(0, this.y - targetY) * 0.35;
      const arcHeight = Math.max(56, Math.min(185, 50 + dist * 0.16 + upwardBoost));
      const duration = Math.max(0.42, Math.min(0.86, 0.34 + dist / 760));

      this.jump = {
        startX: this.x,
        startY: this.y,
        endX: targetX,
        endY: targetY,
        arcHeight,
        duration,
        elapsed: 0,
        targetPlatform: platform
      };

      this.stateTimer = 0.13;
      this._setState("ANTICIPATION");
    }

    _startWalkOnCurrentPlatform() {
      const p = this.currentPlatform;
      if (!p || p.width < 64) {
        this.stateTimer = 1.0 + Math.random() * 1.2;
        this._setState("IDLE");
        return;
      }

      const margin = Math.min(18, p.width * 0.22);
      const minX = p.left + margin;
      const maxX = p.right - margin;
      const distLeft = Math.abs(this.x - minX);
      const distRight = Math.abs(maxX - this.x);

      let targetX;
      if (distRight > distLeft && distRight > 30) {
        targetX = this.x + Math.min(distRight, 64 + Math.random() * 190);
      } else if (distLeft > 30) {
        targetX = this.x - Math.min(distLeft, 64 + Math.random() * 190);
      } else {
        targetX = Math.random() > 0.5 ? maxX : minX;
      }

      this.walkTargetX = Math.max(minX, Math.min(maxX, targetX));
      this.facing = this.walkTargetX >= this.x ? 1 : -1;
      this._setState("WALKING_ON_TEXT");
    }

    _spawnDust(x, y) {
      const dust = document.createElement("div");
      dust.className = "octet-dust";
      dust.style.left = `${x}px`;
      dust.style.top = `${y}px`;
      this.stageEl.appendChild(dust);
      setTimeout(() => dust.remove(), 380);
    }

    _plateformeDepuisRect(r, mood, id) {
      const vw = window.innerWidth, m = this._getMetrics();
      const left = Math.max(m.sidePadding, r.left), right = Math.min(vw - m.sidePadding, Math.max(r.right, r.left + 40));
      return { id, el: null, tag: "SPECIAL", mood, left, right, width: Math.max(40, right - left), top: Math.max(this.config.topSafeMargin, r.top) };
    }

    _tick(now) {
      if (this.destroyed) return;
      const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;
      if (!this.prefs.hidden) {
        this._updateFSM(dt, now);
        this._applyTransform();
      }
      this.rafId = requestAnimationFrame(this._bound.tick);
    }

    _updateFSM(dt, now) {
      this.scaleX += (1 - this.scaleX) * Math.min(1, dt * 14);
      this.scaleY += (1 - this.scaleY) * Math.min(1, dt * 14);
      this.tiltDeg += (0 - this.tiltDeg) * Math.min(1, dt * 12);

      // Module C : sieste après 35 s sans activité
      if (["IDLE", "WALKING_ON_TEXT", "LANDING"].includes(this.state) && now - this.lastActivity > SIESTE_MS) {
        this._setState("SLEEPING");
        return;
      }

      switch (this.state) {
        case "PAUSED":
        case "MENU_OPEN":
        case "SLEEPING":
        case "REPAIRING":
        case "DRAGGED":
          return;
        // CELEBRATING et WAKING sont gérés plus bas

        case "CELEBRATING": {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) { this.stateTimer = 0.6; this._setState("IDLE"); }
          return;
        }

        case "WAKING": {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) { this.stateTimer = 0.2; this._setState("IDLE"); }
          return;
        }

        case "IDLE": {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) {
            const canWalk = this.currentPlatform && this.currentPlatform.width >= 76;
            if (canWalk && Math.random() < 0.55) this._startWalkOnCurrentPlatform();
            else this.jumpTo(this._pickNextPlatform());
          }
          break;
        }

        case "WALKING_ON_TEXT": {
          const p = this.currentPlatform;
          if (!p) { this.jumpTo(this._pickNextPlatform()); return; }
          this.y = p.top;
          if (this.available.has(PLANCHE)) {
            this.sheetTimer += dt;
            if (this.sheetTimer >= 1 / 7) { this.sheetTimer = 0; this.sheetWalkIdx++; this._renderVisual(); }
          }
          const dx = this.walkTargetX - this.x;
          const step = this.config.walkSpeed * dt;
          if (Math.abs(dx) <= step) {
            this.x = this.walkTargetX;
            const r = Math.random();
            const act = r < 0.2 ? this._activite(p) : null;
            this.sectionMood = act || (r < 0.36 ? "loupe" : (p.mood || this.config.defaultMood));
            this.stateTimer = act ? 2.6 + Math.random() * 1.8 : 0.8 + Math.random() * 1.4;
            if (act === "flute") this.sound.playFlute();
            this._setState("IDLE");
          } else {
            this.facing = dx > 0 ? 1 : -1;
            this.x += Math.sign(dx) * step;
          }
          break;
        }

        case "ANTICIPATION": {
          this.scaleX = 1.14; this.scaleY = 0.84;
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) { this.scaleX = 0.88; this.scaleY = 1.16; this._setState("JUMPING"); }
          break;
        }

        case "JUMPING": {
          const j = this.jump;
          j.elapsed += dt;
          const t = Math.min(1, j.elapsed / j.duration);
          this.x = j.startX + (j.endX - j.startX) * t;
          this.y = j.startY + (j.endY - j.startY) * t - 4 * j.arcHeight * t * (1 - t);
          const vy = (j.endY - j.startY) - 4 * j.arcHeight * (1 - 2 * t);
          this.tiltDeg = Math.max(-14, Math.min(14, (vy / 520) * 10 * this.facing));
          if (this.fallJump) this.scaleY = Math.max(this.scaleY, 1.12);
          if (t >= 1) {
            this.x = j.endX; this.y = j.endY;
            this.lastPlatformId = this.currentPlatform ? this.currentPlatform.id : null;
            this.currentPlatform = j.targetPlatform;
            this.sectionMood = j.forceMood || j.targetPlatform.mood || this.config.defaultMood;
            this.landedFromFall = this.fallJump && this.fallMood !== "dandelion";
            this.fallJump = false;
            this.fallMood = null;
            this.scaleX = 1.18; this.scaleY = 0.80;
            this.stateTimer = this.landedFromFall ? 0.75 : 0.13;
            this._spawnDust(this.x, this.y);
            this.sound.playLand();
            const onLand = j.onLand;
            this.jump = null;
            this._setState("LANDING");
            if (onLand) onLand();
          }
          break;
        }

        case "LANDING": {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) {
            if (this.landedFromFall) { this.landedFromFall = false; this._renderVisual(); }
            if (this.holdAfterLanding) { this.holdAfterLanding = false; this.stateTimer = 3 + Math.random() * 2; this._setState("IDLE"); }
            else if (Math.random() < 0.72) this._startWalkOnCurrentPlatform();
            else { this.stateTimer = 0.9 + Math.random() * 1.1; this._setState("IDLE"); }
          }
          break;
        }
      }
    }

    _applyTransform() {
      const flip = this.facing * this.config.spriteDefaultFacing;
      this.actorEl.style.transform = `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0)`;
      this.rigEl.style.transform = `scaleX(${(flip * this.scaleX).toFixed(3)}) scaleY(${this.scaleY.toFixed(3)}) rotate(${this.tiltDeg.toFixed(1)}deg)`;
      if (this.pillEl) this._placerFlottant(this.pillEl, 0);
      if (this.toastEl) this._placerFlottant(this.toastEl, this.pillEl ? 38 : 0);
    }

    _placerFlottant(el, decalage) {
      const m = this._getMetrics();
      const x = Math.max(80, Math.min(window.innerWidth - 80, this.x));
      el.style.left = `${x}px`;
      el.style.top = `${Math.max(20, this.y - m.size - 6 - decalage)}px`;
    }

    /* -------------------------------------------------------------------------
       Module C — activité, sieste, réveil, chute douce
       ------------------------------------------------------------------------- */
    _onActivity(e) {
      this.lastActivity = performance.now();
      // L'AudioContext ne naît qu'au premier geste réel (règles d'autoplay des navigateurs)
      if (this.prefs.sound && !this.sound.ctx && e && (e.type === "pointerdown" || e.type === "keydown" || e.type === "click")) this.sound.activer(true);
      if (this.state === "SLEEPING") this._wake();
    }
    _onPointerMove(e) {
      const p = this.lastPointer;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 15) return;
      this._onActivity();
    }
    _wake() {
      this.scaleY = 1.22; this.scaleX = 0.9;
      this.stateTimer = this._dispo("stretch") ? 1.3 : 0.8;
      this._setState("WAKING");
    }

    /* -------------------------------------------------------------------------
       Module D — curiosité sur le texte surligné
       ------------------------------------------------------------------------- */
    _onSelection() {
      clearTimeout(this.selectionTimer);
      this.selectionTimer = setTimeout(() => this._examinerSelection(), 350);
    }
    _examinerSelection() {
      if (this.destroyed) return;
      const sel = window.getSelection();
      const texte = sel ? sel.toString().replace(/\s+/g, " ").trim() : "";
      if (!sel || sel.rangeCount === 0 || texte.length < 3 || texte.length > 500) { this.lastSelectionText = ""; return; }
      const noeud = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
      if (!noeud || noeud.closest("[data-octet-ignore], input, textarea, [contenteditable='true'], #octet-stage, #octet-controls")) return;
      this.lastSelectionText = texte;
      if (this.prefs.hidden || this.state === "PAUSED" || this.state === "MENU_OPEN" || this._enMission()) return;
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.bottom < this.config.topSafeMargin || r.top > window.innerHeight - 20 || r.width === 0) return;
      if (this.state === "SLEEPING") this._wake();
      this.holdAfterLanding = true;
      this.jumpTo(this._plateformeDepuisRect(r, "loupe", "selection"), { forceMood: "loupe" });
    }

    /* -------------------------------------------------------------------------
       Module B (Vitrine) — « concierge curieuse » sur les cartes [data-octet-card]
       ------------------------------------------------------------------------- */
    _cartesVues() { try { return JSON.parse(sessionStorage.getItem(CLE_CARTES) || "[]"); } catch { return []; } }
    _marquerCarte(id) {
      const vues = this._cartesVues();
      if (!vues.includes(id)) vues.push(id);
      try { sessionStorage.setItem(CLE_CARTES, JSON.stringify(vues)); } catch { /* ignoré */ }
    }
    _idCarte(card) {
      if (!card.dataset.octetCardId) {
        const t = card.querySelector("[data-octet-title], h2, h3");
        card.dataset.octetCardId = (card.id || (t ? t.textContent : card.dataset.octetSummary || "carte")).trim().slice(0, 60);
      }
      return card.dataset.octetCardId;
    }
    _scanCards() {
      if (this.site !== "fr") return;
      if (this.cardObserver) this.cardObserver.disconnect();
      this.cardObserver = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) this._armerCarte(e.target);
          else this._desarmerCarte(e.target);
        }
      }, { threshold: [0, 0.6] });
      document.querySelectorAll("[data-octet-card]").forEach((card) => {
        if (card.closest("[data-octet-ignore]")) return;
        this.cardObserver.observe(card);
        if (!card.dataset.octetBound) {
          card.dataset.octetBound = "1";
          card.addEventListener("mouseenter", this._bound.onCardEnter);
          card.addEventListener("mouseleave", this._bound.onCardLeave);
          card.addEventListener("focusin", this._bound.onCardEnter);
        }
      });
    }
    _onCardEnter(e) { this._armerCarte(e.currentTarget); }
    _onCardLeave(e) { this._desarmerCarte(e.currentTarget); }
    _armerCarte(card) {
      const id = this._idCarte(card);
      if (this.cardTimers.has(card) || this._cartesVues().includes(id)) return;
      this.cardTimers.set(card, this._later(() => { this.cardTimers.delete(card); this._visiterCarte(card); }, 6000));
    }
    _desarmerCarte(card) {
      const t = this.cardTimers.get(card);
      if (t) { clearTimeout(t); this.timers.delete(t); this.cardTimers.delete(card); }
    }
    _visiterCarte(card) {
      const id = this._idCarte(card);
      if (this._bloque() || this.state === "SLEEPING" || this._cartesVues().includes(id) || this.pillEl || this.visiteEnCours) return;
      const titre = card.querySelector("[data-octet-title], h2, h3") || card;
      const r = titre.getBoundingClientRect();
      if (r.bottom < this.config.topSafeMargin || r.top > window.innerHeight - 20) return;
      this._marquerCarte(id);
      this.visiteEnCours = true;
      this._later(() => { this.visiteEnCours = false; }, 4000);
      this.holdAfterLanding = true;
      const humeur = this._dispo("map") ? "map" : "compass";
      this.jumpTo(this._plateformeDepuisRect(r, humeur, `carte-${id}`), {
        forceMood: humeur,
        onLand: () => { this.visiteEnCours = false; this._montrerPastille(card); }
      });
    }
    _montrerPastille(card) {
      this._retirerPastille();
      const b = document.createElement("button");
      b.type = "button";
      b.className = "octet-pill";
      b.setAttribute("data-octet-ignore", "");
      const nom = (card.querySelector("[data-octet-title], h2, h3") || {}).textContent || "cette application";
      b.setAttribute("aria-label", `Voir ${nom.trim()} en 10 secondes`);
      b.textContent = "Voir en 10 s";
      b.addEventListener("click", (e) => { e.stopPropagation(); this._retirerPastille(); this.openMenu({ view: "card", card }); });
      document.body.appendChild(b);
      this.pillEl = b;
      this._placerFlottant(b, 0);
      this.pillTimer = this._later(() => this._retirerPastille(), 7000);
    }
    _retirerPastille() {
      if (this.pillEl) { this.pillEl.remove(); this.pillEl = null; }
      if (this.pillTimer) { clearTimeout(this.pillTimer); this.timers.delete(this.pillTimer); this.pillTimer = null; }
    }

    /* -------------------------------------------------------------------------
       Module G — « Les engrenages perdus »
       ------------------------------------------------------------------------- */
    _svgEngrenage() {
      return `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="#c99352" stroke="#2c1a0e" stroke-width="1.3" stroke-linejoin="round"
          d="M10.6 2h2.8l.5 2.6 1.9.8 2.2-1.5 2 2-1.5 2.2.8 1.9 2.6.5v2.8l-2.6.5-.8 1.9 1.5 2.2-2 2-2.2-1.5-1.9.8-.5 2.6h-2.8l-.5-2.6-1.9-.8-2.2 1.5-2-2 1.5-2.2-.8-1.9L2 13.4v-2.8l2.6-.5.8-1.9-1.5-2.2 2-2 2.2 1.5 1.9-.8z"/>
        <circle cx="12" cy="12" r="3.4" fill="#fdf9f0" stroke="#2c1a0e" stroke-width="1.3"/></svg>`;
    }
    _scanGears() {
      document.querySelectorAll("[data-octet-gear]").forEach((hote) => {
        const id = hote.getAttribute("data-octet-gear");
        if (!id || this.gears.ids.includes(id) || hote.querySelector(":scope > .octet-gear-btn")) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "octet-gear-btn";
        b.setAttribute("aria-label", "Ramasser un engrenage perdu pour Octet");
        b.dataset.gearId = id;
        b.innerHTML = this._svgEngrenage();
        b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); this._ramasser(b); });
        hote.appendChild(b);
        this.injectedGears.push(b);
      });
    }
    _ramasser(btn) {
      if (btn.dataset.busy) return;
      btn.dataset.busy = "1";
      if (this.state === "MENU_OPEN") this.closeMenu(false);
      if (this.prefs.hidden) { this.prefs.hidden = false; this._savePrefs(); this._syncControlButtons(); }
      const r = btn.getBoundingClientRect();
      this._later(() => { if (btn.isConnected && !btn.classList.contains("octet-gone")) delete btn.dataset.busy; }, 4000);
      const fin = () => this._reparer(btn);
      if (this._calme() || this.state === "PAUSED") {
        this.x = r.left + r.width / 2; this.y = r.top; fin(); return;
      }
      this.jumpTo(this._plateformeDepuisRect({ left: r.left - 10, right: r.right + 10, top: r.top }, "wrench", `gear-${btn.dataset.gearId}`), {
        forceMood: "wrench", big: true, exactX: r.left + r.width / 2, onLand: fin
      });
    }
    _reparer(btn) {
      const etatAvant = this.state === "PAUSED" ? "PAUSED" : null;
      this._setState("REPAIRING");
      this.sound.playWrench();
      this._etincelles(this.x + 14 * this.facing, this.y - 18);
      this._later(() => { this.sound.playWrench(); this._etincelles(this.x + 14 * this.facing, this.y - 16); }, 320);
      this._later(() => {
        btn.classList.add("octet-gone");
        const id = btn.dataset.gearId;
        if (!this.gears.ids.includes(id)) this.gears.ids.push(id);
        ecrireJSON(CLE_ENGRENAGES, this.gears);
        this._later(() => btn.remove(), 380);
        const n = Math.min(TOTAL_ENGRENAGES, this.gears.ids.length);
        this._toast(n >= TOTAL_ENGRENAGES ? `⚙️ ${n}/${TOTAL_ENGRENAGES} : collection complète ! Ouvrez mon carnet.` : `⚙️ Engrenage ${n}/${TOTAL_ENGRENAGES} rangé dans la besace !`);
        if (n >= TOTAL_ENGRENAGES) this._decouvrir("engrenages");
        this.celebMood = n >= TOTAL_ENGRENAGES ? "joy" : "carry";
        this.stateTimer = n >= TOTAL_ENGRENAGES ? 2.2 : 1.5;
        this._setState(etatAvant || "CELEBRATING");
      }, 650);
    }
    _etincelles(x, y) {
      if (this._calme()) return;
      for (let i = 0; i < 6; i++) {
        const s = document.createElement("div");
        s.className = "octet-spark";
        s.style.left = `${x}px`; s.style.top = `${y}px`;
        const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 14;
        s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
        s.style.setProperty("--dy", `${Math.sin(a) * d}px`);
        this.stageEl.appendChild(s);
        this._later(() => s.remove(), 450);
      }
    }
    _toast(texte) {
      if (this.toastEl) this.toastEl.remove();
      const t = document.createElement("div");
      t.className = "octet-toast";
      t.setAttribute("data-octet-ignore", "");
      t.setAttribute("role", "status");
      t.textContent = texte;
      document.body.appendChild(t);
      this.toastEl = t;
      this._placerFlottant(t, this.pillEl ? 38 : 0);
      this._later(() => { if (this.toastEl === t) { t.remove(); this.toastEl = null; } }, 3000);
    }
    _appliquerInventeur() {
      document.documentElement.classList.toggle("octet-inventor-mode", !!(this.gears.inventorMode && this.gears.ids.length >= TOTAL_ENGRENAGES));
    }
    _certificat(prenom) {
      const c = document.createElement("canvas");
      c.width = 1200; c.height = 850;
      const g = c.getContext("2d");
      const fond = g.createRadialGradient(600, 425, 100, 600, 425, 760);
      fond.addColorStop(0, "#fbf3e2"); fond.addColorStop(1, "#ead9b8");
      g.fillStyle = fond; g.fillRect(0, 0, 1200, 850);
      g.strokeStyle = "#2c1a0e"; g.lineWidth = 6; g.strokeRect(40, 40, 1120, 770);
      g.lineWidth = 2; g.strokeRect(58, 58, 1084, 734);
      g.strokeStyle = "rgba(125, 74, 24, 0.18)"; g.lineWidth = 1;
      for (let y = 90; y < 780; y += 26) { g.beginPath(); g.moveTo(80, y); g.lineTo(1120, y); g.stroke(); }
      g.fillStyle = "#2c1a0e"; g.textAlign = "center";
      g.font = "italic 30px Georgia, serif"; g.fillText("Atelier Alphabette", 600, 150);
      g.font = "bold 58px Georgia, serif"; g.fillText("Diplôme d'Apprenti Mécanicien", 600, 250);
      g.font = "26px Georgia, serif"; g.fillText("est décerné à", 600, 330);
      g.font = "bold 50px Georgia, serif"; g.fillText((prenom || "notre apprenti·e").slice(0, 40), 600, 410);
      g.font = "26px Georgia, serif";
      g.fillText("pour avoir retrouvé les cinq engrenages perdus d'Octet", 600, 480);
      g.fillText("et remis en marche les rouages de l'atelier.", 600, 520);
      const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      g.textAlign = "left"; g.font = "24px Georgia, serif"; g.fillText(`Le ${date}`, 130, 700);
      g.textAlign = "right"; g.font = "italic 40px Georgia, serif"; g.fillText("Octet", 1060, 690);
      g.beginPath(); g.moveTo(860, 705); g.lineTo(1070, 705); g.lineWidth = 2; g.strokeStyle = "#2c1a0e"; g.stroke();
      g.font = "18px Georgia, serif"; g.fillText("mécanicienne en chef", 1060, 732);
      // tampon engrenage
      g.save(); g.translate(600, 660); g.strokeStyle = "#8b2e1a"; g.fillStyle = "rgba(139, 46, 26, 0.10)"; g.lineWidth = 4;
      g.beginPath();
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 70 : 82; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.arc(0, 0, 50, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#8b2e1a"; g.textAlign = "center"; g.font = "bold 16px Georgia, serif";
      g.fillText("CERTIFIÉ", 0, -4); g.fillText("5 / 5", 0, 18); g.restore();
      c.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "certificat-octet-alphabette.png";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, "image/png");
    }

    /* -------------------------------------------------------------------------
       Module F — confort de lecture & voix Alphabette
       ------------------------------------------------------------------------- */
    _appliquerConfort() {
      const t = [100, 115, 130].includes(Number(this.confort.taille)) ? Number(this.confort.taille) : 100;
      document.documentElement.style.fontSize = t === 100 ? "" : `${t}%`;
      document.documentElement.classList.toggle("octet-high-contrast", !!this.confort.contraste);
    }
    _texteSection() {
      const p = this.currentPlatform && this.currentPlatform.el;
      const zone = (p && p.closest("section, article")) || document.querySelector("main") || document.body;
      const clone = zone.cloneNode(true);
      clone.querySelectorAll("script, style, nav, header, footer, [data-octet-ignore], .octet-gear-btn, [aria-hidden='true']").forEach((n) => n.remove());
      return clone.textContent.replace(/\s+/g, " ").trim().slice(0, 4000);
    }
    _voix() {
      return new Promise((resolve) => {
        if (window.alphabetteAudio) return resolve(window.alphabetteAudio);
        let s = document.querySelector("script[data-octet-voix]");
        if (!s) {
          s = document.createElement("script");
          s.src = "/assets/alphabette-audio.js";
          s.defer = true;
          s.dataset.octetVoix = "1";
          document.head.appendChild(s);
        }
        const fini = () => resolve(window.alphabetteAudio || null);
        window.addEventListener("alphabette:audio-pret", fini, { once: true });
        s.addEventListener("error", () => resolve(null), { once: true });
        setTimeout(fini, 4000);
      });
    }

    /* -------------------------------------------------------------------------
       Module B (Laboratoire) — rapport de souci / amélioration
       ------------------------------------------------------------------------- */
    _contexteTechnique() {
      const ua = navigator.userAgent;
      const versions = [[/Firefox\/(\d+)/, "Firefox"], [/Edg\/(\d+)/, "Edge"], [/Chrome\/(\d+)/, "Chrome"], [/Version\/(\d+).*Safari/, "Safari"]];
      const trouve = versions.map(([re, nom]) => { const m = re.exec(ua); return m ? `${nom} ${m[1]}` : null; }).find(Boolean);
      const nav = trouve || "Autre navigateur";
      const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
      const el = this.currentPlatform && this.currentPlatform.el;
      const sec = el && el.closest("section, article");
      const titre = sec && sec.querySelector("h1, h2, h3");
      return {
        url: location.origin + location.pathname,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        sectionTitle: titre ? titre.textContent.trim().slice(0, 120) : "",
        selectedText: this.lastSelectionText.slice(0, 500),
        userAgentShort: `${nav}${os ? " / " + os : ""}`,
        appName: this.config.appName
      };
    }
    _rapportTexte(type, message, c) {
      return [
        `Type : ${type === "bug" ? "Souci / bug" : "Proposition d'amélioration"}`,
        "", message, "",
        "--- Contexte technique (aucune donnée personnelle) ---",
        `Application : ${c.appName}`, `Page : ${c.url}`, `Écran : ${c.viewport}`,
        c.sectionTitle ? `Section : ${c.sectionTitle}` : "",
        c.selectedText ? `Passage cité : « ${c.selectedText} »` : "",
        `Navigateur : ${c.userAgentShort}`
      ].filter((l) => l !== null).join("\n");
    }

    /* -------------------------------------------------------------------------
       Bulle d'Octet (menu, vues)
       ------------------------------------------------------------------------- */
    _actionsParDefaut() {
      const commun = [
        { icon: "👁️", label: "Confort de lecture & voix", run: (api) => api.showComfortView() },
        { icon: "💡", label: "Lire une astuce", run: (api) => api.showTipView() },
        { icon: "🎩", label: "Mes petits secrets", run: () => this._vueDecouvertes() },
        { icon: "🐾", label: "Faire repartir Octet en balade", run: (api) => api.closeAndJumpNow() }
      ];
      if (this.site === "eu") {
        return [
          { icon: "🧪", label: "Signaler un souci / Proposer une amélioration", run: (api) => api.showFeedbackView() },
          ...commun.slice(0, 2),
          { icon: "⚙️", label: "Voir les applications", run: (api) => api.goTo(["#nos-applications", "#applications"], "https://alphabette.eu/") },
          commun[2]
        ];
      }
      return [
        { icon: "⚙️", label: "Voir les applications", run: (api) => api.goTo(["#nos-applications", "#applications"], "https://alphabette.fr/#nos-applications") },
        { icon: "🧪", label: "Visiter le Laboratoire (alphabette.eu)", run: () => { window.location.href = "https://alphabette.eu/"; } },
        { icon: "🪶", label: "Proposer une idée d'application", run: (api) => api.goTo(["#idees"], "https://alphabette.eu/#idees") },
        { icon: "📝", label: "Signaler un souci sur cette page", run: (api) => api.showFeedbackView() },
        ...commun
      ];
    }

    _createBubbleAPI() {
      const self = this;
      const panneau = (html) => { self.bubbleBody.innerHTML = html; self._majPied(); self._positionBubble(); };
      const retour = () => `<button type="button" class="bubble-mini-btn ghost" data-octet-back>← Menu</button>`;
      const lierRetour = () => { const b = self.bubbleBody.querySelector("[data-octet-back]"); if (b) b.addEventListener("click", () => api.showMainActions()); };
      const api = {
        scrollToAndPulse(selector) {
          const el = document.querySelector(selector);
          if (!el) return;
          el.scrollIntoView({ behavior: self._calme() ? "auto" : "smooth", block: "start" });
          el.classList.remove("octet-pulse"); void el.offsetWidth; el.classList.add("octet-pulse");
        },
        goTo(selectors, fallbackUrl) {
          const el = selectors.map((q) => document.querySelector(q)).find(Boolean);
          if (el && el.id) {
            api.scrollToAndPulse("#" + el.id); self.closeMenu(false);
            self.reagir("point", 1.3, "Par ici !", { force: true });
          }
          else window.location.href = fallbackUrl;
        },
        showMainActions() {
          self.menuMoodOverride = self.site === "eu" ? "flask" : "compass";
          self._renderVisual();
          self.bubbleTitle.textContent = "Coucou ! Je suis Octet";
          self.bubbleSub.textContent = self.site === "eu" ? "Éclaireuse du Laboratoire" : "Où allons-nous sur Alphabette ?";
          let html = "";
          if (self.lastSelectionText) {
            html += `<div class="octet-banner"><strong>Passage surligné</strong><q>${echapper(self.lastSelectionText.slice(0, 180))}</q>
              <div class="octet-row"><button type="button" class="bubble-mini-btn" data-sel-copy>Copier l'extrait</button>
              <button type="button" class="bubble-mini-btn ghost" data-sel-feedback>Envoyer un retour sur ce passage</button></div>
              <div class="octet-status" data-sel-status role="status"></div></div>`;
          }
          html += `<div class="bubble-actions"></div>`;
          panneau(html);
          const list = self.bubbleBody.querySelector(".bubble-actions");
          for (const act of (self.config.actions || self._actionsParDefaut())) {
            const btn = document.createElement(act.href ? "a" : "button");
            if (act.href) btn.href = act.href; else btn.type = "button";
            btn.className = "bubble-action-btn";
            btn.innerHTML = `<span aria-hidden="true">${echapper(act.icon || "•")}</span><span>${echapper(act.label)}</span>`;
            if (act.run) btn.addEventListener("click", () => act.run(api));
            list.appendChild(btn);
          }
          const copy = self.bubbleBody.querySelector("[data-sel-copy]");
          if (copy) {
            copy.addEventListener("click", async () => {
              const st = self.bubbleBody.querySelector("[data-sel-status]");
              try { await navigator.clipboard.writeText(self.lastSelectionText); st.textContent = "Extrait copié ✔"; }
              catch { st.textContent = "La copie n'est pas autorisée par ce navigateur."; }
            });
            self.bubbleBody.querySelector("[data-sel-feedback]").addEventListener("click", () => api.showFeedbackView({ citation: self.lastSelectionText }));
          }
        },
        showTipView() {
          self.menuMoodOverride = "loupe";
          self._renderVisual();
          const tip = self.config.tips[self.tipIndex % self.config.tips.length];
          self.tipIndex++;
          self.bubbleTitle.textContent = "Carnet d'atelier";
          self.bubbleSub.textContent = "Astuce";
          panneau(`<div class="bubble-panel"><div>${echapper(tip)}</div>
            <div class="bubble-panel-footer">${retour()}<button type="button" class="bubble-mini-btn" data-next>Autre astuce</button></div></div>`);
          lierRetour();
          self.bubbleBody.querySelector("[data-next]").addEventListener("click", () => api.showTipView());
        },
        showCardView(card) {
          self.menuMoodOverride = "compass";
          self._renderVisual();
          const titre = ((card.querySelector("[data-octet-title], h2, h3") || {}).textContent || "Application").trim();
          const resume = card.dataset.octetSummary || "";
          const url = card.dataset.octetUrl || (card.querySelector("a[href]") || {}).href || "";
          self.bubbleTitle.textContent = titre;
          self.bubbleSub.textContent = "En 10 secondes";
          panneau(`<div class="bubble-panel"><p style="margin:0">${echapper(resume || "Pas encore de résumé pour cette application.")}</p>
            <div class="bubble-panel-footer">${retour()}${url ? `<a class="bubble-mini-btn" href="${echapper(url)}">Ouvrir ${echapper(titre)}</a>` : ""}</div></div>`);
          lierRetour();
        },
        showFeedbackView(opts = {}) {
          self.menuMoodOverride = "notebook";
          self._renderVisual();
          const c = self._contexteTechnique();
          if (opts.citation) c.selectedText = opts.citation.slice(0, 500);
          self.bubbleTitle.textContent = "Signaler ou proposer";
          self.bubbleSub.textContent = `Retour sur ${c.appName}`;
          panneau(`<form class="bubble-panel" data-fb>
              <fieldset><legend>C'est…</legend>
                <label class="octet-choice"><input type="radio" name="octet-type" value="bug" checked> un souci</label>
                <label class="octet-choice"><input type="radio" name="octet-type" value="idee"> une amélioration</label>
              </fieldset>
              <label for="octet-fb-msg">Expliquez en quelques mots :</label>
              <textarea id="octet-fb-msg" required minlength="5" maxlength="2000" placeholder="Ex : le bouton « Écouter » ne répond pas sur mon téléphone…"></textarea>
              <details><summary>Informations jointes (aucune donnée personnelle)</summary><pre data-ctx></pre></details>
              <div class="bubble-panel-footer">${retour()}<button type="submit" class="bubble-mini-btn">${self.config.feedbackEndpoint ? "Envoyer" : "Préparer le rapport"}</button></div>
              <div class="octet-status" data-fb-status role="status"></div>
            </form>`);
          self.bubbleBody.querySelector("[data-ctx]").textContent = JSON.stringify(c, null, 2);
          lierRetour();
          const form = self.bubbleBody.querySelector("[data-fb]");
          const zone = form.querySelector("#octet-fb-msg");
          if (opts.citation) zone.value = `À propos du passage : « ${opts.citation.slice(0, 200)} »\n`;
          zone.focus();
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const message = zone.value.trim();
            const st = form.querySelector("[data-fb-status]");
            if (message.length < 5) { st.textContent = "Quelques mots de plus, s'il vous plaît."; return; }
            const type = form.querySelector("input[name='octet-type']:checked").value;
            const rapport = self._rapportTexte(type, message, c);
            if (self.config.feedbackEndpoint) {
              st.textContent = "Envoi…";
              try {
                const rep = await fetch(self.config.feedbackEndpoint, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type, message, context: c })
                });
                if (!rep.ok) throw new Error(String(rep.status));
                st.textContent = "Merci ! Votre retour a bien été reçu par l'atelier.";
                return;
              } catch {
                st.textContent = "L'envoi n'a pas abouti. Vous pouvez passer par GitHub ou copier le rapport :";
              }
            }
            api.showReportFallback(type, message, rapport, c, st.textContent);
          });
        },
        showReportFallback(type, message, rapport, c, note) {
          const titre = `[${c.appName}] ${type === "bug" ? "Souci" : "Idée"} : ${message.split("\n").pop().slice(0, 70)}`;
          const url = `${self.config.repoIssuesUrl}?title=${encodeURIComponent(titre)}&body=${encodeURIComponent(rapport)}`;
          panneau(`<div class="bubble-panel">
              <p style="margin:0 0 8px">${echapper(note || "Votre rapport est prêt. Rien n'a encore été envoyé : choisissez comment le transmettre.")}</p>
              <div class="octet-row">
                <a class="bubble-mini-btn" href="${echapper(url)}" target="_blank" rel="noopener">Ouvrir l'issue pré-remplie sur GitHub</a>
                <button type="button" class="bubble-mini-btn ghost" data-copy>Copier le rapport</button>
              </div>
              <div class="octet-status" data-st role="status"></div>
              <div class="bubble-panel-footer">${retour()}</div></div>`);
          lierRetour();
          self.bubbleBody.querySelector("a[href*='issues/new'], a[target='_blank']").addEventListener("click", () => {
            self._later(() => { self.closeMenu(false); self.reagir("plane", 2, "Votre message s'envole !", { force: true, id: "avion" }); }, 150);
          });
          self.bubbleBody.querySelector("[data-copy]").addEventListener("click", async () => {
            const st = self.bubbleBody.querySelector("[data-st]");
            try { await navigator.clipboard.writeText(rapport); st.textContent = "Rapport copié ✔ — collez-le où vous voulez (courriel, message…)."; }
            catch { st.textContent = "La copie n'est pas autorisée par ce navigateur."; }
          });
        },
        showComfortView() {
          self.menuMoodOverride = "loupe";
          self._renderVisual();
          self.bubbleTitle.textContent = "Confort de lecture";
          self.bubbleSub.textContent = "Réglages gardés sur cet appareil";
          const t = Number(self.confort.taille) || 100;
          const radio = (v, l) => `<label class="octet-choice"><input type="radio" name="octet-taille" value="${v}" ${t === v ? "checked" : ""}> ${l}</label>`;
          panneau(`<div class="bubble-panel">
              <fieldset><legend>Taille du texte</legend>${radio(100, "Normal")}${radio(115, "Grand")}${radio(130, "Très grand")}</fieldset>
              <label class="octet-choice"><input type="checkbox" data-contraste ${self.confort.contraste ? "checked" : ""}> Contraste renforcé</label>
              <fieldset style="margin-top:8px"><legend>Lecture à voix haute</legend>
                <div class="octet-row"><button type="button" class="bubble-mini-btn" data-ecouter>Écouter cette section</button>
                <button type="button" class="bubble-mini-btn ghost" data-stop>Arrêter</button></div>
                <div class="octet-status" data-voix role="status"></div>
              </fieldset>
              <div class="bubble-panel-footer">${retour()}</div></div>`);
          lierRetour();
          self.bubbleBody.querySelectorAll("input[name='octet-taille']").forEach((r) => r.addEventListener("change", () => {
            self.confort.taille = Number(r.value); ecrireJSON(CLE_CONFORT, self.confort); self._appliquerConfort(); self._scheduleRescan(200);
          }));
          self.bubbleBody.querySelector("[data-contraste]").addEventListener("change", (e) => {
            self.confort.contraste = e.target.checked; ecrireJSON(CLE_CONFORT, self.confort); self._appliquerConfort();
          });
          const st = self.bubbleBody.querySelector("[data-voix]");
          self.bubbleBody.querySelector("[data-ecouter]").addEventListener("click", async () => {
            st.textContent = "Préparation de la voix…";
            const voix = await self._voix();
            if (!voix) { st.textContent = "La voix n'est pas disponible sur cette page."; return; }
            const texte = self._texteSection();
            if (!texte) { st.textContent = "Rien à lire ici."; return; }
            voix.play(texte, "octet-voix");
            st.textContent = "Lecture en cours.";
          });
          self.bubbleBody.querySelector("[data-stop]").addEventListener("click", () => {
            if (window.alphabetteAudio) window.alphabetteAudio.stop();
            st.textContent = "Lecture arrêtée.";
          });
        },
        closeAndResume: () => self.closeMenu(false),
        closeAndJumpNow: () => self.closeMenu(true)
      };
      return api;
    }

    _majPied() {
      const n = Math.min(TOTAL_ENGRENAGES, this.gears.ids.length);
      let html = `<span>⚙️ ${n}/${TOTAL_ENGRENAGES}</span>`;
      if (n >= TOTAL_ENGRENAGES) {
        html += `<span class="octet-row">
          <label class="octet-choice"><input type="checkbox" data-inv ${this.gears.inventorMode ? "checked" : ""}> Carnet d'inventeur</label>
          <button type="button" class="bubble-mini-btn" data-cert>Mon certificat</button></span>`;
      } else if (n > 0) {
        html += `<span>Encore ${TOTAL_ENGRENAGES - n} à retrouver</span>`;
      }
      this.bubbleFoot.innerHTML = html;
      const inv = this.bubbleFoot.querySelector("[data-inv]");
      if (inv) inv.addEventListener("change", () => { this.gears.inventorMode = inv.checked; ecrireJSON(CLE_ENGRENAGES, this.gears); this._appliquerInventeur(); });
      const cert = this.bubbleFoot.querySelector("[data-cert]");
      if (cert) cert.addEventListener("click", () => this._vueCertificat());
    }
    _vueCertificat() {
      this.bubbleTitle.textContent = "Diplôme d'Apprenti Mécanicien";
      this.bubbleSub.textContent = "Fabriqué sur votre appareil, rien n'est envoyé";
      this.bubbleBody.innerHTML = `<form class="bubble-panel" data-cert-form>
          <label for="octet-prenom">Prénom à inscrire (facultatif) :</label>
          <input type="text" id="octet-prenom" maxlength="40" autocomplete="given-name">
          <div class="bubble-panel-footer"><button type="button" class="bubble-mini-btn ghost" data-octet-back>← Menu</button>
          <button type="submit" class="bubble-mini-btn">Télécharger (PNG)</button></div></form>`;
      this.bubbleBody.querySelector("[data-octet-back]").addEventListener("click", () => this._createBubbleAPI().showMainActions());
      this.bubbleBody.querySelector("[data-cert-form]").addEventListener("submit", (e) => {
        e.preventDefault();
        this._certificat(this.bubbleBody.querySelector("#octet-prenom").value.trim());
      });
      this._positionBubble();
    }

    openMenu(opts = {}) {
      if (this.state === "MENU_OPEN" && !opts.view) { this.closeMenu(false); return; }
      this._retirerPastille();
      if (this.repliqueEl) { this.repliqueEl.remove(); if (this.toastEl === this.repliqueEl) this.toastEl = null; this.repliqueEl = null; }
      if (this.state !== "MENU_OPEN") this.prevStateBeforeMenu = this.state === "PAUSED" ? "PAUSED" : "IDLE";
      if (this.state === "JUMPING" || this.state === "ANTICIPATION") {
        const j = this.jump;
        if (j) { this.x = j.endX; this.y = j.endY; this.currentPlatform = j.targetPlatform; this.jump = null; }
      }
      this._setState("MENU_OPEN");
      this.actorEl.setAttribute("aria-expanded", "true");
      this.bubbleEl.classList.add("open");
      this.sound.playPaper();
      const api = this._createBubbleAPI();
      if (opts.view === "card") api.showCardView(opts.card);
      else api.showMainActions();
      const premier = this.bubbleEl.querySelector("button, a[href], textarea, input");
      if (premier && opts.view !== "feedback") premier.focus({ preventScroll: true });
    }

    closeMenu(forceJump = false) {
      if (this.state !== "MENU_OPEN") return;
      this.menuMoodOverride = null;
      this.bubbleEl.classList.remove("open");
      this.actorEl.setAttribute("aria-expanded", "false");
      this.lastActivity = performance.now();
      if (this.prevStateBeforeMenu === "PAUSED" && !forceJump) { this._setState("PAUSED"); return; }
      this.prefs.paused = false;
      this._savePrefs();
      this._syncControlButtons();
      if (forceJump) this.jumpTo(this._pickNextPlatform());
      else { this.stateTimer = 0.65; this._setState("IDLE"); }
    }

    _positionBubble() {
      if (!this.bubbleEl.classList.contains("open")) return;
      const m = this._getMetrics();
      if (m.isBottomSheet) { this.bubbleEl.dataset.placement = "sheet"; return; }
      const pad = 12, vw = window.innerWidth, vh = window.innerHeight;
      const bw = this.bubbleEl.offsetWidth || 310, bh = this.bubbleEl.offsetHeight || 220;
      const placement = this.y - (m.size + 6) >= bh + pad ? "top" : "bottom";
      let top = placement === "top" ? this.y - m.size - bh - 14 : this.y + 14;
      let left = this.x - bw / 2;
      left = Math.max(pad, Math.min(vw - bw - pad, left));
      top = Math.max(pad, Math.min(vh - bh - pad, top));
      this.bubbleEl.dataset.placement = placement;
      this.bubbleEl.style.left = `${left.toFixed(0)}px`;
      this.bubbleEl.style.top = `${top.toFixed(0)}px`;
      this.bubbleArrow.style.left = `${Math.max(20, Math.min(bw - 32, this.x - left - 6)).toFixed(0)}px`;
    }

    /* -------------------------------------------------------------------------
       Module H — les petites folies d'Octet (réactions, secrets, saisons)
       Tout reste discret : une réaction à la fois, une réplique au plus toutes les 20 s
       (sauf quand c'est vous qui jouez avec elle), rien en Mode Calme ni en pause.
       ------------------------------------------------------------------------- */
    _peutReagir() {
      return !this.destroyed && !this.prefs.hidden && !this._calme() && this.actorEl &&
        !["PAUSED", "MENU_OPEN", "REPAIRING", "DRAGGED", "SLEEPING"].includes(this.state) && !this._enMission();
    }
    _decouvrir(id) {
      if (!DECOUVERTES[id] || this.secrets.ids.includes(id)) return;
      this.secrets.ids.push(id);
      ecrireJSON(CLE_SECRETS, this.secrets);
    }
    /** Pose une réaction (pose + réplique) pendant `duree` secondes. `force` : déclenchée par l'utilisateur. */
    reagir(mood, duree, replique, { force = false, id = null, son = null } = {}) {
      if (!this._peutReagir() || !this._dispo(mood)) return false;
      const now = performance.now();
      if (!force && now - this.derniereReplique < 20000) return false;
      if (this.jump && !this.jump.onLand) { this.x = this.jump.endX; this.y = this.jump.endY; this.currentPlatform = this.jump.targetPlatform; this.jump = null; }
      this.celebMood = mood;
      this.stateTimer = duree;
      this._setState("CELEBRATING");
      if (replique) { this._replique(replique); this.derniereReplique = now; }
      if (id) this._decouvrir(id);
      if (son && this.sound[son]) this.sound[son]();
      return true;
    }
    _replique(texte) {
      if (this.repliqueEl) this.repliqueEl.remove();
      const b = document.createElement("div");
      b.className = "octet-toast octet-quip";
      b.setAttribute("data-octet-ignore", "");
      b.setAttribute("aria-hidden", "true");
      b.textContent = texte;
      document.body.appendChild(b);
      this.repliqueEl = b;
      this.toastEl = b;
      this._placerFlottant(b, this.pillEl ? 38 : 0);
      this._later(() => { if (this.repliqueEl === b) { b.remove(); this.repliqueEl = null; if (this.toastEl === b) this.toastEl = null; } }, 2800);
    }

    /* Activités d'atelier quand Octet s'arrête sur un texte : selon l'heure, la saison, la page */
    _activite(p) {
      const h = new Date().getHours(), mois = new Date().getMonth() + 1, jour = new Date().getDate();
      const sombre = document.documentElement.dataset.theme === "dark" || document.documentElement.classList.contains("dark") ||
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const pool = ["hammer", "paint", "saw", "toolbox", "bigkey", "coil", "plan", "spyglass", "idea", "snack"];
      if (p && p.el && (p.el.textContent || "").length > 400) pool.push("book", "book");
      if (p && p.width < 110) pool.push("spool", "spool", "spool");
      if (this.prefs.sound) pool.push("flute");
      if (h >= 22 || h < 6) pool.push("candle", "candle", "stretch");
      else if (h < 10) pool.push("tea", "tea");
      if (sombre) pool.push("lantern", "lantern");
      if (mois >= 9 && mois <= 11) pool.push("acorns", "acorns");
      if (mois === 12 || mois <= 2) pool.push("scarf", "scarf");
      if (mois === 12 && jour >= 20) pool.push("gift");
      const dispo = pool.filter((m) => this._dispo(m));
      return dispo.length ? dispo[Math.floor(Math.random() * dispo.length)] : null;
    }

    /* Attraper Octet et le lancer */
    _onActorPointerDown(e) {
      if (e.button !== 0 || this.prefs.hidden || this.state === "MENU_OPEN") return;
      this.prise = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t: performance.now(), hist: [] };
    }
    _onActorPointerMove(e) {
      const pr = this.prise;
      if (!pr || pr.id !== e.pointerId) {
        // caresse : aller-retour rapide de la souris au-dessus d'Octet
        if (e.pointerType !== "mouse") return;
        const now = performance.now();
        const dir = Math.sign(e.movementX || 0);
        if (!dir) return;
        if (dir !== this.caresseDir) { this.caresse.push(now); this.caresseDir = dir; }
        this.caresse = this.caresse.filter((t) => now - t < 1200);
        if (this.caresse.length >= 6) {
          this.caresse = [];
          this.reagir("joy", 1.6, ["Hihi, ça chatouille !", "Encore ! Encore !", "Arrête, je suis chatouilleuse !"][Math.floor(Math.random() * 3)], { force: true, id: "chatouilles" });
        }
        return;
      }
      const now = performance.now();
      pr.hist.push({ x: e.clientX, y: e.clientY, t: now });
      while (pr.hist.length > 6) pr.hist.shift();
      if (!this.traine && Math.hypot(e.clientX - pr.x0, e.clientY - pr.y0) > 8 && !this._calme() && this.state !== "PAUSED") {
        this.traine = true;
        try { this.actorEl.setPointerCapture(e.pointerId); } catch { /* ignoré */ }
        this.jump = null;
        this.celebMood = "surprise";
        this._setState("DRAGGED");
        this._retirerPastille();
        this._decouvrir("attraper");
      }
      if (this.traine) {
        const m = this._getMetrics();
        this.x = e.clientX;
        this.y = e.clientY + m.size * 0.45;
        this.tiltDeg = Math.max(-18, Math.min(18, (e.movementX || 0) * 1.5));
      }
    }
    _onActorPointerUp(e) {
      const pr = this.prise;
      this.prise = null;
      if (!pr || !this.traine) return;
      this.traine = false;
      this.ignorerClic = true;
      setTimeout(() => { this.ignorerClic = false; }, 50);
      const h = pr.hist, a = h[0], b = h[h.length - 1];
      const vitesse = a && b && b.t > a.t ? Math.hypot(b.x - a.x, b.y - a.y) / ((b.t - a.t) / 1000) : 0;
      // texte le plus proche sous le point de lâcher
      this.scanPlatforms();
      const sous = this.platforms
        .filter((p) => p.left - 10 <= this.x && this.x <= p.right + 10 && p.top >= this.y - 4)
        .sort((p, q) => p.top - q.top)[0];
      const cible = sous || this._pickNextPlatform();
      this.fallJump = true;
      this.fallMood = "fall";
      this.jumpTo(cible, {
        onLand: () => {
          if (vitesse > 1400) this._later(() => this.reagir("dizzy", 1.8, "Quel vol… tout tourne !", { force: true, id: "lancer" }), 200);
        }
      });
      if (this.jump) {
        this.jump.arcHeight = Math.max(8, Math.min(60, vitesse / 40));
        this.jump.endX = Math.max(cible.left + 10, Math.min(cible.right - 10, this.x + Math.max(-120, Math.min(120, (b && a ? (b.x - a.x) : 0)))));
        this.jump.duration = Math.max(0.35, Math.min(0.9, Math.abs(cible.top - this.y) / 900 + 0.3));
        this.stateTimer = 0.01;
      }
    }

    /* Clics répétés : la tête lui tourne */
    _compterClics() {
      const now = performance.now();
      this.clics = (this.clics || []).filter((t) => now - t < 1600);
      this.clics.push(now);
      if (this.clics.length >= 5) {
        this.clics = [];
        if (this.state === "MENU_OPEN") this.closeMenu(false);
        this.reagir("dizzy", 2, "Ouh là… arrêtez de me cliquer, la tête me tourne !", { force: true, id: "tournis" });
        return true;
      }
      return false;
    }

    /* Code secret ↑ ↑ ↓ ↓ ← → ← → B A */
    _konami(e) {
      const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.konamiPos = k === code[this.konamiPos || 0] ? (this.konamiPos || 0) + 1 : (k === code[0] ? 1 : 0);
      if (this.konamiPos === code.length) {
        this.konamiPos = 0;
        if (this.state === "MENU_OPEN") this.closeMenu(false);
        if (this.reagir("bell", 1.2, "Ding ! Le code secret de l'atelier !", { force: true, id: "konami", son: "playBell" })) {
          this._later(() => { this.reagir("gift", 2.6, "Un cadeau pour vous : une pluie d'engrenages !", { force: true }); this._confettis(); }, 1250);
        }
      }
    }
    _confettis() {
      if (this._calme()) return;
      for (let i = 0; i < 36; i++) {
        const c = document.createElement("div");
        c.className = "octet-confetti";
        c.setAttribute("aria-hidden", "true");
        c.innerHTML = this._svgEngrenage();
        c.style.left = `${Math.random() * 100}vw`;
        c.style.setProperty("--d", `${2.2 + Math.random() * 2.2}s`);
        c.style.setProperty("--r", `${(Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540)}deg`);
        c.style.animationDelay = `${Math.random() * 0.8}s`;
        this.stageEl.appendChild(c);
        this._later(() => c.remove(), 5200);
      }
    }

    /* Événements de la page qui font réagir Octet */
    _onCopy(e) {
      if (e.target && e.target.closest && e.target.closest("#octet-stage")) return;
      this._later(() => this.reagir("thumb", 1.4, "Bien copié !", { id: "copie" }), 150);
    }
    _onReseau() {
      if (navigator.onLine) this.reagir("thumb", 1.6, "Le réseau est revenu !", { force: true, id: "reseau" });
      else this.reagir("umbrella", 3, "Plus de réseau… je m'abrite en attendant.", { force: true, id: "reseau" });
    }
    _onVisibilite() {
      if (document.hidden) { this.partiA = performance.now(); return; }
      if (this.partiA && performance.now() - this.partiA > 120000) {
        this.lastActivity = performance.now();
        if (this.state === "SLEEPING") this._wake();
        this._later(() => this.reagir("hello", 1.8, "Re-bonjour ! Je vous ai gardé la place.", { force: true, id: "retour" }), 900);
      }
      this.partiA = 0;
    }
    _onFocusChamp(e) {
      const c = e.target;
      if (!c || !c.matches || !c.matches("input[type='search'], input[type='text'], input:not([type]), textarea") || c.closest("#octet-stage, [data-octet-ignore]")) return;
      if (this.champsVus.has(c)) return;
      this.champsVus.add(c);
      this.reagir("idea", 1.6, "Une idée ? Je suis tout ouïe.", { id: "idee" });
    }
    _surveillerDefilement() {
      const bas = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 6;
      if (bas && !this.basAtteint && document.documentElement.scrollHeight > window.innerHeight * 1.6) {
        this.basAtteint = true;
        this._later(() => this.reagir("flag", 2.2, "Bout de la page atteint, bravo l'explorateur !", { id: "bout" }), 700);
      }
      if (window.scrollY > Math.max(900, window.innerHeight * 1.2)) this.etaitLoin = true;
      if (window.scrollY < 40 && this.etaitLoin) {
        this.etaitLoin = false;
        // après l'éventuelle descente en pissenlit
        this._later(() => this.reagir("rope", 1.8, "Hop, je remonte tout ça !", { id: "remonter" }), 1800);
      }
    }
    _onResizeFin() {
      const w = window.innerWidth;
      if (Math.abs(w - (this.largeurAvant || w)) > 80) this.reagir("push", 1.8, "Je pousse les murs, ne bougez pas !", { force: true, id: "murs" });
      this.largeurAvant = w;
    }
    _horloge() {
      const minutes = (performance.now() - this.debutVisite) / 60000;
      if (minutes >= 10 && !this.rappels.dix) {
        this.rappels.dix = true;
        this.reagir("watch", 2.6, "Déjà 10 minutes ici. Une petite pause pour les yeux ?", { id: "montre" });
      }
      if (minutes >= 25 && !this.rappels.the) {
        this.rappels.the = true;
        this.reagir("tea", 2.6, "Et si on faisait une pause thé ?", { id: "the" });
      }
    }
    _bonjourDuJour() {
      const auj = new Date().toISOString().slice(0, 10);
      const jour = new Date().getDate(), mois = new Date().getMonth() + 1;
      let dernier = "";
      try { dernier = localStorage.getItem(CLE_BONJOUR) || ""; } catch { /* ignoré */ }
      if (dernier === auj) return;
      try { localStorage.setItem(CLE_BONJOUR, auj); } catch { /* ignoré */ }
      const h = new Date().getHours();
      let texte = h < 12 ? "Bonjour ! Belle matinée à l'atelier." : h < 18 ? "Bonjour ! Bienvenue à l'atelier." : "Bonsoir ! L'atelier est encore ouvert.";
      let mood = "hello";
      if (mois === 1 && jour === 1) { texte = "Bonne année ! Que vos idées tournent rond."; mood = "flag"; }
      else if (mois === 12 && jour >= 24 && jour <= 26) { texte = "Joyeuses fêtes ! J'ai un petit paquet pour vous."; mood = "gift"; }
      else if (mois === 4 && jour === 1) texte = "Bonjour ! Vérifiez votre dos… (c'est le 1er avril)";
      this._later(() => this.reagir(mood, 2.2, texte, { force: true, id: "bonjour" }), 1800);
    }

    _vueDecouvertes() {
      const api = this._createBubbleAPI();
      this.menuMoodOverride = "spyglass";
      this._renderVisual();
      const ids = Object.keys(DECOUVERTES);
      const n = ids.filter((id) => this.secrets.ids.includes(id)).length;
      this.bubbleTitle.textContent = "Mes petits secrets";
      this.bubbleSub.textContent = `${n} découverte${n > 1 ? "s" : ""} sur ${ids.length}`;
      this.bubbleBody.innerHTML = `<div class="bubble-panel"><ul class="octet-secrets">${ids.map((id) => {
        const ok = this.secrets.ids.includes(id);
        return `<li class="${ok ? "ok" : ""}"><span aria-hidden="true">${ok ? "✔" : "?"}</span> ${echapper(ok ? DECOUVERTES[id][0] : DECOUVERTES[id][1])}</li>`;
      }).join("")}</ul>
        <div class="bubble-panel-footer"><button type="button" class="bubble-mini-btn ghost" data-octet-back>← Menu</button></div></div>`;
      this.bubbleBody.querySelector("[data-octet-back]").addEventListener("click", () => api.showMainActions());
      this._positionBubble();
    }

    /* -------------------------------------------------------------------------
       Événements, contrôles, nettoyage
       ------------------------------------------------------------------------- */
    _syncControlButtons() {
      this.btnPause.setAttribute("aria-pressed", String(this.prefs.paused));
      this.btnPause.textContent = this.prefs.paused ? "Reprendre" : "Pause";
      this.btnHide.setAttribute("aria-pressed", String(this.prefs.hidden));
      this.btnHide.textContent = this.prefs.hidden ? "Afficher" : "Masquer";
      this.actorEl.classList.toggle("hidden-mascot", this.prefs.hidden);
      this.btnSound.setAttribute("aria-pressed", String(this.prefs.sound));
      this.btnSound.textContent = this.prefs.sound ? "🔊" : "🔇";
      this.btnSound.setAttribute("aria-label", this.prefs.sound ? "Couper les sons d'Octet" : "Activer les sons d'Octet");
      this.debugLayer.classList.toggle("visible", !!this.prefs.debug);
    }

    _onScroll() {
      const dy = this.lastScrollY - window.scrollY;
      this.lastScrollY = window.scrollY;
      const now = performance.now();
      this.scrollHistory.push({ t: now, dy });
      while (this.scrollHistory.length && now - this.scrollHistory[0].t > 180) this.scrollHistory.shift();
      const rapide = Math.abs(this.scrollHistory.reduce((s, h) => s + h.dy, 0)) > 420;
      this._onActivity();

      this.y += dy;
      if (this.jump) { this.jump.startY += dy; this.jump.endY += dy; }
      // le texte sous ses pattes a bougé avec la page (sauf le « sol » virtuel, fixe à l'écran)
      if (this.currentPlatform && this.currentPlatform.tag !== "FLOOR") this.currentPlatform.top += dy;
      const cible = this.jump && this.jump.targetPlatform;
      if (cible && cible !== this.currentPlatform && cible.tag !== "FLOOR") cible.top += dy;
      if (this.state === "MENU_OPEN") {
        this.y = Math.max(this.config.topSafeMargin, Math.min(window.innerHeight - 28, this.y));
        this._positionBubble();
      }
      this._retirerPastille();
      if (!this.scrollRaf) {
        this.scrollRaf = requestAnimationFrame(() => {
          this.scrollRaf = null;
          this.scanPlatforms();
          this._scanGears();
          this._surveillerDefilement();
          const mission = this.jump && (this.jump.onLand || this.jump.forceMood);
          if (!mission && !["MENU_OPEN", "PAUSED", "JUMPING", "REPAIRING"].includes(this.state) &&
              (this.y < this.config.topSafeMargin - 10 || this.y > window.innerHeight - 10)) {
            this.y = Math.max(this.config.topSafeMargin, Math.min(window.innerHeight - 20, this.y));
            this.fallJump = rapide && !this._calme();
            const versLeHaut = this.scrollHistory.reduce((t, h) => t + h.dy, 0) > 0;
            this.fallMood = this.fallJump && versLeHaut && this._dispo("dandelion") ? "dandelion" : "fall";
            this.jumpTo(this._pickNextPlatform());
            if (this.fallMood === "dandelion" && this.jump) {
              this.jump.duration = 1.5; this.jump.arcHeight = 20; this._decouvrir("pissenlit");
            }
          }
        });
      }
    }

    _onResize() {
      this._scheduleRescan(90);
      clearTimeout(this.resizeFinTimer);
      this.resizeFinTimer = setTimeout(() => { if (!this.destroyed) this._onResizeFin(); }, 450);
      this.x = Math.max(30, Math.min(window.innerWidth - 30, this.x));
      if (this.state === "MENU_OPEN") this._positionBubble();
    }
    _onDocClick(e) {
      this._onActivity(e);
      // composedPath : le bouton cliqué peut avoir été remplacé pendant le clic (changement de vue du carnet)
      const chemin = e.composedPath ? e.composedPath() : [e.target];
      const dedans = chemin.includes(this.bubbleEl) || chemin.includes(this.actorEl) || (e.target && !e.target.isConnected);
      if (this.state === "MENU_OPEN" && !dedans) this.closeMenu(false);
    }
    _onKeyDown(e) {
      this._onActivity(e);
      if (!e.target.closest || !e.target.closest("input, textarea, [contenteditable='true']")) this._konami(e);
      if (e.key === "Escape" && this.state === "MENU_OPEN") { this.closeMenu(false); this.actorEl.focus(); }
    }
    _onReducedMotionChange(e) {
      if (e.matches && this.state !== "MENU_OPEN") {
        this.prefs.paused = true;
        this._syncControlButtons();
        this._setState("PAUSED");
      }
    }

    _bindEvents() {
      this.actorEl.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.ignorerClic) return;
        const dormait = this.state === "SLEEPING";
        this._onActivity(e);
        if (this._compterClics()) return;
        if (dormait) {
          this._replique("Hein ? Je ne dormais pas, je réfléchissais !");
          this.derniereReplique = performance.now();
          this._decouvrir("reveil");
          return;
        }
        this.openMenu();
      });
      this.actorEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.reagir("shrug", 2.2, "Pas de menu secret ici… quoique : ↑ ↑ ↓ ↓ ← → ← → B A", { force: true, id: "clicdroit" });
      });
      this.actorEl.addEventListener("pointerdown", this._bound.onActorDown);
      this.actorEl.addEventListener("pointermove", this._bound.onActorMove);
      this.actorEl.addEventListener("pointerup", this._bound.onActorUp);
      this.actorEl.addEventListener("pointercancel", this._bound.onActorUp);
      this.btnClose.addEventListener("click", () => { this.closeMenu(false); this.actorEl.focus(); });
      this.btnPause.addEventListener("click", () => {
        if (this.state === "MENU_OPEN") this.closeMenu(false);
        this.prefs.paused = !this.prefs.paused;
        this._savePrefs(); this._syncControlButtons();
        if (this.prefs.paused) this._setState("PAUSED");
        else { this.lastActivity = performance.now(); this.stateTimer = 0.25; this._setState("IDLE"); }
      });
      this.btnHide.addEventListener("click", () => {
        this.prefs.hidden = !this.prefs.hidden;
        if (this.prefs.hidden && this.state === "MENU_OPEN") this.closeMenu(false);
        if (this.prefs.hidden) this._retirerPastille();
        this._savePrefs(); this._syncControlButtons();
        if (!this.prefs.hidden) this._later(() => this.reagir("peek", 1.8, "Coucou, c'est re-moi !", { force: true, id: "cachecache" }), 100);
      });
      this.btnSound.addEventListener("click", () => {
        this.prefs.sound = !this.prefs.sound;
        this.sound.activer(this.prefs.sound);
        this._savePrefs(); this._syncControlButtons();
        if (this.prefs.sound) this.sound.playPaper();
      });

      const passif = { passive: true };
      window.addEventListener("scroll", this._bound.onScroll, passif);
      window.addEventListener("resize", this._bound.onResize);
      window.addEventListener("pointermove", this._bound.onPointerMove, passif);
      window.addEventListener("pointerdown", this._bound.onActivity, passif);
      window.addEventListener("touchstart", this._bound.onActivity, passif);
      document.addEventListener("click", this._bound.onDocClick);
      document.addEventListener("keydown", this._bound.onKeyDown);
      document.addEventListener("selectionchange", this._bound.onSelection);
      this.reducedMotionQuery.addEventListener?.("change", this._bound.onReducedMotionChange);
      document.addEventListener("copy", this._bound.onCopy);
      document.addEventListener("visibilitychange", this._bound.onVisibilite);
      document.addEventListener("focusin", this._bound.onFocusChamp);
      window.addEventListener("online", this._bound.onReseau);
      window.addEventListener("offline", this._bound.onReseau);
      this.horlogeId = setInterval(() => this._horloge(), 30000);

      this.mutationObserver = new MutationObserver((muts) => {
        if (muts.every((m) => this.stageEl.contains(m.target) || this.controlsEl.contains(m.target) || this.debugLayer.contains(m.target) ||
          (m.target.classList && (m.target.classList.contains("octet-gear-btn") || m.target.classList.contains("octet-toast") || m.target.classList.contains("octet-pill"))))) return;
        this._scheduleRescan(180);
        clearTimeout(this.structTimer);
        this.structTimer = setTimeout(() => { if (!this.destroyed) { this._scanGears(); this._scanCards(); } }, 400);
      });
      this.mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
      this.resizeObserver = new ResizeObserver(() => this._scheduleRescan(150));
      this.resizeObserver.observe(document.body);
    }

    _initPositionAndState() {
      this.scanPlatforms();
      const startPlat = this.platforms.find((p) => p.tag === "H1") || this.platforms[0] || this._getFloorFallback();
      this.currentPlatform = startPlat;
      this.sectionMood = startPlat.mood || this.config.defaultMood;
      this.x = startPlat.left + Math.min(76, startPlat.width * 0.35);
      this.y = startPlat.top;
      if (this._calme()) this.prefs.paused = true;
      this._syncControlButtons();
      if (this.prefs.paused) this._setState("PAUSED");
      else { this.stateTimer = 0.9; this._setState("IDLE"); }
      this._applyTransform();
      this.rafId = requestAnimationFrame(this._bound.tick);
    }

    destroy() {
      this.destroyed = true;
      cancelAnimationFrame(this.rafId);
      cancelAnimationFrame(this.scrollRaf);
      clearTimeout(this.rescanTimer); clearTimeout(this.selectionTimer); clearTimeout(this.structTimer);
      if (this.idleId && window.cancelIdleCallback) window.cancelIdleCallback(this.idleId);
      this.timers.forEach((t) => clearTimeout(t)); this.timers.clear();
      window.removeEventListener("scroll", this._bound.onScroll);
      window.removeEventListener("resize", this._bound.onResize);
      window.removeEventListener("pointermove", this._bound.onPointerMove);
      window.removeEventListener("pointerdown", this._bound.onActivity);
      window.removeEventListener("touchstart", this._bound.onActivity);
      document.removeEventListener("click", this._bound.onDocClick);
      document.removeEventListener("keydown", this._bound.onKeyDown);
      document.removeEventListener("selectionchange", this._bound.onSelection);
      document.removeEventListener("copy", this._bound.onCopy);
      document.removeEventListener("visibilitychange", this._bound.onVisibilite);
      document.removeEventListener("focusin", this._bound.onFocusChamp);
      window.removeEventListener("online", this._bound.onReseau);
      window.removeEventListener("offline", this._bound.onReseau);
      clearInterval(this.horlogeId);
      clearTimeout(this.resizeFinTimer);
      this.repliqueEl?.remove();
      this.reducedMotionQuery.removeEventListener?.("change", this._bound.onReducedMotionChange);
      this.mutationObserver?.disconnect();
      this.resizeObserver?.disconnect();
      this.cardObserver?.disconnect();
      document.querySelectorAll("[data-octet-bound]").forEach((card) => {
        card.removeEventListener("mouseenter", this._bound.onCardEnter);
        card.removeEventListener("mouseleave", this._bound.onCardLeave);
        card.removeEventListener("focusin", this._bound.onCardEnter);
        delete card.dataset.octetBound;
      });
      this.injectedGears.forEach((b) => b.remove());
      this.injectedGears = [];
      this._retirerPastille();
      this.toastEl?.remove();
      this.sound.fermer();
      this.stageEl?.remove(); this.debugLayer?.remove(); this.controlsEl?.remove();
      document.getElementById(OctetEngine.STYLE_ID)?.remove();
      if (window.octet === this) window.octet = null;
    }
  }

  // jumpTo accepte des options (humeur forcée, rappel à l'atterrissage, point d'arrivée exact)
  const jumpToBase = OctetEngine.prototype.jumpTo;
  OctetEngine.prototype.jumpTo = function (platform, opts = {}) {
    jumpToBase.call(this, platform);
    if (opts.exactX != null && this.jump) this.jump.endX = opts.exactX;
    if (opts.big && this.jump) { this.jump.arcHeight = Math.max(this.jump.arcHeight, 150); this.jump.duration = Math.max(this.jump.duration, 0.75); }
    if (this.jump) { this.jump.forceMood = opts.forceMood || null; this.jump.onLand = opts.onLand || null; }
  };

  window.OctetEngine = OctetEngine;
  window.OctetSoundEngine = OctetSoundEngine;
  const lancer = () => { if (!window.octet && document.body) window.octet = new OctetEngine(); };
  if (SCRIPT && SCRIPT.hasAttribute("data-no-autostart")) return;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lancer);
  else lancer();
})();
