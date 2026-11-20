#!/usr/bin/env python3
"""
Tests du relais ORBIT (serveur/php/orbit.php) avec un faux YouTube / TikTok / OpenRouter local.
Rien ne sort de la machine : une copie du relais est réécrite pour viser http://127.0.0.1.

    python3 tests/orbit/test_orbit.py
"""
import io, json, os, re, shutil, signal, socket, subprocess, sys, tempfile, threading, time, urllib.parse, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image, ImageDraw

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
APPELS = []   # corps envoyés au faux OpenRouter

def image(couleur, bandes=False):
    im = Image.new('RGB', (480, 360 if bandes else 270), 'black')
    d = ImageDraw.Draw(im)
    y0 = 45 if bandes else 0
    for i in range(8):
        d.rectangle([i * 60, y0, i * 60 + 30, y0 + 270], fill=couleur)
    d.ellipse([180, y0 + 80, 300, y0 + 200], fill='white')
    b = io.BytesIO(); im.save(b, 'JPEG'); return b.getvalue()

IMG_YT = image('orange', bandes=True)   # miniature YouTube 4:3 avec bandes noires
IMG_TT = image('orange')                # même image, recadrée, côté TikTok : doit donner la même empreinte

class Faux(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def envoyer(self, code, corps, type_='application/json', entetes=None):
        b = corps if isinstance(corps, bytes) else (json.dumps(corps) if not isinstance(corps, str) else corps).encode()
        self.send_response(code); self.send_header('Content-Type', type_)
        for k, v in (entetes or {}).items(): self.send_header(k, v)
        self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query); p = u.path
        if p == '/youtube/oembed':
            v = urllib.parse.parse_qs(urllib.parse.urlparse(q['url'][0]).query)['v'][0]
            if v == 'privee00000': return self.envoyer(401, 'Unauthorized', 'text/plain')
            if v == 'absente0000': return self.envoyer(404, 'Not Found', 'text/plain')
            titre = "TU NE VAS PAS CROIRE ce que fait l'IA !!! 😱" if v == 'aircAruvnKk' else f'Vidéo de démonstration {v}'
            return self.envoyer(200, {'title': titre, 'author_name': 'Chaîne Test'})
        if p == '/youtube/watch':
            v = q.get('v', [''])[0]
            d = 754 if v == 'aircAruvnKk' else [45, 240, 420, 900, 1500, 2400][sum(map(ord, v)) % 6] + sum(map(ord, v)) % 50
            return self.envoyer(200, '<script>var x={"lengthSeconds":"' + str(d) + '","shortDescription":"Une explication des r\\u00e9seaux de neurones.\\nAbonnez-vous","captionTracks":[]};</script>', 'text/html')
        if p.startswith('/ytimg/'):
            v = p.split('/')[3]
            return self.envoyer(200, IMG_YT if v == 'aircAruvnKk' else image('#%06x' % (hash(v) & 0xffffff), bandes=True), 'image/jpeg')
        if p == '/tiktokcdn/x.jpg': return self.envoyer(200, IMG_TT, 'image/jpeg')
        if p == '/tiktok/oembed':
            return self.envoyer(200, {'title': "TU NE VAS PAS CROIRE ce que fait l'IA !!! 😱", 'author_name': 'compte_tt', 'thumbnail_url': 'https://p16-sign.tiktokcdn.com/x.jpg'})
        if p.startswith('/vm.tiktok/'):
            return self.envoyer(301, '', 'text/plain', {'Location': 'https://www.tiktok.com/@compte_tt/video/7301234567890123456?is_from_webapp=1'})
        if p == '/openrouter/api/v1/models':
            return self.envoyer(200, {'data': [{'id': 'meta-llama/llama-3.3-70b-instruct:free', 'architecture': {'output_modalities': ['text']}},
                                               {'id': 'openai/gpt-5', 'architecture': {'output_modalities': ['text']}}]})
        self.envoyer(404, 'non', 'text/plain')
    def do_POST(self):
        corps = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        APPELS.append(corps)
        prompt = corps['messages'][1]['content']
        ids = re.findall(r'^(yt:[A-Za-z0-9_-]{11}) —', prompt, re.M)
        if 'plongée' in prompt:
            rep = {'sujet': 'réseaux de neurones', 'etapes': [{'niveau': n, 'titre': f'étape {n}', 'id': (ids[0] if n == 1 and ids else 'yt:INVENTE0000'), 'recherche': f'neurones niveau {n}'} for n in range(1, 6)]}
        elif 'AUTRE point de vue' in prompt:
            rep = {'angle': 'Optimiste ; chercher un regard critique.', 'id': ids[0] if ids else None, 'recherche': 'critique IA'}
        else:
            rep = {'titre_propre': 'Comment apprend un réseau de neurones', 'langue': 'fr', 'orbite': 'tech-ia', 'ton': 'educatif',
                   'sujets': ['IA', 'neurones'], 'actu_debat': False, 'sans_son': False, 'resume': 'Une animation explique comment un réseau ajuste ses poids.'}
            if 'xorbite' in prompt: rep['orbite'] = 'n-importe-quoi'
            if not re.search(r'CROIRE|abcdefghijk', prompt): rep['orbite'] = None   # le catalogue garde son orbite indicative
        self.envoyer(200, {'model': corps['model'], 'choices': [{'message': {'content': '```json\n' + json.dumps(rep, ensure_ascii=False) + '\n```'}}]})

def port_libre():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

OK, ECHECS = 0, []
def verifier(cond, nom):
    global OK
    if cond: OK += 1; print('  ✓', nom)
    else: ECHECS.append(nom); print('  ✗', nom)

def main():
    signal.signal(signal.SIGTERM, lambda *a: sys.exit(0))   # arrêt propre : le php -S lancé ici s'arrête aussi
    apercu = '--apercu' in sys.argv   # sert dist-static/eu avec ce faux Internet, pour les captures (tests/orbit/apercu.mjs)
    tmp = tempfile.mkdtemp(prefix='orbit-')
    maison = os.path.join(tmp, 'maison'); web = os.path.join(tmp, 'web', 'api'); os.makedirs(maison)
    if apercu: shutil.copytree(os.path.join(RACINE, 'dist-static', 'eu'), os.path.join(tmp, 'web'))
    else: os.makedirs(web)
    pf = port_libre(); pp = int(os.environ.get('ORBIT_PORT', 0)) or port_libre()
    base = f'http://127.0.0.1:{pf}'
    src = open(os.path.join(RACINE, 'serveur', 'php', 'orbit.php'), encoding='utf-8').read()
    for vrai, faux in [('https://www.youtube.com/oembed', base + '/youtube/oembed'), ("'https://www.youtube.com/watch?v='", f"'{base}/youtube/watch?v='"),
                       ("'https://i.ytimg.com/vi/'", f"'{base}/ytimg/vi/'"), ('https://www.tiktok.com/oembed', base + '/tiktok/oembed'),
                       ("'https://openrouter.ai'", f"'{base}/openrouter'"), ('CURLPROTO_HTTPS', 'CURLPROTO_HTTPS | CURLPROTO_HTTP'),
                       ("http('GET', 'https://' . $hote . $chemin)", f"http('GET', '{base}/vm.tiktok' . $chemin)")]:
        assert vrai in src, vrai
        src = src.replace(vrai, faux)
    src = src.replace("preg_match('/(^|\\.)(ytimg\\.com|", "preg_match('/(^|\\.)(127\\.0\\.0\\.1|ytimg\\.com|")
    src = src.replace("$r = http('GET', $source);", f"$r = http('GET', preg_replace('#^https://[^/]+tiktokcdn\\.com#', '{base}/tiktokcdn', $source));")
    open(os.path.join(web, 'orbit.php'), 'w', encoding='utf-8').write(src)

    srv = ThreadingHTTPServer(('127.0.0.1', pf), Faux); threading.Thread(target=srv.serve_forever, daemon=True).start()
    env = dict(os.environ, HOME=maison)
    routeur = [os.path.join(RACINE, 'scripts', 'labo', 'dev-router.php')] if apercu else []
    php = subprocess.Popen(['php', '-S', f'127.0.0.1:{pp}', '-t', os.path.join(tmp, 'web'), *routeur], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    racine = f'http://127.0.0.1:{pp}/api/orbit.php'
    if apercu:
        os.makedirs(os.path.join(maison, 'alphabette-iadebat'))
        json.dump({'cle': 'sk-or-test', 'secret': 'sel'}, open(os.path.join(maison, 'alphabette-iadebat', 'config.json'), 'w'))
        print(f'http://127.0.0.1:{pp}/orbit/', flush=True)
        try:
            while True: time.sleep(3600)
        finally: php.terminate(); srv.shutdown(); shutil.rmtree(tmp, ignore_errors=True)

    def get(q, brut=False):
        try:
            r = urllib.request.urlopen(racine + q, timeout=30); b = r.read()
            return r.status, (b if brut else json.loads(b)), r.headers
        except urllib.error.HTTPError as e:
            b = e.read(); return e.code, (b if brut else json.loads(b or b'{}')), e.headers
    def post(d):
        req = urllib.request.Request(racine, json.dumps(d).encode(), {'Content-Type': 'application/json'})
        try: r = urllib.request.urlopen(req, timeout=30); return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
    try:
        print('Santé et IA absente')
        c, d, _ = get('?sante'); verifier(c == 200 and d['ia'] is False and d['gd'] is True, 'santé : pas de clé IA, GD présent')

        print('Fiches YouTube')
        c, d, _ = get('?meta=' + urllib.parse.quote('https://youtu.be/aircAruvnKk?t=3'))
        f = d.get('fiche', {})
        verifier(c == 200 and f.get('id') == 'yt:aircAruvnKk', 'youtu.be reconnu')
        verifier(f.get('duree_s') == 754 and f.get('sous_titres') is True, 'durée et sous-titres lus sur la page')
        verifier(f.get('description', '').startswith('Une explication des réseaux'), 'description décodée')
        verifier(f.get('integrable') is True and f.get('auteur') == 'Chaîne Test', 'oEmbed lu')
        verifier(bool(re.fullmatch(r'[0-9a-f]{16}', f.get('empreinte_image') or '')), 'empreinte de miniature calculée')
        c, b, h = get('?miniature=yt:aircAruvnKk', brut=True)
        verifier(c == 200 and h['Content-Type'] == 'image/jpeg' and b[:2] == b'\xff\xd8', 'miniature servie par le relais')
        verifier('immutable' in h.get('Cache-Control', ''), 'miniature mise en cache navigateur')
        c, d, _ = get('?meta=' + urllib.parse.quote('https://www.youtube.com/shorts/Ilg3gGewQ5U'))
        verifier(d['fiche']['vertical'] is True, 'Short = vertical')
        c, d, _ = get('?meta=' + urllib.parse.quote('https://www.youtube.com/watch?v=privee00000'))
        verifier(d['fiche']['integrable'] is False, 'vidéo non intégrable signalée')
        c, d, _ = get('?meta=' + urllib.parse.quote('https://www.youtube.com/watch?v=absente0000'))
        verifier(d['fiche'].get('echec') is True, 'vidéo retirée signalée')
        c, d, _ = get('?meta=' + urllib.parse.quote('https://exemple.com/video'))
        verifier(c == 422, 'adresse étrangère refusée')
        c, d, _ = get('?miniature=../../etc/passwd', brut=True); verifier(c == 404, 'miniature : chemin refusé')

        print('TikTok, Instagram, Facebook')
        c, d, _ = get('?meta=' + urllib.parse.quote('https://vm.tiktok.com/ZMabc123/'))
        f = d.get('fiche', {})
        verifier(f.get('id') == 'tt:7301234567890123456' and f.get('vertical') is True, 'lien court TikTok suivi')
        verifier(f.get('auteur') == 'compte_tt', 'oEmbed TikTok lu')
        yt = json.load(open(os.path.join(maison, 'alphabette-orbit', 'cache', 'meta-yt_aircAruvnKk.json')))
        verifier(bin(int(yt['empreinte_image'], 16) ^ int(f['empreinte_image'], 16)).count('1') <= 6, 'même image YouTube/TikTok → empreintes proches (doublon)')
        c, d, _ = get('?meta=' + urllib.parse.quote('https://www.instagram.com/reel/Cx1AbCdEfGh/'))
        verifier(d['fiche']['plateforme'] == 'instagram' and d['fiche']['titre'] == '' and d['fiche']['vertical'] is True, 'Reel Instagram : aucun titre inventé')
        c, d, _ = get('?meta=' + urllib.parse.quote('https://www.facebook.com/watch/?v=1234567890'))
        verifier(d['fiche']['id'] == 'fb:1234567890', 'vidéo Facebook reconnue')
        c, d, _ = get('?metas=yt:aircAruvnKk,tt:7301234567890123456,pas-un-id')
        verifier(c == 200 and [x['id'] for x in d['fiches']] == ['yt:aircAruvnKk', 'tt:7301234567890123456'], 'lot de fiches, identifiants invalides ignorés')

        print('IA sans clé')
        c, d = post({'action': 'analyser', 'id': 'yt:aircAruvnKk'})
        verifier(c == 503 and 'consigne' in d and 'prompt' in d['consigne'], 'sans clé : 503 + consigne pour la clé du visiteur')

        os.makedirs(os.path.join(maison, 'alphabette-iadebat'))
        json.dump({'cle': 'sk-or-test', 'secret': 'sel'}, open(os.path.join(maison, 'alphabette-iadebat', 'config.json'), 'w'))
        print('IA avec la clé du relais')
        c, d = post({'action': 'analyser', 'id': 'yt:aircAruvnKk'})
        a = d.get('analyse', {})
        verifier(c == 200 and a.get('titre_propre') == 'Comment apprend un réseau de neurones' and a.get('orbite') == 'tech-ia', 'analyse : titre propre + orbite')
        verifier(a.get('ton') == 'educatif' and a.get('langue') == 'fr' and a.get('resume'), 'analyse : ton, langue, résumé')
        verifier(a.get('modele', '').endswith(':free'), 'modèle gratuit indiqué')
        envoye = APPELS[-1]
        verifier(envoye['provider']['max_price'] == {'prompt': 0, 'completion': 0} and all(m.endswith(':free') for m in envoye['models']), 'verrou : modèles gratuits, prix max 0')
        n = len(APPELS); c, d = post({'action': 'analyser', 'id': 'yt:aircAruvnKk'})
        verifier(d.get('cache') is True and len(APPELS) == n, 'analyse mise en cache (une seule fois par vidéo)')
        cands = [{'id': 'yt:Ilg3gGewQ5U', 'titre': 'Rétropropagation'}, {'id': 'pas-valide', 'titre': 'x'}]
        c, d = post({'action': 'plongee', 'id': 'yt:aircAruvnKk', 'candidats': cands})
        e = d.get('etapes', [])
        verifier(c == 200 and len(e) == 5 and e[0]['id'] == 'yt:Ilg3gGewQ5U', 'plongée : 5 étapes, vidéo du catalogue reprise')
        verifier(all(x['id'] is None for x in e[1:]) and e[1]['recherche'], 'plongée : identifiant inventé rejeté, recherche gardée')
        c, d = post({'action': 'angle', 'id': 'yt:aircAruvnKk', 'candidats': cands})
        verifier(c == 200 and d.get('id') == 'yt:Ilg3gGewQ5U' and d.get('angle'), 'autre point de vue')
        c, d = post({'action': 'analyser', 'id': 'yt:inconnu1234'})
        verifier(c in (200, 404), 'vidéo jamais vue : fiche créée à la volée ou refus propre')
        c, d = post({'action': 'pirate', 'id': 'yt:aircAruvnKk'}); verifier(c == 400, 'action inconnue refusée')

        print('Vie privée')
        brut = ''.join(open(os.path.join(maison, 'alphabette-orbit', f), encoding='utf-8').read() for f in os.listdir(os.path.join(maison, 'alphabette-orbit')) if f.startswith('quotas-') and f.endswith('.json'))
        verifier('127.0.0.1' not in brut and brut, 'quotas sans adresse IP')
        verifier(oct(os.stat(os.path.join(maison, 'alphabette-orbit')).st_mode)[-3:] == '700', 'dossier de données privé (700)')
    finally:
        php.terminate(); srv.shutdown(); shutil.rmtree(tmp, ignore_errors=True)
    print(f'\n{OK}/{OK + len(ECHECS)} vérifications réussies')
    sys.exit(1 if ECHECS else 0)

if __name__ == '__main__':
    main()
