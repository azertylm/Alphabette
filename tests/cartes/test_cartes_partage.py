#!/usr/bin/env python3
"""
Recette des cartes offertes « partage » : 2e scan, source par lieu, défi 3 amis, mur de remerciements, visuel story.
PHP + SQLite en local (php -S), aucun envoi réel.   python3 tests/cartes/test_cartes_partage.py
"""
import glob, hashlib, http.client, json, os, shutil, socket, sqlite3, subprocess, sys, tempfile, time, urllib.parse

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TMP = tempfile.mkdtemp(prefix='cartes-')
PHP, DATA, FIN, MAILS, MAISON = (os.path.join(TMP, d) for d in ('serveur/php', 'serveur/data/private', 'finance', 'mails', 'maison'))
for d in (PHP, DATA, FIN, MAILS, MAISON): os.makedirs(d, exist_ok=True)
for f in ('carte.php', 'finance-commun.php'): shutil.copy(f'{RACINE}/serveur/php/{f}', f'{PHP}/{f}')

def norm(c): return ''.join(ch for ch in c.upper() if ch.isalnum())
def h(c): return hashlib.sha256(('carte|' + norm(c)).encode()).hexdigest()
CODES = ['ABCD-EFGH-JKLM', 'NPQR-STUV-WXYZ', 'A2B3-C4D5-E6F7']
APP = 'Goat Chèvre the King'
with open(f'{DATA}/cartes-hashes.txt', 'w') as fh:
    for i, c in enumerate(CODES, 1): fh.write(f'{h(c)};1;{i};{APP}\n')

ADMIN = 'admin-unique-1234567'
s = socket.socket(); s.bind(('127.0.0.1', 0)); PORT = s.getsockname()[1]; s.close()
env = dict(os.environ, HOME=MAISON, ALPHABETTE_FINANCE_DIR=FIN, ALPHABETTE_FINANCE_MAIL_DIR=MAILS, ADMIN_PASSWORD=ADMIN,
           ALPHABETTE_ADMIN_EMAIL='admin@exemple.invalid', PHP_CLI_SERVER_WORKERS='4')
srv = subprocess.Popen(['php', '-S', f'127.0.0.1:{PORT}', '-t', PHP], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(60):
    try:
        c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=2); c.request('GET', '/carte.php'); c.getresponse().read(); break
    except OSError: time.sleep(0.15)

ok_n, ko = 0, []
def verif(nom, cond, detail=''):
    global ok_n
    if cond: ok_n += 1
    else: ko.append(f'{nom} {detail}')

def req(methode, chemin, corps=None, entetes=None, json_body=None):
    c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=10)
    e = dict(entetes or {}); data = None
    if json_body is not None: data = json.dumps(json_body); e['Content-Type'] = 'application/json'
    elif corps is not None: data = urllib.parse.urlencode(corps); e['Content-Type'] = 'application/x-www-form-urlencoded'
    c.request(methode, chemin, data, e); r = c.getresponse(); t = r.read().decode('utf-8', 'replace')
    return r.status, t, r.getheader('Set-Cookie') or ''
AD = {'X-Admin-Password': ADMIN}
def db():
    f = [x for x in glob.glob(FIN + '/*.sqlite') + glob.glob(FIN + '/*.db')][0]
    return sqlite3.connect(f)

try:
    # 1) Scan avec lieu : compté par source
    st, t, _ = req('GET', f'/carte.php?c={CODES[0]}&s=marche-lunel')
    verif('scan valide', st == 200 and 'Application offerte' in t and 'name="prenom"' in t, st)
    verif('case mur non cochée par défaut', 'name="mur"' in t and 'checked' not in t)
    verif('action du formulaire garde le lieu', 's=marche-lunel' in t)
    st, t, _ = req('GET', '/carte.php?c=ZZZZ-ZZZZ-ZZZZ'); verif('carte inconnue 404', st == 404)
    st, t, _ = req('GET', '/carte.php?c=ABCD'); verif('code incomplet 400', st == 400)

    # 2) Activation avec prénom + consentement mur
    st, t, ck = req('POST', f'/carte.php?c={CODES[0]}&s=marche-lunel', {'c': CODES[0], 'email': 'Marie@Exemple.fr', 'prenom': 'Marie', 'mur': '1'})
    verif('activation OK', st == 200 and 'validé' in t, st)
    verif('visuel story proposé', 'id="story"' in t and 'toBlob' in t and 'alphabette.fr' in t)
    verif('défi 0/3 affiché', '0 / 3' in t and 'api/carte.php?ami=' in t)
    verif('cookie posé', 'ab_carte_' in ck and 'HttpOnly' in ck)
    cookie = ck.split(';')[0]
    lien = t.split('?ami=')[1].split('<')[0]
    verif('jeton 20 hex', len(lien) == 20 and all(x in '0123456789abcdef' for x in lien), lien)

    # 3) 2e scan : « votre appli vous attend » (cookie), puis (même réseau) sans cookie
    st, t, _ = req('GET', f'/carte.php?c={CODES[0]}', entetes={'Cookie': cookie})
    verif('2e scan = appli vous attend', st == 200 and 'vous attend' in t, st)
    st, t, _ = req('GET', f'/carte.php?c={CODES[0]}')
    verif('2e scan même réseau = appli vous attend', st == 200 and 'vous attend' in t, st)
    c = db(); c.execute("UPDATE cartes_offre SET empreinte='autre' WHERE lot=1 AND numero=1"); c.commit()
    st, t, _ = req('GET', f'/carte.php?c={CODES[0]}')
    verif('autre personne, sans cookie : déjà utilisée (409)', st == 409 and 'déjà utilisée' in t, st)
    st, t, _ = req('POST', f'/carte.php?c={CODES[0]}', {'c': CODES[0]})
    verif('ré-activation refusée', st == 409)
    st, t, _ = req('GET', f'/carte.php?c={CODES[0]}', entetes={'Cookie': cookie})
    verif('cookie suffit encore', st == 200 and 'vous attend' in t)

    # 4) Mur de remerciements : consentement strict
    st, t, _ = req('POST', f'/carte.php?c={CODES[1]}', {'c': CODES[1], 'prenom': 'Paul'})  # prénom sans case cochée
    verif('activation sans mur', st == 200)
    st, t, _ = req('GET', '/carte.php?mur&json'); mur = json.loads(t)
    verif('mur : Marie présente', [m['prenom'] for m in mur] == ['Marie'], mur)
    verif('mur : Paul absent (pas de consentement)', 'Paul' not in t and 'Exemple' not in t)
    verif('mur : rien d\'autre que prénom/appli/mois', set(mur[0].keys()) == {'prenom', 'app', 'mois'})
    st, t, _ = req('GET', '/carte.php?mur'); verif('mur HTML', st == 200 and 'Marie' in t and 'noindex' in t)
    st, t, _ = req('POST', f'/carte.php?c={CODES[2]}', {'c': CODES[2], 'prenom': '<script>x</script>', 'mur': '1'})
    st, t, _ = req('GET', '/carte.php?mur&json'); verif('prénom invalide refusé', 'script' not in t and len(json.loads(t)) == 1, t)
    st, t, _ = req('POST', '/carte.php?admin', json_body={'action': 'masquer', 'lot': 1, 'numero': 1, 'masque': 1}, entetes=AD)
    verif('masquer OK', st == 200, t)
    st, t, _ = req('GET', '/carte.php?mur&json'); verif('modération : prénom masqué', json.loads(t) == [])

    # 5) Défi 3 amis
    st, t, _ = req('GET', f'/carte.php?ami={lien}'); verif('page ami', st == 200 and 'type="email"' in t)
    st, t, _ = req('GET', '/carte.php?ami=0123456789abcdef0123'); verif('jeton inconnu 404', st == 404)
    st, t, _ = req('POST', '/carte.php', {'ami': lien, 'email': 'marie@exemple.fr'})
    verif('auto-parrainage non compté', db().execute('SELECT COUNT(*) FROM cartes_amis').fetchone()[0] == 0)
    for i, mail in enumerate(['a1@ex.fr', 'a1@ex.fr', 'a2@ex.fr']):
        req('POST', '/carte.php', {'ami': lien, 'email': mail})
    verif('doublon e-mail non compté (2 amis)', db().execute('SELECT COUNT(*) FROM cartes_amis').fetchone()[0] == 2)
    st, t, _ = req('POST', '/carte.php', {'ami': lien, 'email': 'a3@ex.fr'})
    verif('même réseau : plafond 2 amis', db().execute('SELECT COUNT(*) FROM cartes_amis').fetchone()[0] == 2)
    c = db(); c.execute("UPDATE cartes_amis SET empreinte = 'e' || rowid"); c.commit()
    verif('défi pas encore validé', db().execute('SELECT defi_le FROM cartes_offre WHERE lot=1 AND numero=1').fetchone()[0] is None)
    st, t, _ = req('POST', '/carte.php', {'ami': lien, 'email': 'a3@ex.fr'})
    verif('3e ami : essai activé', st == 200 and 'Essai activé' in t, st)
    verif('défi validé', db().execute('SELECT defi_le FROM cartes_offre WHERE lot=1 AND numero=1').fetchone()[0] is not None)
    mails = ''.join(open(f, errors='ignore').read() for f in glob.glob(MAILS + '/*'))
    verif('e-mail admin + parrain envoyés', 'Défi 3 amis réussi' in mails and '2e appli' in mails, mails[:200])
    st, t, _ = req('POST', '/carte.php', {'ami': lien, 'email': 'a4@ex.fr'})
    verif('un seul déclenchement du défi', mails.count('Défi 3 amis réussi') == 1)
    st, t, _ = req('GET', f'/carte.php?c={CODES[0]}', entetes={'Cookie': cookie})
    verif('parrain : défi réussi affiché', 'Défi réussi' in t and '✓' in t)

    # 6) Administration
    st, t, _ = req('GET', '/carte.php?admin'); verif('admin sans mot de passe refusé', st == 401)
    st, t, _ = req('POST', '/carte.php?admin', json_body={'action': 'libelle', 'lot': 1, 'libelle': 'Marché de Lunel'}, entetes=AD)
    verif('libellé du lot', st == 200, t)
    st, t, _ = req('GET', '/carte.php?admin', entetes=AD); a = json.loads(t)
    verif('stats : lot libellé', a['parLot'][0]['libelle'] == 'Marché de Lunel' and a['parLot'][0]['utilisees'] == 3, a['parLot'])
    src = {x['source']: x for x in a['parSource']}
    verif('stats : scans par lieu', src.get('marche-lunel', {}).get('scans', 0) >= 1 and src['marche-lunel']['activations'] == 1, src)
    verif('stats : défis', a['defisValides'] == 1 and a['amisActives'] == 4, a)
    st, t, _ = req('POST', '/carte.php?admin', json_body={'action': 'livrer', 'lot': 1, 'numero': 1}, entetes=AD)
    verif('livraison 2e appli', db().execute('SELECT defi_livre_le FROM cartes_offre WHERE lot=1 AND numero=1').fetchone()[0] is not None)
    st, t, _ = req('GET', '/carte.php?export', entetes=AD); verif('export CSV', st == 200 and 'marche-lunel' in t and ';oui' in t, t)
    st, t, _ = req('GET', '/carte.php?c=A2B3-C4D5-E6F7&s=%3Cscript%3E'); verif('source invalide → lot-1', st == 200)
    st, t, _ = req('GET', '/carte.php?admin', entetes=AD); verif('source injectée ignorée', 'script' not in t.lower())
finally:
    srv.terminate(); shutil.rmtree(TMP, ignore_errors=True)

print(f'{ok_n} vérifications OK' + (f', {len(ko)} ÉCHEC(S):\n  ' + '\n  '.join(ko) if ko else ''))
sys.exit(1 if ko else 0)
