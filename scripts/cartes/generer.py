#!/usr/bin/env python3
"""Génère les cartes « application offerte » : N codes uniques, QR, PDF (4 cartes/page A4, 100 cartes/PDF).
Usage : python3 scripts/cartes/generer.py [--app "Nom de l'appli"] [--total 500] [--par-pdf 100] [--sortie DIR]
Écrit : cartes-lot-N.pdf, codes-secrets.csv (À GARDER HORS DU DÉPÔT), data/private/cartes-hashes.txt (sans les codes)."""
import argparse, csv, hashlib, os, secrets
import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"  # sans 0/O/1/I
BASE = "https://alphabette.eu/api/carte.php?c="

def code():
    c = "".join(secrets.choice(ALPHA) for _ in range(12))
    return c[:4] + "-" + c[4:8] + "-" + c[8:]

def h(c): return hashlib.sha256(("carte|" + c.replace("-", "")).encode()).hexdigest()

def carte(cv, x, y, w, hh, c, lot, num, app):
    cv.setStrokeColorRGB(.7, .7, .7); cv.setDash(2, 2); cv.rect(x, y, w, hh); cv.setDash()
    cv.setFillColorRGB(.094, .137, .204); cv.rect(x, y + hh - 16*mm, w, 16*mm, fill=1, stroke=0)
    cv.setFillColorRGB(1, 1, 1); cv.setFont("Helvetica-Bold", 16); cv.drawString(x + 8*mm, y + hh - 10.5*mm, "alphabette")
    cv.setFont("Helvetica-Bold", 10); cv.drawRightString(x + w - 8*mm, y + hh - 10.5*mm, "CARTE CADEAU")
    cv.setFillColorRGB(.06, .09, .16); cv.setFont("Helvetica-Bold", 19)
    cv.drawCentredString(x + w/2, y + hh - 28*mm, "Application offerte")
    cv.setFont("Helvetica", 12); cv.drawCentredString(x + w/2, y + hh - 35*mm, app)
    img = qrcode.make(BASE + c, error_correction=qrcode.constants.ERROR_CORRECT_M, border=1, box_size=10)
    t = 56*mm; cv.drawImage(ImageReader(img.get_image()), x + (w - t)/2, y + hh - 35*mm - 6*mm - t, t, t)
    cv.setFont("Courier-Bold", 15); cv.drawCentredString(x + w/2, y + 27*mm, c)
    cv.setFont("Helvetica", 9.5)
    cv.drawCentredString(x + w/2, y + 19*mm, "Scannez le QR code pour activer votre application gratuite")
    cv.drawCentredString(x + w/2, y + 14*mm, "ou saisissez le code sur alphabette.eu/api/carte.php")
    cv.setFillColorRGB(.4, .4, .4); cv.setFont("Helvetica", 8)
    cv.drawCentredString(x + w/2, y + 7*mm, "Usage unique - non remboursable - alphabette.fr")
    cv.drawRightString(x + w - 4*mm, y + 3*mm, f"{lot}-{num:03d}")

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--app", default="Une application Alphabette de votre choix")
    a.add_argument("--total", type=int, default=500); a.add_argument("--par-pdf", type=int, default=100)
    a.add_argument("--sortie", default="/home/claude/cartes-sortie")
    o = a.parse_args(); os.makedirs(o.sortie, exist_ok=True)
    codes = set()
    while len(codes) < o.total: codes.add(code())
    codes = sorted(codes, key=lambda _: secrets.randbits(32))
    W, H = A4; cw, ch = W/2, H/2
    lignes, rows = [], []
    for i in range(0, o.total, o.par_pdf):
        lot = i // o.par_pdf + 1
        cv = canvas.Canvas(os.path.join(o.sortie, f"cartes-lot-{lot}.pdf"), pagesize=A4)
        for j, c in enumerate(codes[i:i + o.par_pdf]):
            k = j % 4
            if j and k == 0: cv.showPage()
            x = (k % 2) * cw; y = H - ch - (k // 2) * ch
            carte(cv, x, y, cw, ch, c, lot, j + 1, o.app)
            lignes.append(f"{h(c)};{lot};{j+1};{o.app}"); rows.append((lot, j + 1, c))
        cv.save()
    with open(os.path.join(o.sortie, "codes-secrets.csv"), "w", newline="") as f:
        w = csv.writer(f, delimiter=";"); w.writerow(["lot", "numero", "code"]); w.writerows(rows)
    dest = os.path.join(os.path.dirname(__file__), "..", "..", "data", "private", "cartes-hashes.txt")
    open(dest, "w").write("\n".join(lignes) + "\n")
    print(len(codes), "codes ->", o.sortie)
main()
