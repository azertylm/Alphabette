#!/usr/bin/env python3
"""
process_octet_assets.py — pipeline des illustrations d'Octet (mascotte Alphabette).

Entrée  : assets/octet/raw/   (images sur fond blanc : .jpg, .jpeg ou .png)
Sortie  : public/assets/octet/dist/  (WebP transparents, servis sur /assets/octet/dist/)

Étapes pour chaque image :
  1. Détourage par flood-fill (BFS 4-connexe, collections.deque) parti des 4 bords :
     seul le fond blanc RELIÉ AUX BORDS devient transparent. Les blancs internes fermés
     (reflets des yeux, verres, ventre crème, bulles) restent opaques.
  2. Suppression des fragments isolés éloignés du personnage (ex. silhouette fantôme).
  3. Adoucissement du bord (1–2 px) + décontamination : la teinte blanche des pixels
     semi-transparents du contour est remplacée par la couleur moyenne des voisins opaques
     (pas de halo blanc sur fond sombre).
  4. Mise au format 160 × 160 : personnage dans 152 × 152, centré, bas des pattes à y = 156.
     Toutes les poses regardent à droite (les poses tournées à gauche sont retournées).
  5. Planche « octet-spritesheet.* » (3 bandes : marche G, marche D, saut) → 480 × 160,
     même échelle pour les 3 images, saut surélevé de 8 px.

Dépendances : Pillow et numpy uniquement.   Usage : python3 scripts/process_octet_assets.py
"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parent.parent
RAW = RACINE / "assets" / "octet" / "raw"
DIST = RACINE / "public" / "assets" / "octet" / "dist"

TOILE = 160          # côté d'une pose
CADRE = 152          # le personnage tient dans 152 × 152
SOL = 156            # bas des pattes (4 px de marge)
SAUT = 8             # surélévation de la frame de saut
TRAVAIL = 640        # résolution de travail (rapide, largement suffisant pour 160 px)
EXTS = (".png", ".webp", ".jpg", ".jpeg")

# nom source → (nom de sortie, retourner pour regarder à droite, groupe d'échelle)
# Toutes les poses d'un même groupe gardent la même échelle : la souris a la même taille d'une pose à l'autre.
POSES = {
    # Accessoires (illustrations « debout »)
    "octet-cle": ("octet-cle", False, "debout"),
    "octet-fiole": ("octet-fiole", False, "debout"),
    "octet-boussole": ("octet-boussole", False, "debout"),
    "octet-carnet": ("octet-carnet", True, "debout"),
    "octet-sablier": ("octet-sablier", True, "debout"),
    "octet-loupe": ("octet-loupe", False, "debout"),
    "octet-arrosoir": ("octet-arrosoir", True, "debout"),
    "octet-cadenas": ("octet-cadenas", False, "debout"),
    "octet-bouclier": ("octet-bouclier", False, "debout"),
    "octet-dossiers": ("octet-dossiers", False, "debout"),
    "octet-balance": ("octet-balance", False, "debout"),
    # Mouvements
    "octet-course": ("octet-course", False, "mouvement"),
    "octet-marche-planche": ("octet-marche-planche", False, "mouvement"),
    "octet-saut-planche": ("octet-saut-planche", False, "mouvement"),
    "octet-grand-saut": ("octet-grand-saut", False, "mouvement"),
    "octet-saut-joie": ("octet-saut-joie", False, "mouvement"),
    "octet-chute": ("octet-chute", False, "mouvement"),
    "octet-glissade": ("octet-glissade", False, "mouvement"),
    "octet-escalade": ("octet-escalade", False, "mouvement"),
    "octet-sieste": ("octet-sieste", False, "mouvement"),
    "octet-port-engrenage": ("octet-port-engrenage", False, "mouvement"),
    "octet-lecture-carte": ("octet-lecture-carte", False, "mouvement"),
    "octet-pause-gouter": ("octet-pause-gouter", False, "mouvement"),
    "octet-idee": ("octet-idee", False, "mouvement"),
    "octet-surprise": ("octet-surprise", False, "mouvement"),
    "octet-curieux": ("octet-curieux", False, "mouvement"),
    "octet-pousse-caisse": ("octet-pousse-caisse", False, "mouvement"),
    "octet-tire-corde": ("octet-tire-corde", False, "mouvement"),
    "octet-lanterne": ("octet-lanterne", False, "mouvement"),
    "octet-longue-vue": ("octet-longue-vue", False, "mouvement"),
    "octet-bonjour": ("octet-bonjour", False, "mouvement"),
    "octet-pointe-pieds": ("octet-pointe-pieds", False, "mouvement"),
    "octet-meditation": ("octet-meditation", False, "mouvement"),
    "octet-etourdi": ("octet-etourdi", False, "mouvement"),
    "octet-drapeau": ("octet-drapeau", False, "mouvement"),
    "octet-marteau": ("octet-marteau", False, "mouvement"),
    "octet-pinceau": ("octet-pinceau", False, "mouvement"),
    "octet-scie": ("octet-scie", False, "mouvement"),
    "octet-boite-outils": ("octet-boite-outils", False, "mouvement"),
    "octet-bobine": ("octet-bobine", False, "mouvement"),
    "octet-grande-cle": ("octet-grande-cle", False, "mouvement"),
    "octet-clochette": ("octet-clochette", False, "mouvement"),
    "octet-plan": ("octet-plan", False, "mouvement"),
    "octet-bougie": ("octet-bougie", False, "mouvement"),
    "octet-corde": ("octet-corde", False, "mouvement"),
    "octet-parapluie": ("octet-parapluie", False, "mouvement"),
    "octet-montre": ("octet-montre", False, "mouvement"),
    "octet-the": ("octet-the", False, "mouvement"),
    "octet-echarpe": ("octet-echarpe", False, "mouvement"),
    "octet-direction": ("octet-direction", False, "mouvement"),
    "octet-livre": ("octet-livre", False, "mouvement"),
    "octet-avion": ("octet-avion", False, "mouvement"),
    "octet-glands": ("octet-glands", False, "mouvement"),
    "octet-pouce": ("octet-pouce", False, "mouvement"),
    "octet-haussement": ("octet-haussement", False, "mouvement"),
    "octet-flute": ("octet-flute", False, "mouvement"),
    "octet-pissenlit": ("octet-pissenlit", False, "mouvement"),
    "octet-etirement": ("octet-etirement", False, "mouvement"),
    "octet-cadeau": ("octet-cadeau", False, "mouvement"),
}
# Ajustement entre groupes : les deux séries n'ont pas été dessinées à la même échelle.
# 0.88 aligne la taille de la tête et du corps des poses « debout » sur celle des poses « mouvement ».
AJUSTEMENT_GROUPE = {"debout": 0.88, "mouvement": 1.0}

# Zones à vider avant détourage (fractions largeur/hauteur de l'image source) : défauts connus d'une illustration
ZONES_A_EFFACER = {
    "octet-loupe": [(0.0, 0.0, 0.43, 0.27)],  # silhouette fantôme floue en haut à gauche
}
PLANCHE = "octet-spritesheet"
SORTIE_PLANCHE = "octet-walk-jump-sheet"


def trouver(nom: str) -> Path | None:
    for ext in EXTS:
        for p in (RAW / f"{nom}{ext}", RAW / f"{nom}{ext.upper()}"):
            if p.exists():
                return p
    return None


def deja_detouree(p: Path) -> Image.Image | None:
    """Image déjà détourée (PNG avec un vrai fond transparent) : on la garde telle quelle."""
    im = Image.open(p)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        if im.getchannel("A").getextrema()[0] < 10:
            im.thumbnail((TRAVAIL, TRAVAIL), Image.LANCZOS)
            return im
    return None


def charger(p: Path) -> np.ndarray:
    im = Image.open(p).convert("RGB")
    im.thumbnail((TRAVAIL * 3, TRAVAIL * 3) if p.stem == PLANCHE else (TRAVAIL, TRAVAIL), Image.LANCZOS)
    return np.asarray(im).astype(np.uint8)


def fond_exterieur(rgb: np.ndarray) -> np.ndarray:
    """Masque du fond blanc relié aux 4 bords (BFS 4-connexe)."""
    h, w, _ = rgb.shape
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    blanc = (r > 238) & (g > 238) & (b > 238) & ((mx - mn) < 18)
    vu = np.zeros((h, w), dtype=bool)
    file: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if blanc[y, x] and not vu[y, x]:
                vu[y, x] = True
                file.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if blanc[y, x] and not vu[y, x]:
                vu[y, x] = True
                file.append((y, x))
    blanc_l = blanc.tolist()
    vu_l = vu.tolist()
    while file:
        y, x = file.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not vu_l[ny][nx] and blanc_l[ny][nx]:
                vu_l[ny][nx] = True
                file.append((ny, nx))
    return np.array(vu_l, dtype=bool)


def composantes(masque: np.ndarray) -> tuple[np.ndarray, int]:
    """Étiquetage 8-connexe des zones opaques (BFS)."""
    h, w = masque.shape
    lab = np.zeros((h, w), dtype=np.int32)
    m = masque.tolist()
    lab_l = lab.tolist()
    n = 0
    for y0 in range(h):
        for x0 in range(w):
            if m[y0][x0] and not lab_l[y0][x0]:
                n += 1
                lab_l[y0][x0] = n
                file = deque([(y0, x0)])
                while file:
                    y, x = file.popleft()
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < h and 0 <= nx < w and m[ny][nx] and not lab_l[ny][nx]:
                                lab_l[ny][nx] = n
                                file.append((ny, nx))
    return np.array(lab_l, dtype=np.int32), n


def nettoyer_fragments(sujet: np.ndarray, rgb: np.ndarray) -> np.ndarray:
    """Garde le personnage et les éléments dessinés à l'encre proches de lui (bulles, gouttes, plante) ;
    retire le reste, dont les silhouettes floues sans trait d'encre (fantômes de génération)."""
    encre = rgb.min(axis=2) < 120
    lab, n = composantes(sujet)
    if n <= 1:
        return sujet
    tailles = np.bincount(lab.ravel())[1:]
    principal = int(np.argmax(tailles)) + 1
    ys, xs = np.nonzero(lab == principal)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    marge = int(0.12 * max(sujet.shape))
    garde = np.zeros_like(sujet)
    for i in range(1, n + 1):
        if tailles[i - 1] < 6:
            continue
        cy, cx = np.nonzero(lab == i)
        if i != principal and encre[cy, cx].mean() < 0.03:
            continue
        if i == principal or (cy.min() > y0 - marge and cy.max() < y1 + marge and cx.min() > x0 - marge and cx.max() < x1 + marge):
            garde |= lab == i
    return garde


def flou3(a: np.ndarray) -> np.ndarray:
    p = np.pad(a, 1, mode="edge")
    return sum(p[dy:dy + a.shape[0], dx:dx + a.shape[1]] for dy in range(3) for dx in range(3)) / 9.0


def detourer(rgb: np.ndarray) -> Image.Image:
    sujet = nettoyer_fragments(~fond_exterieur(rgb), rgb)
    alpha = sujet.astype(np.float32)
    # Adoucissement 1–2 px uniquement sur le bord extérieur, pondéré par la clarté du pixel
    clair = rgb.min(axis=2).astype(np.float32)
    doux = flou3(flou3(alpha))
    bord = (doux > 0) & (doux < 1)
    attenuation = np.clip((255.0 - clair) / 45.0, 0.35, 1.0)
    alpha = np.where(bord, np.minimum(doux, np.maximum(doux * attenuation, alpha * 0.55)), alpha)
    alpha = np.where(sujet & ~bord, 1.0, alpha)
    # Décontamination : couleur des pixels de contour = moyenne des voisins bien opaques
    opaque = (alpha > 0.98).astype(np.float32)
    somme = np.stack([flou3(rgb[..., c].astype(np.float32) * opaque) for c in range(3)], axis=2)
    poids = flou3(opaque)[..., None]
    moyenne = np.where(poids > 0.01, somme / np.maximum(poids, 1e-6), rgb.astype(np.float32))
    contour = ((alpha > 0) & (alpha < 0.98))[..., None]
    couleur = np.where(contour, moyenne, rgb.astype(np.float32))
    rgba = np.dstack([np.clip(couleur, 0, 255), np.clip(alpha * 255.0, 0, 255)]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def boite(img: Image.Image) -> tuple[int, int, int, int]:
    return img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox() or (0, 0, img.width, img.height)


def poser(img: Image.Image, echelle: float, sol: int = SOL) -> Image.Image:
    rogne = img.crop(boite(img))
    w, h = max(1, round(rogne.width * echelle)), max(1, round(rogne.height * echelle))
    rogne = rogne.resize((w, h), Image.LANCZOS)
    toile = Image.new("RGBA", (TOILE, TOILE), (0, 0, 0, 0))
    toile.alpha_composite(rogne, ((TOILE - w) // 2, max(0, sol - h)))
    return toile


def enregistrer(img: Image.Image, nom: str) -> Path:
    DIST.mkdir(parents=True, exist_ok=True)
    p = DIST / f"{nom}.webp"
    img.save(p, "WEBP", quality=88, method=6, alpha_quality=95)
    return p


def preparer_pose(src: Path, retourner: bool) -> Image.Image:
    img = deja_detouree(src)
    if img is None:
        rgb = charger(src).copy()
        h, w, _ = rgb.shape
        for x0, y0, x1, y1 in ZONES_A_EFFACER.get(src.stem, []):
            rgb[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = 255
        img = detourer(rgb)
    if retourner:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    return img


def echelle_pour(img: Image.Image) -> float:
    x0, y0, x1, y1 = boite(img)
    return min(CADRE / (x1 - x0), CADRE / (y1 - y0))


def traiter_planche(src: Path) -> Path:
    rgb = charger(src)
    tiers = rgb.shape[1] // 3
    frames = [detourer(np.ascontiguousarray(rgb[:, i * tiers:(i + 1) * tiers])) for i in range(3)]
    boites = [boite(f) for f in frames]
    echelle = min(min(CADRE / (b[2] - b[0]), CADRE / (b[3] - b[1])) for b in boites)
    planche = Image.new("RGBA", (TOILE * 3, TOILE), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        planche.alpha_composite(poser(f, echelle, SOL - (SAUT if i == 2 else 0)), (i * TOILE, 0))
    return enregistrer(planche, SORTIE_PLANCHE)


def main() -> int:
    if not RAW.exists():
        print(f"Dossier absent : {RAW}")
        return 0
    lignes, manquantes = [], []
    planche = trouver(PLANCHE)
    if planche:
        p = traiter_planche(planche)
        lignes.append((p.name, "480 × 160", p.stat().st_size))
    else:
        manquantes.append(PLANCHE)
    groupes: dict[str, list[tuple[str, Image.Image]]] = {}
    for src_nom, (out_nom, retourner, groupe) in POSES.items():
        src = trouver(src_nom)
        if not src:
            manquantes.append(src_nom)
            continue
        groupes.setdefault(groupe, []).append((out_nom, preparer_pose(src, retourner)))
    for groupe, poses in groupes.items():
        # même échelle pour tout le groupe, à la même résolution de travail
        echelle = min(echelle_pour(img) * img.width for _, img in poses) * AJUSTEMENT_GROUPE.get(groupe, 1.0)
        for out_nom, img in poses:
            p = enregistrer(poser(img, echelle / img.width), out_nom)
            lignes.append((p.name, "160 × 160", p.stat().st_size))
    import json
    poses = sorted(p.stem for p in DIST.glob("octet-*.webp"))
    (DIST / "manifest.json").write_text(json.dumps({"poses": poses}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{'Fichier':34} {'Dimensions':12} {'Poids':>9}")
    for nom, dim, octets in lignes:
        alerte = "  (> 15 Ko)" if octets > 15 * 1024 else ""
        print(f"{nom:34} {dim:12} {octets / 1024:7.1f} Ko{alerte}")
    if manquantes:
        print("Absentes (ignorées) : " + ", ".join(manquantes))
    return 0


if __name__ == "__main__":
    sys.exit(main())
