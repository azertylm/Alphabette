/**
 * @file images.ts
 * URL des photos de joueurs.
 *
 * Les vignettes Wikimedia (`commons.wikimedia.org/wiki/Special:FilePath/...`)
 * sont servies via notre proxy same-origin `/api/goat/photo` : sans cela, le
 * navigateur considère l'image comme cross-origin, « contamine » le canvas et
 * rend impossible la génération de l'image de partage (qui retombait alors sur
 * les avatars à initiales).
 */

const WIKIMEDIA_FILEPATH = 'commons.wikimedia.org/wiki/Special:FilePath/';

/** URL affichable (et dessinable dans un canvas) pour la photo d'un joueur. */
export function playerPhotoUrl(image: string | null | undefined): string {
  if (!image) return '';
  if (!image.startsWith('http')) return image;
  if (image.includes(WIKIMEDIA_FILEPATH)) {
    return `/api/goat/photo?src=${encodeURIComponent(image)}`;
  }
  return image;
}
