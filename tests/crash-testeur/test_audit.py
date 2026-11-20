#!/usr/bin/env python3
"""
Tests de api/crash-audit.php (audit express du Crash-Testeur) avec deux faux sites locaux :
un site « soigné » et un site « à reprendre ». Rien ne sort de la machine.

    python3 tests/crash-testeur/test_audit.py
"""
import json, os, shutil, socket, subprocess, sys, tempfile, threading, time, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

SOIGNE = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Boulangerie du Port</title>
<link rel="stylesheet" href="/style.css"></head><body><h1>Boulangerie du Port</h1>
<img src="/pain.jpg" alt="Pain de campagne"><form><label for="m">E-mail</label><input id="m" type="email"></form></body></html>"""
CSS_SOIGNE = "body{color:#111;background:#fff}@media (max-width:600px){h1{font-size:2rem}}"

A_REPRENDRE = """<html><head><meta name="viewport" content="width=1024, user-scalable=no">
<script src="https://www.googletagmanager.com/gtag/js?id=G-X"></script><script src="https://connect.facebook.net/fr_FR/fbevents.js"></script>
<style>.bandeau{color:#aaaaaa;background-color:#ffffff}</style></head><body><table width="980"><tr><td>
<h1>Promo</h1><h1>Encore</h1><img src="/a.jpg"><img src="/b.jpg"><input type="text"></td></tr></table></body></html>"""

class Site(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def envoyer(self, code, corps, type_='text/html', entetes=None):
        b = corps.encode() if isinstance(corps, str) else corps
        self.send_response(code)
        self.send_header('Content-Type', type_)
        for k, v in (entetes or {}).items(): self.send_header(k, v)
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        if self.command != 'HEAD': self.wfile.write(b)
    def do_HEAD(self): self.do_GET()
    def do_GET(self):
        p = self.path
        if p == '/soigne':
            return self.envoyer(200, SOIGNE, entetes={'Content-Security-Policy': "default-src 'self'", 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin'})
        if p == '/redirige': return self.envoyer(301, '', entetes={'Location': '/soigne'})
        if p == '/boucle': return self.envoyer(302, '', entetes={'Location': '/boucle'})
        if p == '/style.css': return self.envoyer(200, CSS_SOIGNE, 'text/css')
        if p == '/pain.jpg': return self.envoyer(200, b'\xff' * 20000, 'image/jpeg')
        if p == '/a-reprendre': return self.envoyer(200, A_REPRENDRE)
        if p in ('/a.jpg', '/b.jpg'): return self.envoyer(200, b'\xff' * 2_500_000 if p == '/a.jpg' else b'\xff' * 1000, 'image/jpeg')
        if p == '/erreur': return self.envoyer(500, 'oups')
        self.envoyer(404, 'non')

def port_libre():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

OK = 0
ECHECS = []
def verifier(cond, nom):
    global OK
    if cond: OK += 1; print('  ✓', nom)
    else: ECHECS.append(nom); print('  ✗', nom)

def main():
    tmp = tempfile.mkdtemp(prefix='audit-')
    maison = os.path.join(tmp, 'maison'); api = os.path.join(maison, 'alphabette', 'eu', 'api'); os.makedirs(api)
    shutil.copy(os.path.join(RACINE, 'serveur/php/crash-audit.php'), api)
    ps = port_libre(); site = ThreadingHTTPServer(('127.0.0.1', ps), Site)
    threading.Thread(target=site.serve_forever, daemon=True).start()
    S = f'http://127.0.0.1:{ps}'
    procs = []
    def serveur(local):
        pp = port_libre()
        env = dict(os.environ, HOME=maison, **({'ALPHABETTE_AUDIT_LOCAL': '1'} if local else {}))
        procs.append(subprocess.Popen(['php', '-S', f'127.0.0.1:{pp}', '-t', os.path.dirname(api)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        for _ in range(50):
            try: urllib.request.urlopen(f'http://127.0.0.1:{pp}/api/crash-audit.php', timeout=1)
            except urllib.error.HTTPError: break
            except Exception: time.sleep(.1)
        return f'http://127.0.0.1:{pp}/api/crash-audit.php'
    LOCAL, STRICT = serveur(True), serveur(False)

    def A(base, corps=None, requete='', entetes=None):
        r = urllib.request.Request(base + (('?' + requete) if requete else ''), data=json.dumps(corps).encode() if corps is not None else None,
                                   headers={'Content-Type': 'application/json', **(entetes or {})}, method='POST' if corps is not None else 'GET')
        try:
            with urllib.request.urlopen(r, timeout=60) as x: return x.status, json.loads(x.read())
        except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')

    try:
        print('Site soigné')
        t = time.time()
        c, b = A(LOCAL, {'url': S + '/soigne', 'public': False})
        duree = time.time() - t
        verifier(c == 200 and b['note'] >= 80, f"note élevée ({b.get('note')}/100)")
        verifier(sum(x['max'] for x in b['categories']) == 100 and len(b['categories']) == 4, '4 catégories, total sur 100')
        verifier(duree < 30, f'audit en moins de 30 s ({duree:.1f} s)')
        verifier('id' not in b, 'résultat privé : aucun lien, rien gardé')
        verifier(not os.path.isdir(os.path.join(maison, 'alphabette-crash-audit', 'public')) or not os.listdir(os.path.join(maison, 'alphabette-crash-audit', 'public')), 'aucun fichier de bulletin écrit')
        cles = {x['cle']: x for cat in b['categories'] for x in cat['controles']}
        verifier(cles['viewport']['ok'] and cles['media']['ok'] and cles['alt']['ok'] and cles['libelles']['ok'] and cles['langue']['ok'], 'téléphone et accessibilité reconnus')
        verifier(not cles['https']['ok'] and any('https' in p['conseil'].lower() or 'ssl' in p['conseil'].lower() for p in b['priorites']), 'http signalé en priorité')

        print('Site à reprendre')
        c, m = A(LOCAL, {'url': S + '/a-reprendre', 'public': True})
        cles = {x['cle']: x for cat in m['categories'] for x in cat['controles']}
        verifier(c == 200 and m['note'] < 50, f"note basse ({m.get('note')}/100)")
        verifier(len(m['priorites']) == 3 and m['priorites'][0]['gain'] >= m['priorites'][2]['gain'], '3 priorités, les plus importantes d\'abord')
        verifier(not cles['viewport']['ok'] and not cles['zoom']['ok'] and not cles['largeur']['ok'], 'viewport fixe, zoom bloqué, tableau trop large')
        verifier(set(m['traceurs']) >= {'Google Tag Manager', 'Meta Pixel'}, 'traceurs repérés')
        verifier(not cles['h1']['ok'] and not cles['alt']['ok'] and not cles['libelles']['ok'] and not cles['langue']['ok'], 'accessibilité : h1, alt, libellé, langue')
        verifier(not cles['contraste']['ok'] and '2,' in cles['contraste']['texte'] or '2.' in cles['contraste']['texte'], 'contraste faible (#aaa sur blanc) repéré')
        verifier(m['mesures']['poids_mo'] >= 2, 'poids réel des images compté')
        verifier(len(m.get('id', '')) == 10 and m.get('public'), 'résultat public : lien de partage')
        c, relu = A(LOCAL, requete='r=' + m['id'])
        verifier(c == 200 and relu['note'] == m['note'] and relu['url'].endswith('/a-reprendre'), 'bulletin public relu')
        c, d = A(LOCAL, requete='r=../../etc')
        verifier(c == 404, 'identifiant de bulletin invalide')

        print('Adresses')
        c, r = A(LOCAL, {'url': S + '/redirige'})
        verifier(c == 200 and r['url'].endswith('/soigne') and r['mesures']['redirections'] == 1, 'redirection suivie et vérifiée')
        c, r = A(LOCAL, {'url': S + '/boucle'})
        verifier(c == 422 and 'redirections' in r['erreur'], 'boucle de redirections arrêtée')
        c, r = A(LOCAL, {'url': S + '/erreur'})
        verifier(c == 422 and '500' in r['erreur'], 'erreur du site expliquée')
        c, r = A(STRICT, {'url': S + '/soigne'})
        verifier(c == 422, 'réseau interne refusé (127.0.0.1)')
        c, r = A(STRICT, {'url': 'http://169.254.169.254/latest/meta-data/'})
        verifier(c == 422, 'adresse de métadonnées refusée')
        c, r = A(STRICT, {'url': 'file:///etc/passwd'})
        verifier(c == 400, 'file:// refusé')
        c, r = A(STRICT, {'url': 'https://exemple.fr:8443/'})
        verifier(c == 422 and 'port' in r['erreur'].lower(), 'port inhabituel refusé')
        c, r = A(STRICT, {'url': 'https://x.fr', 'site_web': 'spam'})
        verifier(c == 400, 'piège à robots')
        c, r = A(STRICT, {'url': 'https://x.fr'}, entetes={'Origin': 'https://pirate.example'})
        verifier(c == 403, 'autre site refusé')
        print('Limite quotidienne')
        for _ in range(12): A(STRICT, {'url': 'http://10.0.0.1/'})
        c, r = A(STRICT, {'url': 'http://10.0.0.1/'})
        verifier(c == 429, '12 audits par jour et par visiteur')
    finally:
        for p in procs: p.terminate()
        site.shutdown(); shutil.rmtree(tmp, ignore_errors=True)
    print(f'\n{OK} vérifications réussies, {len(ECHECS)} échec(s)')
    if ECHECS: print('Échecs :', *ECHECS, sep='\n  - '); sys.exit(1)

if __name__ == '__main__':
    main()
