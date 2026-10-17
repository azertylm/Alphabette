/**
 * @file fallbackAvatar.ts
 * Avatar de secours SVG généré automatiquement (silhouette + initiales)
 * lorsqu'une photo Wikimedia est introuvable, lente ou cassée.
 *
 * Aucune requête réseau : l'image est produite en data URI côté navigateur.
 */

/** Initiales d'un nom : « Kylian Mbappé » -> « KM ». */
export function initialsOf(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim();
  if (!cleaned) return '?';
  const words = cleaned.split(/[\s'-]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/** Teinte stable dérivée du nom (même joueur = même couleur). */
export function hueOf(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return hash;
}

/**
 * Construit un data URI SVG : silhouette de tête + initiales.
 * @param name Nom affiché du joueur
 * @param size Taille du carré en pixels
 */
export function buildFallbackAvatar(name: string, size = 300): string {
  const initials = initialsOf(name);
  const hue = hueOf(name);
  const background = `hsl(${hue} 42% 18%)`;
  const accent = `hsl(${hue} 70% 55%)`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${initials}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${background}"/>
      <stop offset="100%" stop-color="hsl(${hue} 40% 10%)"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <g fill="${accent}" opacity="0.28">
    <circle cx="${size / 2}" cy="${size * 0.72}" r="${size * 0.34}"/>
    <circle cx="${size / 2}" cy="${size * 0.42}" r="${size * 0.17}"/>
  </g>
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
        font-family="'Plus Jakarta Sans', system-ui, sans-serif"
        font-size="${size * 0.3}" font-weight="800" fill="#f8fafc" letter-spacing="1">${initials}</text>
  <text x="50%" y="86%" text-anchor="middle"
        font-family="'Plus Jakarta Sans', system-ui, sans-serif"
        font-size="${size * 0.075}" font-weight="600" fill="#cbd5e1" opacity="0.85">Photo indisponible</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
