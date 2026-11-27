/* Octet en balade — la souris mécanicienne d'Alphabette se promène sur les titres et paragraphes.
   Source : public/assets/octet-balade.js (chargé par index.html). Pause / Masquer mémorisés dans le navigateur.
   Mode Calme du site ou « réduire les animations » du téléphone : Octet reste immobile. */
(function () {
  if (window.octet || window.self !== window.top) return;
  class OctetEngine {
    static STYLE_ID = "octet-engine-v2-styles";

    constructor(userConfig = {}) {
      this.config = {
        storageKey: "alphabette_octet_pref",
        selector: "auto", // "auto" = tout texte visible ; sinon un sélecteur CSS (ex. "h1, h2, p")
        // Zones où Octet ne se pose jamais (double barre, menus, fenêtres)
        ignoreSelector: "[data-octet-ignore], header, nav, dialog, [role='dialog'], [aria-modal='true'], .ab-barre, .ab-shell-bar",
        // Accessoires tirés au sort par section quand une section n'a pas de data-octet-mood
        autoMoods: ["compass", "wrench", "notebook", "watering", "flask"],
        walkSpeed: 74,
        topSafeMargin: 112, // sous la double barre Alphabette
        bottomSafeMargin: 22,
        spriteDefaultFacing: 1, // 1 = vos images regardent à droite, -1 = à gauche

        // Option A : Spritesheet horizontale 3 poses (marche G, marche D, saut)
        // Passez l'URL de votre WebP détouré pour l'activer automatiquement :
        spritesheet: {
          url: null,       // ex: "/assets/octet-spritesheet.webp"
          frames: 3,
          walkFrames: [0, 1],
          jumpFrame: 2,
          fps: 7
        },

        // Option B : Visuels dédiés par ambiance/section (WebP transparents)
        moodSprites: {
          wrench: "/assets/octet/balade/octet-wrench.webp",
          flask: "/assets/octet/balade/octet-flask.webp",
          compass: "/assets/octet/balade/octet-compass.webp",
          notebook: "/assets/octet/balade/octet-notebook.webp",
          hourglass: "/assets/octet/balade/octet-hourglass.webp",
          loupe: "/assets/octet/balade/octet-loupe.webp",
          watering: "/assets/octet/balade/octet-watering.webp"
        },

        tips: [
          "Je change d'objet selon l'endroit de la page où je me pose : boussole, clé, carnet, arrosoir, fiole…",
          "Je vous gêne ? Le bouton « Pause » en bas à droite m'arrête, « Masquer » me cache. Je m'en souviens à votre prochaine visite.",
          "Raccourci : la touche Échap ferme ce carnet.",
          "Vous avez une idée d'application ? La boîte à idées du Laboratoire est ouverte à tous, sans compte."
        ],

        actions: [
          {
            id: "apps",
            icon: "⚙️",
            label: "Voir les applications",
            run: (api) => api.goTo(["#nos-applications", "#applications"], "https://alphabette.fr/#nos-applications")
          },
          {
            id: "labo",
            icon: "🧪",
            label: "Visiter le Laboratoire (alphabette.eu)",
            run: () => { window.location.href = "https://alphabette.eu/"; }
          },
          {
            id: "idea",
            icon: "🪶",
            label: "Proposer une idée d'application",
            run: (api) => api.goTo(["#idees"], "https://alphabette.eu/#idees")
          },
          {
            id: "tip",
            icon: "💡",
            label: "Lire une astuce",
            run: (api) => api.showTipView()
          },
          {
            id: "roam",
            icon: "🐾",
            label: "Faire repartir Octet en balade",
            run: (api) => api.closeAndJumpNow()
          }
        ],

        ...userConfig
      };

      this.moodLabels = {
        compass: "Boussole",
        wrench: "Clé à molette",
        flask: "Fiole labo",
        notebook: "Carnet",
        hourglass: "Sablier",
        loupe: "Loupe",
        watering: "Arrosoir"
      };

      this.reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.prefs = this._loadPrefs();

      this.state = "IDLE";
      this.prevStateBeforeMenu = "IDLE";
      this.activeMood = "compass";
      this.sectionMood = "compass";

      this.x = 120;
      this.y = 200;
      this.facing = 1;
      this.scaleX = 1;
      this.scaleY = 1;
      this.tiltDeg = 0;

      this.platforms = [];
      this.currentPlatform = null;
      this.lastPlatformId = null;
      this.walkTargetX = 120;
      this.stateTimer = 0;
      this.jump = null;

      this.sheetTimer = 0;
      this.sheetWalkIdx = 0;
      this.tipIndex = 0;
      this.lastScrollY = window.scrollY;
      this.lastFrameTime = performance.now();

      this.rafId = null;
      this.scrollRaf = null;
      this.rescanTimer = null;
      this.destroyed = false;

      // Références liées pour un destroy() parfaitement propre
      this._bound = {
        tick: this._tick.bind(this),
        onScroll: this._onScroll.bind(this),
        onResize: this._onResize.bind(this),
        onDocClick: this._onDocClick.bind(this),
        onKeyDown: this._onKeyDown.bind(this),
        onReducedMotionChange: this._onReducedMotionChange.bind(this)
      };

      // Préchargement des visuels (aucun clignotement au changement d'accessoire)
      this._preloaded = Object.values(this.config.moodSprites || {}).filter(Boolean).map((u) => {
        const im = new Image(); im.decoding = "async"; im.src = u; return im;
      });

      this._injectStyles();
      this._mountDOM();
      this._bindEvents();
      this._initPositionAndState();
    }

    /* -------------------------------------------------------------------------
       1. PRÉFÉRENCES LOCALSTORAGE & RESPONSIVE
       ------------------------------------------------------------------------- */
    _loadPrefs() {
      const defaults = { paused: false, hidden: false, debug: false };
      try {
        const raw = localStorage.getItem(this.config.storageKey);
        if (!raw) return defaults;
        return { ...defaults, ...JSON.parse(raw) };
      } catch {
        return defaults;
      }
    }

    _savePrefs() {
      try {
        localStorage.setItem(this.config.storageKey, JSON.stringify(this.prefs));
      } catch {
        // Ignorer en navigation privée stricte
      }
    }

    _getMetrics() {
      const vw = window.innerWidth;
      const isCompact = vw < 640;
      const isBottomSheet = vw < 420;
      return {
        size: isCompact ? 64 : 84,
        minPlatformWidth: isCompact ? 44 : 56,
        sidePadding: isCompact ? 14 : 24,
        isCompact,
        isBottomSheet
      };
    }

    /* -------------------------------------------------------------------------
       2. STYLES SCOPÉS & MONTAGE DOM
       ------------------------------------------------------------------------- */
    _injectStyles() {
      if (document.getElementById(OctetEngine.STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = OctetEngine.STYLE_ID;
      style.textContent = `
        :root { --octet-size: 84px; }
        @media (max-width: 639px) { :root { --octet-size: 64px; } }

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
        <button id="octet-actor" type="button" data-state="IDLE" data-mood="compass"
          aria-label="Octet, la mascotte d'Alphabette. Cliquer pour ouvrir le menu."
          aria-haspopup="dialog" aria-expanded="false" title="Cliquer sur Octet">
          <div class="octet-rig" id="octet-rig"></div>
        </button>

        <div id="octet-bubble" role="dialog" aria-label="Suggestions d'Octet" data-placement="top">
          <div class="bubble-arrow" id="octet-bubble-arrow"></div>
          <div class="bubble-header">
            <div>
              <h4 class="bubble-title" id="octet-bubble-title">Coucou ! Je suis Octet</h4>
              <p class="bubble-sub" id="octet-bubble-sub">Mécanicienne d'Alphabette</p>
            </div>
            <button class="bubble-close" id="octet-bubble-close" type="button" aria-label="Fermer">&times;</button>
          </div>
          <div id="octet-bubble-body"></div>
        </div>
      `;

      this.controlsEl = document.createElement("div");
      this.controlsEl.id = "octet-controls";
      this.controlsEl.setAttribute("data-octet-ignore", "");
      this.controlsEl.setAttribute("role", "region");
      this.controlsEl.setAttribute("aria-label", "Contrôles d'Octet");
      this.controlsEl.innerHTML = `
        <span class="octet-mood-pill" id="octet-mood-pill">Boussole</span>
        <button class="octet-ctrl-btn" id="btn-octet-pause" type="button" aria-pressed="false">Pause</button>
        <button class="octet-ctrl-btn" id="btn-octet-hide" type="button" aria-pressed="false">Masquer</button>
      `;

      document.body.append(this.debugLayer, this.stageEl, this.controlsEl);

      this.actorEl     = this.stageEl.querySelector("#octet-actor");
      this.rigEl       = this.stageEl.querySelector("#octet-rig");
      this.bubbleEl    = this.stageEl.querySelector("#octet-bubble");
      this.bubbleArrow = this.stageEl.querySelector("#octet-bubble-arrow");
      this.bubbleBody  = this.stageEl.querySelector("#octet-bubble-body");
      this.bubbleTitle = this.stageEl.querySelector("#octet-bubble-title");
      this.bubbleSub   = this.stageEl.querySelector("#octet-bubble-sub");
      this.btnClose    = this.stageEl.querySelector("#octet-bubble-close");

      this.moodPillEl  = this.controlsEl.querySelector("#octet-mood-pill");
      this.btnPause    = this.controlsEl.querySelector("#btn-octet-pause");
      this.btnHide     = this.controlsEl.querySelector("#btn-octet-hide");
      this.btnDebug    = document.createElement("button"); // débogage : octet.prefs.debug = true en console
    }

    /* -------------------------------------------------------------------------
       3. RENDU VISUEL : SPRITESHEET -> MOOD SPRITE -> SVG MULTI-ACCESSOIRES
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

    _resolveMoodForState(state) {
      if (state === "PAUSED") return "hourglass";
      if (state === "MENU_OPEN") return this.menuMoodOverride || "compass";
      if (state === "JUMPING") return this.sectionMood || "wrench";
      return this.sectionMood || "wrench";
    }

    _renderVisual() {
      const mood = this._resolveMoodForState(this.state);
      this.activeMood = mood;
      this.actorEl.dataset.mood = mood;
      this.moodPillEl.textContent = this.moodLabels[mood] || "Atelier";

      const sheet = this.config.spritesheet;
      const useSheet = sheet && sheet.url && (this.state === "WALKING_ON_TEXT" || this.state === "JUMPING");

      if (useSheet) {
        const frameIdx = this.state === "JUMPING"
          ? sheet.jumpFrame
          : sheet.walkFrames[this.sheetWalkIdx % sheet.walkFrames.length];
        const stepPct = sheet.frames > 1 ? (frameIdx / (sheet.frames - 1)) * 100 : 0;

        if (this.rigEl.dataset.mode !== "sheet") {
          this.rigEl.innerHTML = `<div class="octet-sheet"></div>`;
          this.rigEl.dataset.mode = "sheet";
        }
        const el = this.rigEl.firstElementChild;
        el.style.backgroundImage = `url("${sheet.url}")`;
        el.style.backgroundSize = `${sheet.frames * 100}% 100%`;
        el.style.backgroundPosition = `${stepPct}% 50%`;
        return;
      }

      const moodImg = this.config.moodSprites && this.config.moodSprites[mood];
      if (moodImg) {
        if (this.rigEl.dataset.mode !== "img" || this.rigEl.dataset.src !== moodImg) {
          this.rigEl.innerHTML = `<img class="octet-sprite-img" src="${moodImg}" alt="" draggable="false">`;
          this.rigEl.dataset.mode = "img";
          this.rigEl.dataset.src = moodImg;
        }
        return;
      }

      if (this.rigEl.dataset.mode !== "svg" || this.rigEl.dataset.mood !== mood) {
        this.rigEl.innerHTML = this._buildOctetSVG(mood);
        this.rigEl.dataset.mode = "svg";
        this.rigEl.dataset.mood = mood;
      }
    }

    _setState(nextState) {
      this.state = nextState;
      this.actorEl.dataset.state = nextState;
      this._renderVisual();
    }

    /* -------------------------------------------------------------------------
       4. DÉTECTION DES ÉCRITURES (Range.getClientRects) + DÉTECTION D'AMBIANCE
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
      if (document.documentElement.dataset.univers === "labo") return "flask";
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

    _tick(now) {
      if (this.destroyed) return;
      const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;

      if (!this.prefs.hidden) {
        this._updateFSM(dt);
        this._applyTransform();
      }
      this.rafId = requestAnimationFrame(this._bound.tick);
    }

    _updateFSM(dt) {
      this.scaleX += (1 - this.scaleX) * Math.min(1, dt * 14);
      this.scaleY += (1 - this.scaleY) * Math.min(1, dt * 14);
      this.tiltDeg += (0 - this.tiltDeg) * Math.min(1, dt * 12);

      switch (this.state) {
        case "PAUSED":
        case "MENU_OPEN":
          return;

        case "IDLE": {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) {
            const canWalk = this.currentPlatform && this.currentPlatform.width >= 76;
            if (canWalk && Math.random() < 0.55) {
              this._startWalkOnCurrentPlatform();
            } else {
              this.jumpTo(this._pickNextPlatform());
            }
          }
          break;
        }

        case "WALKING_ON_TEXT": {
          const p = this.currentPlatform;
          if (!p) { this.jumpTo(this._pickNextPlatform()); return; }
          this.y = p.top;

          // Cadence des frames si une spritesheet est configurée
          if (this.config.spritesheet && this.config.spritesheet.url) {
            this.sheetTimer += dt;
            if (this.sheetTimer >= 1 / this.config.spritesheet.fps) {
              this.sheetTimer = 0;
              this.sheetWalkIdx++;
              this._renderVisual();
            }
          }

          const dx = this.walkTargetX - this.x;
          const step = this.config.walkSpeed * dt;
          if (Math.abs(dx) <= step) {
            this.x = this.walkTargetX;
            // En pause sur une écriture, 30 % de chance de sortir sa loupe pour observer le texte !
            this.sectionMood = Math.random() < 0.3 ? "loupe" : (p.mood || "wrench");
            this.stateTimer = 0.8 + Math.random() * 1.4;
            this._setState("IDLE");
          } else {
            this.facing = dx > 0 ? 1 : -1;
            this.x += Math.sign(dx) * step;
          }
          break;
        }

        case "ANTICIPATION": {
          this.scaleX = 1.14;
          this.scaleY = 0.84;
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) {
            this.scaleX = 0.88;
            this.scaleY = 1.16;
            this._setState("JUMPING");
          }
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

          if (t >= 1) {
            this.x = j.endX;
            this.y = j.endY;
            this.lastPlatformId = this.currentPlatform ? this.currentPlatform.id : null;
            this.currentPlatform = j.targetPlatform;
            this.sectionMood = j.targetPlatform.mood || "wrench";
            this.scaleX = 1.18;
            this.scaleY = 0.80;
            this.stateTimer = 0.13;
            this._spawnDust(this.x, this.y);
            this._setState("LANDING");
          }
          break;
        }

        case "LANDING": {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) {
            if (Math.random() < 0.72) this._startWalkOnCurrentPlatform();
            else {
              this.stateTimer = 0.9 + Math.random() * 1.1;
              this._setState("IDLE");
            }
          }
          break;
        }
      }
    }

    _applyTransform() {
      const flip = this.facing * this.config.spriteDefaultFacing;
      this.actorEl.style.transform = `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0)`;
      this.rigEl.style.transform =
        `scaleX(${(flip * this.scaleX).toFixed(3)}) scaleY(${this.scaleY.toFixed(3)}) rotate(${this.tiltDeg.toFixed(1)}deg)`;
    }

    /* -------------------------------------------------------------------------
       6. BULLE CONTEXTUELLE & BOTTOM SHEET MOBILE
       ------------------------------------------------------------------------- */
    _createBubbleAPI() {
      return {
        scrollToAndPulse: (selector) => {
          const el = document.querySelector(selector);
          if (!el) return;
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.classList.remove("octet-pulse");
          void el.offsetWidth;
          el.classList.add("octet-pulse");
        },
        goTo: (selectors, fallbackUrl) => {
          const el = selectors.map((q) => document.querySelector(q)).find(Boolean);
          if (el) { this._createBubbleAPI().scrollToAndPulse("#" + el.id); this.closeMenu(false); }
          else window.location.href = fallbackUrl;
        },
        showMainActions: () => {
          this.menuMoodOverride = "compass";
          this._renderVisual();
          this.bubbleTitle.textContent = "Coucou ! Je suis Octet";
          this.bubbleSub.textContent = "Où allons-nous sur Alphabette ?";
          this.bubbleBody.innerHTML = `<div class="bubble-actions"></div>`;
          const list = this.bubbleBody.querySelector(".bubble-actions");
          for (const act of this.config.actions) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "bubble-action-btn";
            btn.innerHTML = `<span aria-hidden="true">${act.icon}</span><span>${act.label}</span>`;
            btn.addEventListener("click", () => act.run(this._createBubbleAPI()));
            list.appendChild(btn);
          }
          this._positionBubble();
        },
        showTipView: () => {
          this.menuMoodOverride = "loupe";
          this._renderVisual();
          const tip = this.config.tips[this.tipIndex % this.config.tips.length];
          this.tipIndex++;
          this.bubbleTitle.textContent = "Carnet d'atelier";
          this.bubbleSub.textContent = "Astuce & nouveauté Alphabette";
          this.bubbleBody.innerHTML = `
            <div class="bubble-panel">
              <div>${tip}</div>
              <div class="bubble-panel-footer">
                <button type="button" class="bubble-mini-btn ghost" id="octet-back">← Menu</button>
                <button type="button" class="bubble-mini-btn" id="octet-next-tip">Autre astuce</button>
              </div>
            </div>
          `;
          this.bubbleBody.querySelector("#octet-back").addEventListener("click", () => this._createBubbleAPI().showMainActions());
          this.bubbleBody.querySelector("#octet-next-tip").addEventListener("click", () => this._createBubbleAPI().showTipView());
          this._positionBubble();
        },
        closeAndResume: () => this.closeMenu(false),
        closeAndJumpNow: () => this.closeMenu(true)
      };
    }

    openMenu() {
      if (this.state === "MENU_OPEN") { this.closeMenu(false); return; }
      this.prevStateBeforeMenu = this.state === "PAUSED" ? "PAUSED" : "IDLE";
      this.menuMoodOverride = "compass";
      this._setState("MENU_OPEN");
      this.actorEl.setAttribute("aria-expanded", "true");
      this.bubbleEl.classList.add("open");
      this._createBubbleAPI().showMainActions();
    }

    closeMenu(forceJump = false) {
      if (this.state !== "MENU_OPEN") return;
      this.menuMoodOverride = null;
      this.bubbleEl.classList.remove("open");
      this.actorEl.setAttribute("aria-expanded", "false");

      if (this.prevStateBeforeMenu === "PAUSED" && !forceJump) {
        this._setState("PAUSED");
        return;
      }

      this.prefs.paused = false;
      this._savePrefs();
      this._syncControlButtons();

      if (forceJump) this.jumpTo(this._pickNextPlatform());
      else {
        this.stateTimer = 0.65;
        this._setState("IDLE");
      }
    }

    _positionBubble() {
      if (!this.bubbleEl.classList.contains("open")) return;
      const m = this._getMetrics();

      if (m.isBottomSheet) {
        this.bubbleEl.dataset.placement = "sheet";
        return;
      }

      const pad = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const bw = this.bubbleEl.offsetWidth || 310;
      const bh = this.bubbleEl.offsetHeight || 220;

      const spaceAbove = this.y - (m.size + 6);
      const placement = spaceAbove >= bh + pad ? "top" : "bottom";

      let top = placement === "top" ? this.y - m.size - bh - 14 : this.y + 14;
      let left = this.x - bw / 2;

      left = Math.max(pad, Math.min(vw - bw - pad, left));
      top  = Math.max(pad, Math.min(vh - bh - pad, top));

      this.bubbleEl.dataset.placement = placement;
      this.bubbleEl.style.left = `${left.toFixed(0)}px`;
      this.bubbleEl.style.top  = `${top.toFixed(0)}px`;

      const arrowX = Math.max(20, Math.min(bw - 32, this.x - left - 6));
      this.bubbleArrow.style.left = `${arrowX.toFixed(0)}px`;
    }

    /* -------------------------------------------------------------------------
       7. ÉVÉNEMENTS, CONTRÔLES & NETTOYAGE COMPLET (destroy)
       ------------------------------------------------------------------------- */
    _syncControlButtons() {
      this.btnPause.setAttribute("aria-pressed", String(this.prefs.paused));
      this.btnPause.textContent = this.prefs.paused ? "Reprendre" : "Pause";

      this.btnHide.setAttribute("aria-pressed", String(this.prefs.hidden));
      this.btnHide.textContent = this.prefs.hidden ? "Afficher" : "Masquer";
      this.actorEl.classList.toggle("hidden-mascot", this.prefs.hidden);

      this.btnDebug.setAttribute("aria-pressed", String(this.prefs.debug));
      this.debugLayer.classList.toggle("visible", this.prefs.debug);
    }

    _onScroll() {
      const dy = this.lastScrollY - window.scrollY;
      this.lastScrollY = window.scrollY;

      this.y += dy;
      if (this.jump) {
        this.jump.startY += dy;
        this.jump.endY += dy;
      }

      if (this.state === "MENU_OPEN") {
        this.y = Math.max(this.config.topSafeMargin, Math.min(window.innerHeight - 28, this.y));
        this._positionBubble();
      }

      if (!this.scrollRaf) {
        this.scrollRaf = requestAnimationFrame(() => {
          this.scrollRaf = null;
          this.scanPlatforms();
          if (
            this.state !== "MENU_OPEN" &&
            this.state !== "PAUSED" &&
            this.state !== "JUMPING" &&
            (this.y < this.config.topSafeMargin - 10 || this.y > window.innerHeight - 10)
          ) {
            this.y = Math.max(this.config.topSafeMargin, Math.min(window.innerHeight - 20, this.y));
            this.jumpTo(this._pickNextPlatform());
          }
        });
      }
    }

    _onResize() {
      this._scheduleRescan(90);
      this.x = Math.max(30, Math.min(window.innerWidth - 30, this.x));
      if (this.state === "MENU_OPEN") this._positionBubble();
    }

    _onDocClick(e) {
      if (this.state === "MENU_OPEN" && !this.bubbleEl.contains(e.target) && !this.actorEl.contains(e.target)) {
        this.closeMenu(false);
      }
    }

    _onKeyDown(e) {
      if (e.key === "Escape" && this.state === "MENU_OPEN") {
        this.closeMenu(false);
        this.actorEl.focus();
      }
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
        this.openMenu();
      });

      this.btnClose.addEventListener("click", () => this.closeMenu(false));

      this.btnPause.addEventListener("click", () => {
        if (this.state === "MENU_OPEN") this.closeMenu(false);
        this.prefs.paused = !this.prefs.paused;
        this._savePrefs();
        this._syncControlButtons();
        if (this.prefs.paused) this._setState("PAUSED");
        else { this.stateTimer = 0.25; this._setState("IDLE"); }
      });

      this.btnHide.addEventListener("click", () => {
        this.prefs.hidden = !this.prefs.hidden;
        if (this.prefs.hidden && this.state === "MENU_OPEN") this.closeMenu(false);
        this._savePrefs();
        this._syncControlButtons();
      });

      this.btnDebug.addEventListener("click", () => {
        this.prefs.debug = !this.prefs.debug;
        this._savePrefs();
        this._syncControlButtons();
        if (this.prefs.debug) this._renderDebugPlatforms();
      });

      window.addEventListener("scroll", this._bound.onScroll, { passive: true });
      window.addEventListener("resize", this._bound.onResize);
      document.addEventListener("click", this._bound.onDocClick);
      document.addEventListener("keydown", this._bound.onKeyDown);
      this.reducedMotionQuery.addEventListener?.("change", this._bound.onReducedMotionChange);

      this.mutationObserver = new MutationObserver((muts) => {
        if (muts.every((m) => this.stageEl.contains(m.target) || this.debugLayer.contains(m.target) || this.controlsEl.contains(m.target))) return;
        this._scheduleRescan(180);
      });
      this.mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

      this.resizeObserver = new ResizeObserver(() => this._scheduleRescan(150));
      this.resizeObserver.observe(document.body);
    }

    _initPositionAndState() {
      this.scanPlatforms();
      const startPlat = this.platforms.find((p) => p.tag === "H1") || this.platforms[0] || this._getFloorFallback();
      this.currentPlatform = startPlat;
      this.sectionMood = startPlat.mood || "compass";
      this.x = startPlat.left + Math.min(76, startPlat.width * 0.35);
      this.y = startPlat.top;

      if (this.reducedMotionQuery.matches || document.documentElement.dataset.calme === "oui") this.prefs.paused = true;
      this._syncControlButtons();

      if (this.prefs.paused) this._setState("PAUSED");
      else { this.stateTimer = 0.9; this._setState("IDLE"); }

      if (this.prefs.debug) this._renderDebugPlatforms();
      this._applyTransform();
      this.rafId = requestAnimationFrame(this._bound.tick);
    }

    destroy() {
      this.destroyed = true;
      cancelAnimationFrame(this.rafId);
      cancelAnimationFrame(this.scrollRaf);
      clearTimeout(this.rescanTimer);

      window.removeEventListener("scroll", this._bound.onScroll);
      window.removeEventListener("resize", this._bound.onResize);
      document.removeEventListener("click", this._bound.onDocClick);
      document.removeEventListener("keydown", this._bound.onKeyDown);
      this.reducedMotionQuery.removeEventListener?.("change", this._bound.onReducedMotionChange);

      this.mutationObserver?.disconnect();
      this.resizeObserver?.disconnect();

      this.stageEl?.remove();
      this.debugLayer?.remove();
      this.controlsEl?.remove();
    }
  }



  const lancer = () => { if (!window.octet) window.octet = new OctetEngine(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lancer);
  else lancer();
  window.OctetEngine = OctetEngine;
})();
