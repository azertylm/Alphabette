/**
 * Socle Unifié ALPHABETTE (v0.4.0) — Web Component <alphabette-shell>
 * Gère le thème Jour/Nuit ("Onyx & Ambre" vs "Papier Ivoire") et l'échelle typographique Senior (BIG).
 * Architecture Zero-Knowledge & 100% Locale.
 */
(function () {
  const STORAGE_THEME_KEY = 'alphabette_memovoix_theme';
  const STORAGE_SCALE_KEY = 'alphabette_memovoix_scale';

  function applyRootVariables(theme, scale) {
    const root = document.documentElement;
    const isLight = theme === 'light';
    if (isLight) {
      root.classList.remove('dark');
      root.classList.add('theme-ivoire');
      root.style.setProperty('--alpha-bg', '#FAF6F0');
      root.style.setProperty('--alpha-card', '#FFFFFF');
      root.style.setProperty('--alpha-card-alt', '#F3EDE2');
      root.style.setProperty('--alpha-text', '#1C1917');
      root.style.setProperty('--alpha-muted', '#57534E');
      root.style.setProperty('--alpha-accent', '#D97706');
      root.style.setProperty('--alpha-border', 'rgba(180, 83, 9, 0.22)');
    } else {
      root.classList.add('dark');
      root.classList.remove('theme-ivoire');
      root.style.setProperty('--alpha-bg', '#0F1115');
      root.style.setProperty('--alpha-card', '#181B22');
      root.style.setProperty('--alpha-card-alt', '#20242E');
      root.style.setProperty('--alpha-text', '#FEF3C7');
      root.style.setProperty('--alpha-muted', '#A8A29E');
      root.style.setProperty('--alpha-accent', '#F59E0B');
      root.style.setProperty('--alpha-border', 'rgba(245, 158, 11, 0.22)');
    }
    root.style.setProperty('--alpha-scale', String(scale));
    window.dispatchEvent(
      new CustomEvent('alphabette-preferences-changed', {
        detail: { theme, scale: Number(scale) },
      })
    );
  }

  window.AlphabetteShell = {
    getApiConfig() {
      return {
        provider: 'gemini',
        mode: 'server-managed',
      };
    },
    getTheme() {
      return localStorage.getItem(STORAGE_THEME_KEY) || 'dark';
    },
    setTheme(nextTheme) {
      localStorage.setItem(STORAGE_THEME_KEY, nextTheme);
      const scale = localStorage.getItem(STORAGE_SCALE_KEY) || '1';
      applyRootVariables(nextTheme, scale);
      const shell = document.querySelector('alphabette-shell');
      if (shell && typeof shell.syncUI === 'function') {
        shell.syncUI();
      }
    },
    getScale() {
      return parseFloat(localStorage.getItem(STORAGE_SCALE_KEY) || '1');
    },
    setScale(nextScale) {
      localStorage.setItem(STORAGE_SCALE_KEY, String(nextScale));
      const theme = localStorage.getItem(STORAGE_THEME_KEY) || 'dark';
      applyRootVariables(theme, nextScale);
      const shell = document.querySelector('alphabette-shell');
      if (shell && typeof shell.syncUI === 'function') {
        shell.syncUI();
      }
    },
  };

  class AlphabetteShellElement extends HTMLElement {
    connectedCallback() {
      const appId = this.getAttribute('app-id') || 'memovoix';
      const appName = this.getAttribute('app-name') || 'MémoVoix';
      const appSubtitle =
        this.getAttribute('app-subtitle') ||
        'Le Biographe Familial Intergénérationnel';
      const appIcon = this.getAttribute('app-icon') || '🎙️';
      const accent = this.getAttribute('accent') || '#F59E0B';

      const initialTheme = localStorage.getItem(STORAGE_THEME_KEY) || 'dark';
      const initialScale = localStorage.getItem(STORAGE_SCALE_KEY) || '1';
      applyRootVariables(initialTheme, initialScale);

      this.innerHTML = `
        <div class="alpha-shell-wrapper no-print" style="font-family: 'Plus Jakarta Sans', sans-serif; border-bottom: 1px solid var(--alpha-border, rgba(245,158,11,0.22)); background: var(--alpha-card, #181B22); color: var(--alpha-text, #FEF3C7); transition: background-color 0.2s ease, color 0.2s ease;">
          <!-- Barre Supérieure 1 : Écosystème Alphabette -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 20px; font-size: 12px; border-bottom: 1px solid var(--alpha-border, rgba(245,158,11,0.12)); background: rgba(0,0,0,0.18);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 700; letter-spacing: 0.08em; color: ${accent};">ALPHABETTE.EU</span>
              <span aria-hidden="true" style="opacity: 0.45;">·</span>
              <span style="opacity: 0.85;">Socle Unifié v0.4.0 (${appId})</span>
              <span aria-hidden="true" style="opacity: 0.45;" class="hidden sm:inline">·</span>
              <span style="opacity: 0.75;" class="hidden sm:inline">Architecture Zero-Knowledge &amp; 100% Locale</span>
            </div>
            <div style="display: flex; align-items: center; gap: 14px;">
              <span style="opacity: 0.85;">IA Éditoriale Active</span>
            </div>
          </div>
          <!-- Barre Supérieure 2 : Identité App & Accessibilité Senior -->
          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 20px; max-width: 1400px; margin: 0 auto;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 24px; line-height: 1;" role="img" aria-label="${appName}">${appIcon}</span>
              <div>
                <div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;">
                  <span style="font-family: 'Playfair Display', Georgia, serif; font-weight: 700; font-size: 18px; letter-spacing: -0.01em;">${appName}</span>
                  <span style="font-size: 13px; opacity: 0.78;">${appSubtitle}</span>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <button type="button" id="alpha-scale-btn" aria-label="Basculer la taille du texte Senior" style="min-height: 44px; padding: 6px 14px; border-radius: 10px; border: 1px solid var(--alpha-border, rgba(245,158,11,0.3)); background: transparent; color: inherit; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <span id="alpha-scale-label">Texte Grand (Senior)</span>
              </button>
              <button type="button" id="alpha-theme-btn" aria-label="Basculer entre Onyx & Ambre et Papier Ivoire" style="min-height: 44px; padding: 6px 14px; border-radius: 10px; border: 1px solid var(--alpha-border, rgba(245,158,11,0.3)); background: transparent; color: inherit; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <span id="alpha-theme-label">Mode Papier Ivoire</span>
              </button>
            </div>
          </div>
        </div>
      `;

      const themeBtn = this.querySelector('#alpha-theme-btn');
      const scaleBtn = this.querySelector('#alpha-scale-btn');

      if (themeBtn) {
        themeBtn.addEventListener('click', () => {
          const current = window.AlphabetteShell.getTheme();
          const next = current === 'dark' ? 'light' : 'dark';
          window.AlphabetteShell.setTheme(next);
        });
      }

      if (scaleBtn) {
        scaleBtn.addEventListener('click', () => {
          const current = window.AlphabetteShell.getScale();
          const next = current > 1.05 ? 1 : 1.18;
          window.AlphabetteShell.setScale(next);
        });
      }

      this.syncUI();
    }

    syncUI() {
      const theme = window.AlphabetteShell.getTheme();
      const scale = window.AlphabetteShell.getScale();
      const themeLabel = this.querySelector('#alpha-theme-label');
      const scaleLabel = this.querySelector('#alpha-scale-label');
      if (themeLabel) {
        themeLabel.textContent =
          theme === 'dark' ? '☀️ Lecture Papier Ivoire' : '🌙 Studio Onyx & Ambre';
      }
      if (scaleLabel) {
        scaleLabel.textContent =
          scale > 1.05 ? '🔍 Texte Normal (100%)' : '🔍 Texte Grand Senior (BIG)';
      }
    }
  }

  if (!customElements.get('alphabette-shell')) {
    customElements.define('alphabette-shell', AlphabetteShellElement);
  }
})();
