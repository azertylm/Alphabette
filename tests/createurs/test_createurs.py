#!/usr/bin/env python3
"""Tests du service « Créateurs » (PHP + SQLite) : php -S local, courrier écrit dans des fichiers, réseaux simulés par des
adresses sources 127.x.0.1 différentes. Lancer : python3 tests/createurs/test_createurs.py"""
import hashlib, hmac, http.client, io, json, os, re, shutil, sqlite3, subprocess, sys, tempfile, time, uuid, zipfile

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORT = int(os.environ.get('PORT', '8099'))
TMP = tempfile.mkdtemp(prefix='abtest-')
PRIV, MAIL = TMP + '/priv', TMP + '/mail'
ORIG = f'http://127.0.0.1:{PORT}'
ok = ko = 0

def verif(nom, cond, detail=''):
    global ok, ko
    if cond: ok += 1
    else:
        ko += 1; print(f'  ✗ {nom} {detail}')

class Client:
    def __init__(self, ip='127.200.0.1'):
        self.ip, self.cookies, self.csrf = ip, {}, None
    def req(self, methode, chemin, corps=None, ct=None, headers=None, brut=False):
        c = http.client.HTTPConnection('127.0.0.1', PORT, source_address=(self.ip, 0), timeout=20)
        h = {'Cookie': '; '.join(f'{k}={v}' for k, v in self.cookies.items())}
        if methode == 'POST': h['X-Alphabette'] = '1'; h['Origin'] = ORIG
        if ct: h['Content-Type'] = ct
        if self.csrf: h['X-CSRF'] = self.csrf
        h.update(headers or {})
        c.request(methode, chemin, body=corps, headers=h)
        r = c.getresponse(); data = r.read()
        for v in r.msg.get_all('Set-Cookie') or []:
            k, _, rest = v.partition('='); val = rest.split(';')[0]
            self.cookies[k] = val
        c.close()
        if brut: return r.status, dict((k.lower(), v) for k, v in r.getheaders()), data
        try: return r.status, json.loads(data)
        except Exception: return r.status, {'_brut': data.decode('utf-8', 'replace')}
    def post(self, chemin, d): return self.req('POST', chemin, json.dumps(d), 'application/json')
    def form(self, chemin, champs, fichier=None):
        b = uuid.uuid4().hex; p = []
        for k, v in champs.items(): p.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        if fichier:
            nom, octets = fichier
            p.append(f'--{b}\r\nContent-Disposition: form-data; name="fichier"; filename="{nom}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + octets + b'\r\n')
        p.append(f'--{b}--\r\n'.encode())
        return self.req('POST', chemin, b''.join(p), f'multipart/form-data; boundary={b}')

def dernier_lien(email):
    for f in sorted(os.listdir(MAIL), reverse=True):
        t = open(f'{MAIL}/{f}', encoding='utf-8').read()
        if t.startswith(f'À: {email}') and 'verifier=' in t: return re.search(r'verifier=([a-f0-9]{64})', t).group(1)
    return None

def inscrire(email, ip):
    c = Client(ip)
    s, _ = c.post('/auth.php', {'action': 'demander', 'email': email}); assert s == 200, s
    j = dernier_lien(email); assert j
    s, h, _ = c.req('GET', '/auth.php?verifier=' + j, brut=True); assert s == 302 and 'ab_session' in c.cookies
    return c

def ticket_ancien(app, ip, age=120):
    secret = open(PRIV + '/secret.key').read().strip()
    ip_h = hmac.new(secret.encode(), f'ip|{ip}'.encode(), hashlib.sha256).hexdigest()[:24]
    t = int(time.time()) - age
    return f'{t}.' + hmac.new(secret.encode(), f'ticket|{app}|{t}|{ip_h}'.encode(), hashlib.sha256).hexdigest()[:32]

def zipper(fichiers):
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w') as z:
        for n, c in fichiers.items(): z.writestr(n, c)
    return b.getvalue()

HTML = b'<!doctype html><html><head><title>Mon Quiz Fou</title><meta name="description" content="Un quiz pour rire."></head><body><h1>Salut</h1></body></html>'

serveur = subprocess.Popen(['php', '-S', f'127.0.0.1:{PORT}', '-t', os.environ.get('CREATEURS_DIR', RACINE + '/serveur/php/createurs')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    env={**os.environ, 'ALPHABETTE_FINANCE_DIR': TMP + '/finance', 'ALPHABETTE_FINANCE_MAIL_DIR': MAIL, 'ALPHABETTE_PRIVATE_DIR': PRIV, 'ALPHABETTE_MAIL_DIR': MAIL, 'ADMIN_PASSWORD': 'mdp-de-test', 'ALPHABETTE_ORIGINE': ORIG,
         'ALPHABETTE_ORIGINES': ORIG, 'ALPHABETTE_ADMIN_EMAIL': 'admin@exemple.invalid', 'PHP_CLI_SERVER_WORKERS': '4'})
try:
    for _ in range(50):
        try: http.client.HTTPConnection('127.0.0.1', PORT, timeout=1).request('GET', '/auth.php?moi=1'); break
        except OSError: time.sleep(0.1)
    A = '/'
    print('1. Comptes et sécurité de base')
    anon = Client()
    s, d = anon.req('GET', '/auth.php?moi=1'); verif('anonyme', s == 200 and d['connecte'] is False)
    s, d = anon.req('POST', '/auth.php', '{"action":"demander","email":"x@y.fr"}', 'application/json', headers={'X-Alphabette': '0'}); verif('csrf: en-tête exigé', s == 403)
    s, d = anon.post('/auth.php', {'action': 'demander', 'email': 'pas-un-mail'}); verif('e-mail invalide refusé', s == 400)
    s, d = anon.form('/soumissions.php', {'action': 'deposer', 'collab': '1', 'type': 'html'}, ('a.html', HTML)); verif('dépôt sans compte refusé', s == 401)
    createur = inscrire('Createur.Test+a@Gmail.com', '127.200.0.1')
    s, d = createur.req('GET', '/auth.php?moi=1'); verif('compte vérifié', d['connecte'] and d['utilisateur']['emailVerified'] is True and d['utilisateur']['hasFreeCreatorAccess'] is False)
    s, d = createur.post('/auth.php', {'action': 'profil', 'handle': 'Bad Handle!'}); verif('pseudo invalide', s == 400)
    s, d = createur.post('/auth.php', {'action': 'profil', 'handle': 'zoe-creation'}); verif('pseudo changé', s == 200 and d['utilisateur']['handle'] == 'zoe-creation')

    print('2. Dépôt (60 s) : html, zip, sécurité des archives, GitHub indisponible')
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'html', 'categorie': 'Jeux'}, ('quiz.html', HTML)); verif('case collaborative obligatoire', s == 400 and 'case' in d['erreur'].lower())
    s, d = createur.form('/soumissions.php', {'action': 'analyser', 'type': 'html'}, ('quiz.html', HTML)); verif('analyse <title>/description', d.get('nom') == 'Mon Quiz Fou' and d.get('description') == 'Un quiz pour rire.', d)
    zr = zipper({'depot-main/index.html': HTML, 'depot-main/README.md': b'# Titre README\n\nUne description tiree du README.\n', 'depot-main/app.js': b'console.log(1)'})
    s, d = createur.form('/soumissions.php', {'action': 'analyser', 'type': 'zip'}, ('a.zip', zr)); verif('analyse zip (dossier racine retiré)', s == 200 and d['nom'] == 'Mon Quiz Fou', d)
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'zip', 'collab': '1'}, ('x.zip', zipper({'index.html': HTML, 'evil.php': b'<?php echo 1;'}))); verif('zip avec .php refusé', s == 400)
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'zip', 'collab': '1'}, ('x.zip', zipper({'../hors.html': HTML, 'index.html': HTML}))); verif('zip avec chemin « .. » refusé', s == 400)
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'zip', 'collab': '1'}, ('x.zip', zipper({'page.html': HTML}))); verif('zip sans index.html refusé', s == 400)
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'html', 'collab': '1', 'categorie': 'Jeux'}, ('quiz.html', HTML))
    verif('dépôt html accepté en attente', s == 200 and d['statut'] == 'pending_admin_review', d); app1 = d['id']
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'github', 'collab': '1', 'depot': 'https://github.com/pseudo/depot', 'nom': 'Depot GH'})
    verif('GitHub indisponible : soumission gardée, non récupérée', s == 200 and d['statut'] == 'pending_admin_review', d); appgh = d['id']
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'github', 'collab': '1', 'depot': 'https://evil.example/x/y'}); verif('URL non GitHub refusée', s == 400)
    s, d = createur.req('GET', '/soumissions.php?mes=1'); mes = {x['id']: x for x in d['soumissions']}
    verif('mes soumissions + SHA-256 original', len(mes[app1]['hashOriginal']) == 64 and mes[app1]['hashOriginal'] == hashlib.sha256(HTML).hexdigest() and mes[app1]['nom'] == 'Mon Quiz Fou', mes[app1])
    verif('dépôt GitHub non récupéré signalé', mes[appgh]['depotRecupere'] is False)

    print('3. Administration')
    adm = Client('127.150.0.1')
    s, d = adm.req('GET', '/admin.php?validations=1'); verif('admin sans session refusé', s == 401)
    s, d = adm.post('/admin.php', {'action': 'connexion', 'mot_de_passe': 'faux'}); verif('mauvais mot de passe', s == 401)
    s, d = adm.post('/admin.php', {'action': 'connexion', 'mot_de_passe': 'mdp-de-test'}); verif('connexion admin', s == 200 and d['csrf']); adm.csrf = d['csrf']
    s, d = adm.req('GET', '/admin.php?validations=1'); att = {x['id']: x for x in d['en_attente']}
    verif('file de validation', app1 in att and att[app1]['apercu'] and att[appgh]['apercu'] is None and d['pionniers_restants'] == 50)
    s, h, corps = adm.req('GET', '/' + att[app1]['apercu'].replace('api/createurs/', ''), brut=True)
    verif('aperçu servi dans un bac à sable', s == 200 and 'sandbox' in h['content-security-policy'] and 'allow-same-origin' not in h['content-security-policy'] and b'Salut' in corps, (s, h.get('content-security-policy')))
    s, h, _ = Client().req('GET', f'/fichier.php/{app1}/public/index.html', brut=True); verif('non publié : pas de fichier public', s == 404)
    s, h, _ = Client().req('GET', f'/fichier.php/{app1}/1999999999.{"0"*32}/index.html', brut=True); verif('jeton d\'aperçu falsifié refusé', s == 403)
    noCsrf = Client('127.150.0.1'); noCsrf.cookies = dict(adm.cookies)
    s, d = noCsrf.post('/admin.php', {'action': 'valider', 'id': app1}); verif('admin sans CSRF refusé', s == 403)
    s, d = adm.post('/admin.php', {'action': 'valider', 'id': appgh}); verif('validation impossible si GitHub non récupéré', s == 502, (s, d))
    s, d = adm.post('/admin.php', {'action': 'refuser', 'id': appgh, 'motif': 'ok'}); verif('motif de refus obligatoire', s == 400)
    s, d = adm.post('/admin.php', {'action': 'refuser', 'id': appgh, 'motif': 'Le dépôt est vide, ajoutez un index.html.'}); verif('refus avec motif', s == 200)
    s, d = createur.req('GET', '/soumissions.php?mes=1'); mes = {x['id']: x for x in d['soumissions']}
    verif('motif visible par le créateur', mes[appgh]['statut'] == 'rejected' and 'vide' in mes[appgh]['motifRefus'])
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'html', 'collab': '1', 'resoumettre': appgh, 'nom': 'Corrigé'}, ('quiz.html', HTML)); verif('re-soumission après refus', s == 200 and d['id'] == appgh and d['statut'] == 'pending_admin_review', d)
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'html', 'collab': '1', 'resoumettre': app1}, ('quiz.html', HTML)); verif('re-soumission refusée si pas rejetée', s == 409)
    s, d = adm.post('/admin.php', {'action': 'valider', 'id': app1}); verif('validation → lab_eu + pionnier', s == 200 and d['pionnier'] is True and len(d['hash']) == 64, d)
    s, d = createur.req('GET', '/auth.php?moi=1'); verif('accès créateur gratuit + code', d['utilisateur']['hasFreeCreatorAccess'] and d['utilisateur']['creatorCode'].startswith('CRE-'))
    s, h, corps = Client().req('GET', f'/fichier.php/{app1}/public/index.html', brut=True); verif('version communautaire publique', s == 200 and b'Salut' in corps and 'sandbox' in h['content-security-policy'])
    for chemin in (f'/fichier.php/{app1}/public/..%2f..%2fsecret.key', f'/fichier.php/{app1}/public/%2e%2e/%2e%2e/alphabette.sqlite', f'/fichier.php/{app1}/public/.htaccess'):
        s, h, corps = Client().req('GET', chemin, brut=True); verif('traversée refusée ' + chemin[-24:], s in (403, 404) and b'SQLite' not in corps)
    for f in ('secret.key', 'alphabette.sqlite', '.htaccess'): verif('dossier privé protégé : ' + f, os.path.exists(f'{PRIV}/{f}'))
    verif('.htaccess du dossier privé', 'Require all denied' in open(PRIV + '/.htaccess').read())
    db = sqlite3.connect(PRIV + '/alphabette.sqlite')
    verif('version_originale archivée (immuable)', os.path.isfile(f'{PRIV}/depots/{app1}/original/index.html') and os.path.isfile(f'{PRIV}/depots/{app1}/communautaire/index.html'))
    h1 = db.execute('select originalHash, communityHash from submissions where id=?', (app1,)).fetchone(); verif('SHA-256 original et communautaire', len(h1[0]) == 64 and len(h1[1]) == 64)
    s, d = adm.post('/admin.php', {'action': 'reglage', 'requireManualValidation': False}); verif('interrupteur validation manuelle', s == 200 and d['requireManualValidation'] is False)
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'html', 'collab': '1', 'nom': 'Auto'}, ('b.html', HTML)); verif('sans validation manuelle : direct lab_eu', s == 200 and d['statut'] == 'lab_eu', d); app_auto = d['id']
    adm.post('/admin.php', {'action': 'reglage', 'requireManualValidation': True})
    s, d = adm.req('GET', '/admin.php?session=1'); verif('réglage rétabli', d['reglages']['requireManualValidation'] is True)

    print('4. Votes, anti-fraude, éligibilité')
    s, d = Client().post('/votes.php', {'action': 'voter', 'app_id': app1, 'positif': True, 'ticket': 'x'}); verif('voter sans compte refusé', s == 401)
    nonverif = Client('127.201.0.1'); c = nonverif
    c.post('/auth.php', {'action': 'demander', 'email': 'nv@exemple.fr'})   # jamais confirmé : pas de session
    s, d = createur.req('GET', f'/votes.php?ouvrir={app1}'); tk = d['ticket']
    s, d = createur.post('/votes.php', {'action': 'voter', 'app_id': app1, 'positif': True, 'ticket': ticket_ancien(app1, '127.200.0.1')}); verif('auto-vote refusé (compte)', s == 403 and d.get('code') == 'auto_vote', d)
    alias = inscrire('createurtest@gmail.com', '127.77.0.1')  # même courrier normalisé (points, +tag) → même compte : pas un nouveau votant
    s, d = alias.post('/votes.php', {'action': 'voter', 'app_id': app1, 'positif': True, 'ticket': ticket_ancien(app1, '127.77.0.1')}); verif('auto-vote refusé (e-mail normalisé)', s == 403 and d.get('code') == 'auto_vote', (s, d))
    memeip = inscrire('autre-personne@exemple.fr', '127.200.0.1')
    s, d = memeip.post('/votes.php', {'action': 'voter', 'app_id': app1, 'positif': True, 'ticket': ticket_ancien(app1, '127.200.0.1')}); verif('auto-vote refusé (même IP que le dépôt)', s == 403 and d.get('code') == 'auto_vote', (s, d))
    votants = []
    for i in range(1, 13): votants.append(inscrire(f'votant{i}@exemple.fr', f'127.{i}.0.1'))
    db.execute('update users set createdAt = createdAt - 604800'); db.commit()          # comptes de plus de 24 h
    s, d = votants[0].req('GET', f'/votes.php?ouvrir={app1}'); t0 = d['ticket']
    s, d = votants[0].post('/votes.php', {'action': 'voter', 'app_id': app1, 'positif': True, 'ticket': t0}); verif('session < 30 s rejetée côté serveur', s == 429 and d['code'] == 'session_trop_courte', (s, d))
    s, d = votants[0].post('/votes.php', {'action': 'voter', 'app_id': app1, 'positif': True, 'ticket': 'ticket-bidon'}); verif('ticket falsifié refusé', s == 400)
    s, d = votants[0].post('/votes.php', {'action': 'voter', 'app_id': app1, 'positif': 'oui', 'ticket': ticket_ancien(app1, '127.1.0.1')}); verif('avis non booléen refusé', s == 400)
    for i in range(9):
        s, d = votants[i].post('/votes.php', {'action': 'voter', 'app_id': app1, 'positif': True, 'tags': ['utile', 'pirate'], 'commentaire': 'x' * 400, 'ticket': ticket_ancien(app1, f'127.{i+1}.0.1')})
        verif(f'avis {i+1}', s == 200 and d['positifs'] == i + 1, (s, d))
    verif('9 avis : pas encore éligible', d['statut'] == 'lab_eu')
    com = db.execute('select tags, length(comment) from votes limit 1').fetchone(); verif('tags filtrés, commentaire ≤ 280', com[0] == 'utile' and com[1] == 280, com)
    s, d = votants[0].post('/votes.php', {'action': 'voter', 'app_id': app1, 'positif': False, 'ticket': ticket_ancien(app1, '127.1.0.1')}); verif('1 avis par (compte, appli) : mise à jour', s == 200 and d['positifs'] == 8 and d['negatifs'] == 1, d)
    s, d = votants[0].post('/votes.php', {'action': 'voter', 'app_id': app1, 'positif': True, 'ticket': ticket_ancien(app1, '127.1.0.1')}); verif('retour positif', d['positifs'] == 9 and d['negatifs'] == 0)
    n = db.execute('select count(*) from votes where appId=?', (app1,)).fetchone()[0]; verif('toujours 9 lignes', n == 9)
    s, d = votants[9].post('/votes.php', {'action': 'voter', 'app_id': app1, 'positif': True, 'ticket': ticket_ancien(app1, '127.10.0.1')})
    verif('10 avis positifs ≥ 75 % → eligible_fr', s == 200 and d['positifs'] == 10 and d['statut'] == 'eligible_fr', d)
    jeton = None
    for f in sorted(os.listdir(MAIL)):
        t = open(f'{MAIL}/{f}', encoding='utf-8').read()
        m = re.search(r'valider-transfert\?token=([a-f0-9]{64})', t)
        if m: jeton = m.group(1); mail_t = t
    verif('e-mail de transfert avec jeton', bool(jeton) and 'Createur.Test+a@Gmail.com' in mail_t)
    verif('jeton stocké haché (jamais en clair)', db.execute('select count(*) from transfer_tokens where hash=?', (jeton,)).fetchone()[0] == 0 and db.execute('select count(*) from transfer_tokens where hash=?', (hashlib.sha256(jeton.encode()).hexdigest(),)).fetchone()[0] == 1)
    s, d = Client().req('GET', '/transfert.php?token=' + jeton); verif('GET du lien ne modifie rien', s == 200 and db.execute('select count(*) from transfers').fetchone()[0] == 0)
    s, d = Client().post('/transfert.php', {'token': '0' * 64}); verif('jeton inconnu', s == 404)
    s, d1 = Client().post('/transfert.php', {'token': jeton}); verif('transfert lancé : 15 €/an', s == 200 and d1['ok'] and d1['deja'] is False and d1['montant_centimes'] == 1500, d1)
    s, d2 = Client().post('/transfert.php', {'token': jeton}); verif('transfert idempotent', s == 200 and d2['deja'] is True and d2['montant_centimes'] == 1500)
    verif('une seule ligne de transfert', db.execute('select count(*) from transfers').fetchone()[0] == 1)
    s, d = votants[10].post('/votes.php', {'action': 'voter', 'app_id': app1, 'positif': False, 'ticket': ticket_ancien(app1, '127.11.0.1')}); verif('un avis négatif ne casse pas le seuil (10/11 = 91 %)', d['statut'] == 'eligible_fr', d)

    print('5. Modération : invalidation et recalcul')
    s, d = adm.req('GET', '/admin.php?avis_suspects=1'); verif('aucune alerte pour l\'instant', d['alertes'] == [])
    vid = db.execute('select id from votes where appId=? and positive=1 limit 1', (app1,)).fetchone()[0]
    s, d = adm.post('/admin.php', {'action': 'invalider_vote', 'vote_id': vid, 'motif': 'test'}); verif('invalider un avis → recalcul atomique', s == 200 and d['positifs'] == 9 and d['statut'] == 'lab_eu', d)

    print('6. Alertes anti-fraude')
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'html', 'collab': '1', 'nom': 'Cible'}, ('c.html', HTML)); app2 = d['id']
    adm.post('/admin.php', {'action': 'valider', 'id': app2})
    jeunes = [inscrire(f'jeune{i}@exemple.fr', f'127.{60+i}.0.1') for i in range(7)]   # 7 comptes neufs, 7 réseaux différents
    flag = None
    for i, c in enumerate(jeunes):
        s, d = c.post('/votes.php', {'action': 'voter', 'app_id': app2, 'positif': True, 'ticket': ticket_ancien(app2, f'127.{60+i}.0.1')})
        if i < 5: verif(f'jeune {i+1} : pas d\'alerte', s == 200 and d['alerte'] is False and d['statut'] == 'lab_eu', d)
        if i == 5: verif('6e avis de comptes < 24 h → alerte', s == 200 and d['alerte'] is True, d); flag = True
        if i == 6: verif('app suspendue aux avis', s == 409, (s, d))
    s, d = adm.req('GET', '/admin.php?avis_suspects=1'); verif('alerte listée avec ses avis', len(d['alertes']) == 1 and d['alertes'][0]['appId'] == app2 and len(d['alertes'][0]['votes']) == 6 and d['alertes'][0]['votes'][0]['compteRecent'])
    st = db.execute('select status from submissions where id=?', (app2,)).fetchone()[0]; verif('statut flag_security_review', st == 'flag_security_review')
    s, d = adm.post('/admin.php', {'action': 'ecarter_alerte', 'flag_id': d['alertes'][0]['id']}); verif('alerte écartée : retour lab_eu', s == 200 and d['statut'] == 'lab_eu', d)
    db.execute('delete from limites'); db.commit()   # les plafonds quotidiens sont testés à part
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'html', 'collab': '1', 'nom': 'Cible 2'}, ('d.html', HTML)); app3 = d['id']
    adm.post('/admin.php', {'action': 'valider', 'id': app3})
    db.execute('update users set createdAt = createdAt - 604800'); db.commit()
    reseau = [inscrire(f'meme{i}@exemple.fr', f'127.90.0.{i+1}') for i in range(7)]   # même sous-réseau /24
    db.execute('update users set createdAt = createdAt - 604800'); db.commit()
    for i, c in enumerate(reseau[:6]):
        s, d = c.post('/votes.php', {'action': 'voter', 'app_id': app3, 'positif': True, 'ticket': ticket_ancien(app3, f'127.90.0.{i+1}')})
    verif('6 avis positifs d\'un même sous-réseau → alerte', d.get('alerte') is True, d)
    s, d = adm.req('GET', '/admin.php?avis_suspects=1'); fid = d['alertes'][0]['id']
    s, d = adm.post('/admin.php', {'action': 'pause_abus', 'flag_id': fid}); verif('mise en pause pour abus', s == 200 and d['statut'] == 'paused_abuse')
    s, h, _ = Client().req('GET', f'/fichier.php/{app3}/public/index.html', brut=True); verif('appli en pause : plus servie', s == 404)

    print('7. Signalement, catalogue, pages publiques')
    s, d = Client().post('/signaler.php', {'app_id': app1, 'motif': 'bug', 'details': 'Ne charge pas.'}); verif('signalement', s == 200)
    s, d = Client().post('/signaler.php', {'app_id': app1, 'motif': 'inconnu', 'details': 'Ne charge pas.'}); verif('motif invalide', s == 400)
    s, d = adm.req('GET', '/admin.php?signalements=1'); verif('signalement visible par l\'admin', len(d['signalements']) == 1)
    s, d = Client().req('GET', '/catalogue.php?blocs=1')
    verif('blocs : pionniers, nouveautés', any(a['id'] == app1 for a in d['pionniers']) and any(a['id'] == app1 for a in d['nouveautes']), d)
    s, d = Client().req('GET', '/catalogue.php?q=quiz'); verif('recherche instantanée', any(a['id'] == app1 for a in d['apps']))
    s, d = Client().req('GET', '/catalogue.php?q=%25_%27%20OR%201%3D1'); verif('recherche : jokers et injection inoffensifs', s == 200 and d['apps'] == [])
    s, d = Client().req('GET', '/catalogue.php?cat=Jeux'); verif('filtre catégorie', all(a['categorie'] == 'Jeux' for a in d['apps']))
    s, h, corps = Client().req('GET', '/createur.php?handle=zoe-creation', brut=True); t = corps.decode()
    verif('page créateur + Open Graph', s == 200 and 'og:title' in t and 'og:description' in t and 'og:url' in t and 'Mon Quiz Fou' in t)
    s, h, corps = Client().req('GET', '/createur.php?handle=inconnu', brut=True); verif('créateur inconnu : 404 + noindex', s == 404 and b'noindex' in corps)
    s, h, corps = Client().req('GET', f'/app.php?id={app1}', brut=True); t = corps.decode()
    verif('cadre de l\'appli : iframe sandbox sans allow-same-origin', s == 200 and 'sandbox="allow-scripts' in t and 'allow-same-origin' not in t and 'og:title' in t)
    s, h, _ = Client().req('GET', '/_lib.php', brut=True); verif('_lib.php muet (aucune sortie)', s == 200)

    print('8. « À un pas d\'Alphabette.fr » (6 à 9 avis ≥ 75 %)')
    db.execute('delete from limites'); db.commit()
    s, d = createur.form('/soumissions.php', {'action': 'deposer', 'type': 'html', 'collab': '1', 'nom': 'Presque'}, ('e.html', HTML)); app4 = d['id']
    adm.post('/admin.php', {'action': 'valider', 'id': app4})
    p = [inscrire(f'presque{i}@exemple.fr', f'127.{100+i}.0.1') for i in range(7)]
    db.execute('update users set createdAt = createdAt - 604800'); db.commit()
    for i, c in enumerate(p): c.post('/votes.php', {'action': 'voter', 'app_id': app4, 'positif': True, 'ticket': ticket_ancien(app4, f'127.{100+i}.0.1')})
    s, d = Client().req('GET', '/catalogue.php?blocs=1'); verif('bloc « à un pas » (7 avis)', any(a['id'] == app4 for a in d['presque']), d['presque'])
finally:
    serveur.terminate()
    shutil.rmtree(TMP, ignore_errors=True)
print(f'\n{ok} vérifications réussies, {ko} échec(s)')
sys.exit(1 if ko else 0)
