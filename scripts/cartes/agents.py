#!/usr/bin/env python3
"""QR codes personnels « agents » (1 personne = 1 code), valables jusqu'au 7 mai 2027.
Usage : python3 scripts/cartes/agents.py [--total 50] [--sortie DIR]
Écrit : PNG par agent, agents-A4.pdf, agents.csv, data/private/agents-codes.txt (codes publics par nature)."""
import argparse, csv, os, secrets
import qrcode
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
BASE = "https://alphabette.eu/api/agent.php?a="

def png(code, n, chemin):
    qr = qrcode.make(BASE + code, error_correction=qrcode.constants.ERROR_CORRECT_M, border=2, box_size=20).get_image().convert("RGB")
    W = qr.width + 160; img = Image.new("RGB", (W, qr.height + 330), "white"); d = ImageDraw.Draw(img)
    try: f1 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64); f2 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 38)
    except OSError: f1 = f2 = ImageFont.load_default()
    d.text((W/2, 70), "alphabette", fill=(24, 35, 52), font=f1, anchor="mm")
    img.paste(qr, (80, 140))
    d.text((W/2, qr.height + 190), f"Agent {n:02d} - alphabette.fr", fill=(24, 35, 52), font=f2, anchor="mm")
    d.text((W/2, qr.height + 250), "QR valable jusqu'au 7 mai 2027", fill=(100, 116, 139), font=f2, anchor="mm")
    img.save(chemin)

def main():
    a = argparse.ArgumentParser(); a.add_argument("--total", type=int, default=50); a.add_argument("--sortie", default="/home/claude/cartes-sortie")
    o = a.parse_args(); os.makedirs(os.path.join(o.sortie, "agents"), exist_ok=True)
    codes = set()
    while len(codes) < o.total: codes.add("".join(secrets.choice(ALPHA) for _ in range(8)))
    codes = sorted(codes, key=lambda _: secrets.randbits(32))
    cv = canvas.Canvas(os.path.join(o.sortie, "agents-A4.pdf"), pagesize=A4); W, H = A4
    cols, rows = 5, 10; cw, ch = (W - 8*mm)/cols, (H - 8*mm)/rows
    for k, c in enumerate(codes, 1):
        png(c, k, os.path.join(o.sortie, "agents", f"agent-{k:02d}.png"))
        i = k - 1; x = 4*mm + (i % cols)*cw; y = H - 4*mm - (i // cols + 1)*ch
        cv.setStrokeColorRGB(.8, .8, .8); cv.rect(x, y, cw, ch)
        im = qrcode.make(BASE + c, error_correction=qrcode.constants.ERROR_CORRECT_M, border=0, box_size=10).get_image()
        t = 24*mm; cv.drawImage(ImageReader(im), x + (cw - t)/2, y + 8*mm, t, t)
        cv.setFont("Helvetica-Bold", 8); cv.drawCentredString(x + cw/2, y + ch - 5*mm, f"Agent {k:02d}")
        cv.setFont("Helvetica", 5.5); cv.drawCentredString(x + cw/2, y + 4*mm, "valable jusqu'au 07/05/2027")
    cv.save()
    with open(os.path.join(o.sortie, "agents.csv"), "w", newline="") as f:
        w = csv.writer(f, delimiter=";"); w.writerow(["agent", "code", "lien"]); [w.writerow([k, c, BASE + c]) for k, c in enumerate(codes, 1)]
    open(os.path.join(os.path.dirname(__file__), "..", "..", "data", "private", "agents-codes.txt"), "w").write("\n".join(f"{c};{k}" for k, c in enumerate(codes, 1)) + "\n")
    print(len(codes), "agents")
main()
