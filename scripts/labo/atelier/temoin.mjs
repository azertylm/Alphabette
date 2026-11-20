/**
 * scripts/labo/atelier/temoin.mjs — Le Témoin : capture de l'écran d'accueil (390 px) et comparaison
 * avec la capture précédente, pixel par pixel, dans le navigateur (aucune dépendance d'image).
 *   - dominante : part des pixels de la couleur la plus fréquente (≥ 99,5 % : écran vide ; l'analyse
 *     croise aussi avec la quantité de texte, voir analyse.mjs) ;
 *   - changement : part des pixels nettement différents (écart > 40 sur un canal), en %.
 */

/** Analyse dans une page vierge : `actuelle` et `precedente` en base64 (JPEG ou PNG). */
export async function comparerCaptures(navigateur, actuelle, precedente) {
  const ctx = await navigateur.newContext();
  const page = await ctx.newPage();
  try {
    return await page.evaluate(async ([a, b]) => {
      const charger = (b64) => new Promise((ok, ko) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => ko(new Error('image illisible'));
        i.src = `data:image/jpeg;base64,${b64}`;
      });
      const pixels = (img, l, h) => {
        const c = document.createElement('canvas');
        c.width = l; c.height = h;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, l, h).data;
      };
      const ia = await charger(a);
      const pa = pixels(ia, ia.width, ia.height);
      // Page blanche : couleur dominante (quantifiée) sur plus de 97 % des pixels.
      const freq = new Map();
      let n = 0;
      for (let i = 0; i < pa.length; i += 16) {
        const cle = ((pa[i] >> 4) << 8) | ((pa[i + 1] >> 4) << 4) | (pa[i + 2] >> 4);
        freq.set(cle, (freq.get(cle) ?? 0) + 1);
        n++;
      }
      const dominante = Math.round((Math.max(...freq.values()) / n) * 1000) / 1000;
      if (!b) return { dominante, changement: null };
      const ib = await charger(b);
      const l = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
      const x = pixels(ia, l, h), y = pixels(ib, l, h);
      let diff = 0, total = 0;
      for (let i = 0; i < x.length; i += 8) {
        total++;
        if (Math.abs(x[i] - y[i]) > 40 || Math.abs(x[i + 1] - y[i + 1]) > 40 || Math.abs(x[i + 2] - y[i + 2]) > 40) diff++;
      }
      const horsCadre = ia.width * ia.height - l * h + (ib.width * ib.height - l * h);
      const changement = Math.round(((diff / total) * (l * h) + horsCadre) / Math.max(ia.width * ia.height, ib.width * ib.height) * 100);
      return { dominante, changement: Math.min(100, changement) };
    }, [actuelle, precedente ?? null]);
  } finally {
    await ctx.close();
  }
}
