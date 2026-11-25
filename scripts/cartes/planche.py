#!/usr/bin/env python3
"""Planches A4 denses : 100 mini-cartes (10x10) par feuille, MÊMES codes que codes-secrets.csv.
Usage : python3 scripts/cartes/planche.py [--csv codes-secrets.csv] [--sortie DIR]"""
import argparse, csv, os
import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

BASE = "https://alphabette.eu/api/carte.php?c="
COLS = ROWS = 10
MARGE = 4 * mm

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--csv", default="/home/claude/cartes-sortie/codes-secrets.csv")
    a.add_argument("--sortie", default="/home/claude/cartes-sortie")
    o = a.parse_args()
    lots = {}
    for r in csv.DictReader(open(o.csv), delimiter=";"):
        lots.setdefault(int(r["lot"]), []).append((int(r["numero"]), r["code"].strip()))
    W, H = A4
    cw, ch = (W - 2*MARGE) / COLS, (H - 2*MARGE) / ROWS
    for lot, cartes in sorted(lots.items()):
        cv = canvas.Canvas(os.path.join(o.sortie, f"planche-A4-lot-{lot}.pdf"), pagesize=A4)
        cv.setStrokeColorRGB(.75, .75, .75); cv.setLineWidth(.3)
        for i in range(COLS + 1): cv.line(MARGE + i*cw, MARGE, MARGE + i*cw, H - MARGE)
        for j in range(ROWS + 1): cv.line(MARGE, MARGE + j*ch, W - MARGE, MARGE + j*ch)
        for k, (num, code) in enumerate(cartes):
            x = MARGE + (k % COLS) * cw; y = H - MARGE - (k // COLS + 1) * ch
            cv.setFillColorRGB(.094, .137, .204); cv.setFont("Helvetica-Bold", 6.2)
            cv.drawCentredString(x + cw/2, y + ch - 3.6*mm, "alphabette")
            cv.setFont("Helvetica-Bold", 4.4); cv.setFillColorRGB(.26, .22, .79)
            cv.drawCentredString(x + cw/2, y + ch - 6.6*mm, "APPLI OFFERTE")
            img = qrcode.make(BASE + code, error_correction=qrcode.constants.ERROR_CORRECT_L, border=0, box_size=12)
            t = 16 * mm
            cv.drawImage(ImageReader(img.get_image()), x + (cw - t)/2, y + 7.2*mm, t, t)
            cv.setFillColorRGB(0, 0, 0); cv.setFont("Courier-Bold", 6.4)
            cv.drawCentredString(x + cw/2, y + 4.3*mm, code)
            cv.setFont("Helvetica", 3.4); cv.setFillColorRGB(.4, .4, .4)
            cv.drawCentredString(x + cw/2, y + 1.8*mm, f"unique - fin 07/05/27 - {lot}-{num:03d}")
        cv.showPage(); cv.save()
    print("ok", len(lots), "planches")
main()
