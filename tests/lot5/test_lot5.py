#!/usr/bin/env python3
"""
Recette E2E du Lot 5 (croissance, monétisation complémentaire, Labo communautaire) — PHP + SQLite, comme OVH Perso.
Rien ne sort de la machine : php -S local, faux webhooks Stripe signés, e-mails écrits dans des dossiers temporaires.

Parcours complet : soumission → admin → 10 avis anti-fraude → .fr → abonnement 15 € (1000/500) + affiliation
→ pack 10 licences → virement 20 € → bounty 90/10, plus sécurité et replis.

    python3 tests/lot5/test_lot5.py
"""
import base64, hashlib, hmac, http.client, json, os, re, shutil, socket, sqlite3, struct, subprocess, sys, tempfile, time, uuid, zlib
from datetime import datetime, timedelta, timezone

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TMP = tempfile.mkdtemp(prefix='lot5-')
WEB, FIN, PRIV, MAILF, MAILC, MAISON = (os.path.join(TMP, d) for d in ('web', 'finance', 'createurs-prive', 'mails-finance', 'mails-createurs', 'maison'))
for d in (WEB, FIN, PRIV, MAILF, MAILC, MAISON, WEB + '/createurs'): os.makedirs(d, exist_ok=True)
for f in os.listdir(RACINE + '/serveur/php'):
    if f.endswith('.php'): shutil.copy(f'{RACINE}/serveur/php/{f}', f'{WEB}/{f}')
for f in os.listdir(RACINE + '/serveur/php/createurs'): shutil.copy(f'{RACINE}/serveur/php/createurs/{f}', f'{WEB}/createurs/{f}')
shutil.copy(RACINE + '/data/boutique.json', WEB + '/boutique.json')

SECRET_WH = 'whsec_test_' + uuid.uuid4().hex
ADMIN_F = 'admin-finance-' + uuid.uuid4().hex[:10]
ADMIN_C = 'admin-createurs-test'

def port_libre():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

def lancer(port, extra=None):
    env = dict(os.environ, HOME=MAISON, WEB_DIR=WEB, ALPHABETTE_FINANCE_DIR=FIN, ALPHABETTE_FINANCE_MAIL_DIR=MAILF, ALPHABETTE_WEBHOOK_SECRET=SECRET_WH,
               ALPHABETTE_IBAN_KEY=os.urandom(32).hex() if not hasattr(lancer, 'cle') else lancer.cle, ALPHABETTE_ADMIN_PASSWORD=ADMIN_F, ALPHABETTE_FINANCE_DELAI='2',
               ALPHABETTE_PRIVATE_DIR=PRIV, ALPHABETTE_MAIL_DIR=MAILC, ADMIN_PASSWORD=ADMIN_C, ALPHABETTE_ORIGINE=f'http://127.0.0.1:{port}',
               ALPHABETTE_ORIGINES=f'http://127.0.0.1:{port}', ALPHABETTE_ADMIN_EMAIL='admin@exemple.invalid', PHP_CLI_SERVER_WORKERS='4', **(extra or {}))
    lancer.cle = env['ALPHABETTE_IBAN_KEY']
    p = subprocess.Popen(['php', '-S', f'127.0.0.1:{port}', RACINE + '/tests/lot5/routeur.php'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            c = http.client.HTTPConnection('127.0.0.1', port, timeout=2); c.request('GET', '/api/boutique.php?catalogue')
            if c.getresponse().status == 200: break
        except (OSError, http.client.HTTPException): pass
        time.sleep(0.15)
    time.sleep(0.3)
    return p

PORT, PORT2 = port_libre(), port_libre()
ok_n, ko = 0, []
def verif(nom, cond, detail=''):
    global ok_n
    if cond: ok_n += 1
    else: ko.append(nom); print('  ✗', nom, str(detail)[:400])

class Client:
    """Un visiteur : une adresse source (127.x.y.1), des cookies (service Créateurs) et un jeton Bearer (moteur financier)."""
    def __init__(self, ip='127.0.0.1', port=None):
        self.ip, self.port, self.cookies, self.jeton, self.csrf = ip, port or PORT, {}, None, None
    def req(self, methode, chemin, corps=None, entetes=None, brut=False):
        c = http.client.HTTPConnection('127.0.0.1', self.port, source_address=(self.ip, 0), timeout=30)
        h = {'User-Agent': 'test-lot5'}
        if self.cookies: h['Cookie'] = '; '.join(f'{k}={v}' for k, v in self.cookies.items())
        if self.jeton: h['Authorization'] = 'Bearer ' + self.jeton
        if methode == 'POST': h.update({'X-Alphabette': '1', 'Origin': f'http://127.0.0.1:{self.port}', 'Content-Type': 'application/json'})
        if self.csrf: h['X-CSRF'] = self.csrf
        h.update(entetes or {})
        c.request(methode, chemin, body=corps if isinstance(corps, (bytes, type(None))) else json.dumps(corps), headers=h)
        r = c.getresponse(); data = r.read()
        for v in r.msg.get_all('Set-Cookie') or []:
            k, _, rest = v.partition('='); self.cookies[k] = rest.split(';')[0]
        c.close()
        if brut: return r.status, {k.lower(): v for k, v in r.getheaders()}, data
        try: return r.status, json.loads(data or b'{}')
        except Exception: return r.status, {'_brut': data.decode('utf-8', 'replace')[:300]}
    def get(self, chemin): return self.req('GET', chemin)
    def post(self, chemin, d, **k): return self.req('POST', chemin, d, **k)

def code_finance(email):
    f = os.path.join(MAILF, re.sub(r'[^a-z0-9@._-]', '_', email, flags=re.I) + '.txt')
    return re.findall(r'\b(\d{6})\b', open(f, encoding='utf-8').read())[-1]

def connecter_finance(email, ip='127.0.0.1'):
    c = Client(ip)
    s, d = c.post('/api/billing.php', {'action': 'connexion', 'email': email}); assert s == 200, (email, s, d)
    s, d = c.post('/api/billing.php', {'action': 'code', 'email': email, 'code': code_finance(email)}); assert s == 200, d
    c.jeton = d['jeton']; return c

def lien_magique(email):
    for f in sorted(os.listdir(MAILC), reverse=True):
        t = open(f'{MAILC}/{f}', encoding='utf-8').read()
        if t.startswith(f'À: {email}') and 'verifier=' in t: return re.search(r'verifier=([a-f0-9]{64})(&retour=[^\s]+)?', t).group(0)
    return None

def inscrire(email, ip, sponsor=None, client=None):
    c = client or Client(ip)
    s, d = c.post('/api/createurs/auth.php', {'action': 'demander', 'email': email, **({'sponsor': sponsor} if sponsor else {})}); assert s == 200, (s, d)
    s, h, _ = c.req('GET', '/api/createurs/auth.php?' + lien_magique(email), brut=True); assert s == 302, s
    return c

def ticket_ancien(app, ip, age=120):
    secret = open(PRIV + '/secret.key').read().strip()
    ip_h = hmac.new(secret.encode(), f'ip|{ip}'.encode(), hashlib.sha256).hexdigest()[:24]
    t = int(time.time()) - age
    return f'{t}.' + hmac.new(secret.encode(), f'ticket|{app}|{t}|{ip_h}'.encode(), hashlib.sha256).hexdigest()[:32]

def signer(corps):
    t = int(time.time())
    return f't={t},v1=' + hmac.new(SECRET_WH.encode(), f'{t}.'.encode() + corps, hashlib.sha256).hexdigest()

def webhook(objet, evid=None, typ='checkout.session.completed'):
    ev = {'id': evid or 'evt_' + uuid.uuid4().hex, 'type': typ, 'data': {'object': objet}}
    corps = json.dumps(ev).encode()
    s, d = Client().req('POST', '/api/webhooks.php', corps, entetes={'Stripe-Signature': signer(corps)})
    return s, d, ev['id']

def paiement(montant, email, cmd=None, app=None, pi=None):
    o = {'id': 'cs_' + uuid.uuid4().hex, 'payment_status': 'paid', 'amount_total': montant, 'currency': 'eur', 'payment_intent': pi or 'pi_' + uuid.uuid4().hex,
         'customer_details': {'email': email}, 'metadata': {'app': app} if app else {}}
    if cmd: o['client_reference_id'] = cmd
    return webhook(o)

def fdb(): return sqlite3.connect(os.path.join(FIN, 'finance.sqlite'))
def cdb(): return sqlite3.connect(os.path.join(PRIV, 'alphabette.sqlite'))
def ecr(where, args=()): return fdb().execute('SELECT type, montant_centimes, compte_id FROM ecritures WHERE ' + where, args).fetchall()
def compte(email): return fdb().execute('SELECT id FROM comptes WHERE email = ?', (email.lower(),)).fetchone()[0]

def png_minuscule():
    brut = b'\x00\xff\x00\x00'
    def bloc(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + bloc(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)) + bloc(b'IDAT', zlib.compress(brut)) + bloc(b'IEND', b'')

serveur = lancer(PORT)
serveur2 = None
try:
    HTML = b'<!doctype html><html><head><title>Quiz du Lot 5</title><meta name="description" content="Un quiz pour la recette."></head><body><h1>Salut</h1></body></html>'

    print('1. Catalogue, prix serveur et règle des 10 €')
    s, cat = Client().get('/api/boutique.php?catalogue')
    verif('catalogue', s == 200 and cat['boost']['prixCents'] == 1000 and cat['boost']['places'] == 4 and cat['pourboire']['createurCents'] == 200, cat)
    packs = {p['nb']: p for p in cat.get('packs', [])}
    verif('packs 5/10/25 = 6500/12000/27500', [packs[n]['prixCents'] for n in (5, 10, 25)] == [6500, 12000, 27500])
    verif('pack : jamais moins de 10 € par licence au créateur', all(packs[n]['createurCents'] >= 1000 * n for n in packs) and packs[10]['createurCents'] == 10000 and packs[10]['alphabetteCents'] == 2000, packs)
    verif('paiement par carte fermé tant que les liens sont vides', cat['boost']['carte'] is False and cat['solde'] is True)

    print('2. Parrainage créateur et soumission → admin → 10 avis → .fr')
    parrain = connecter_finance('parrain@exemple.fr')
    s, moi = parrain.get('/api/affiliation.php?moi'); code_p = moi.get('code', '')
    verif('code de parrainage anonyme', s == 200 and re.fullmatch(r'r[a-z0-9]{10}', code_p) and 'parrain' not in code_p and moi['commissions']['createurGardeCents'] == 1000, moi)
    parrain_c = inscrire('parrain@exemple.fr', '127.90.0.1')
    createur = inscrire('createur@exemple.fr', '127.200.0.1', sponsor=code_p)
    verif('parrainage créateur enregistré (12 mois)', fdb().execute('SELECT fin - debut FROM parrainages_createurs WHERE filleul_compte_id = ?', (compte('createur@exemple.fr'),)).fetchone()[0] == 365 * 86400)
    verif('jamais son propre parrain', Client().post('/api/createurs/auth.php', {'action': 'demander', 'email': 'parrain@exemple.fr', 'sponsor': code_p})[0] == 200 and
          fdb().execute('SELECT COUNT(*) FROM parrainages_createurs WHERE filleul_compte_id = parrain_compte_id').fetchone()[0] == 0)
    b = uuid.uuid4().hex
    corps = (f'--{b}\r\nContent-Disposition: form-data; name="action"\r\n\r\ndeposer\r\n--{b}\r\nContent-Disposition: form-data; name="type"\r\n\r\nhtml\r\n'
             f'--{b}\r\nContent-Disposition: form-data; name="collab"\r\n\r\n1\r\n--{b}\r\nContent-Disposition: form-data; name="categorie"\r\n\r\nJeux\r\n'
             f'--{b}\r\nContent-Disposition: form-data; name="fichier"; filename="quiz.html"\r\nContent-Type: text/html\r\n\r\n').encode() + HTML + f'\r\n--{b}--\r\n'.encode()
    s, d = createur.req('POST', '/api/createurs/soumissions.php', corps, entetes={'Content-Type': f'multipart/form-data; boundary={b}'})
    verif('soumission en attente de validation manuelle', s == 200 and d.get('statut') == 'pending_admin_review', d); APP = d.get('id')
    adm = Client('127.150.0.1')
    s, d = adm.post('/api/createurs/admin.php', {'action': 'connexion', 'mot_de_passe': ADMIN_C}); adm.csrf = d.get('csrf')
    s, d = adm.post('/api/createurs/admin.php', {'action': 'valider', 'id': APP}); verif('admin valide → lab_eu', s == 200, d)
    votants = [inscrire(f'votant{i}@exemple.fr', f'127.{i}.0.1') for i in range(1, 12)]
    c = cdb(); c.execute('UPDATE users SET createdAt = createdAt - 604800'); c.commit(); c.close()
    s, d = createur.post('/api/createurs/votes.php', {'action': 'voter', 'app_id': APP, 'positif': True, 'ticket': ticket_ancien(APP, '127.200.0.1')})
    verif('anti-fraude : auto-vote refusé', s == 403, d)
    for i in range(10):
        s, d = votants[i].post('/api/createurs/votes.php', {'action': 'voter', 'app_id': APP, 'positif': True, 'ticket': ticket_ancien(APP, f'127.{i+1}.0.1')})
    verif('10 avis positifs vérifiés → eligible_fr', s == 200 and d.get('statut') == 'eligible_fr' and d.get('positifs') == 10, d)
    verif('Défi Éclair (< 48 h) : badge + boost 7 jours', fdb().execute("SELECT COUNT(*) FROM badges WHERE app_slug = ? AND badge = 'eclair'", (APP,)).fetchone()[0] == 1
          and fdb().execute("SELECT fin - debut FROM boosts WHERE app_slug = ? AND origine = 'eclair'", (APP,)).fetchone()[0] == 7 * 86400)
    jeton_t = None
    for f in sorted(os.listdir(MAILC)):
        m = re.search(r'valider-transfert\?token=([a-f0-9]{64})', open(f'{MAILC}/{f}', encoding='utf-8').read())
        if m: jeton_t = m.group(1)
    s, d = Client().post('/api/createurs/transfert.php', {'token': jeton_t}); verif('transfert .fr demandé (15 €/an)', s == 200 and d['montant_centimes'] == 1500, d)
    s, d = adm.post('/api/createurs/admin.php', {'action': 'publier_fr', 'app_id': APP}); verif('publié sur .fr', s == 200, d)
    verif('appli rattachée au créateur dans le moteur financier', fdb().execute('SELECT createur_id FROM applis WHERE slug = ?', (APP,)).fetchone()[0] == compte('createur@exemple.fr'))

    print('3. Liens recommandés sans traceur (dédoublonnage 30 min, 7 jours, anti-auto-attribution)')
    apporteur = connecter_finance('apporteur@exemple.fr')
    code_a = apporteur.get('/api/affiliation.php?moi')[1]['code']
    visiteur = Client('127.60.0.1')
    s, h, _ = visiteur.req('GET', f'/go/{APP}?ref={code_a}', brut=True)
    clic = re.search(r'clic=(clk_[a-f0-9]{24})', h.get('location', ''))
    verif('/go/ → 302 vers l\'appli avec ?clic=', s == 302 and h['location'].startswith(f'/c/{APP}/') and clic and 'set-cookie' not in h, h); clic = clic.group(1) if clic else ''
    s, h2, _ = visiteur.req('GET', f'/go/{APP}?ref={code_a}', brut=True)
    verif('même visiteur < 30 min : même clic', clic in h2.get('location', ''))
    verif('1 clic unique compté', fdb().execute('SELECT clics_uniques FROM visibilite WHERE compte_id = ?', (compte('apporteur@exemple.fr'),)).fetchone()[0] == 1)
    verif('aucune IP gardée en clair', '127.60.0.1' not in json.dumps(fdb().execute('SELECT * FROM clics').fetchall()))
    s, h, _ = Client().req('GET', f'/go/{APP}?ref=rfauxcode00', brut=True); verif('code inconnu : redirection sans clic', s == 302 and 'clic=' not in h['location'])
    s, h, _ = Client().req('GET', '/go/..%2f..%2fetc', brut=True); verif('pas de redirection ouverte', s in (302, 404) and not h.get('location', '/').startswith('http'))
    c = fdb(); c.execute('UPDATE visibilite SET clics_uniques = 49 WHERE compte_id = ?', (compte('apporteur@exemple.fr'),)); c.commit(); c.close()
    Client('127.61.0.1').req('GET', f'/go/{APP}?ref={code_a}', brut=True)
    verif('visibilité : +10 points tous les 50 clics uniques', fdb().execute('SELECT points FROM visibilite WHERE compte_id = ?', (compte('apporteur@exemple.fr'),)).fetchone()[0] == 10)

    print('4. Abonnement 15 € : 1000 créateur / 500 Alphabette, affiliation prise sur la part Alphabette')
    s, prep = visiteur.post('/api/affiliation.php', {'action': 'preparer', 'app': APP, 'clic': clic})
    verif('commande préparée (prix fixé par le serveur)', s == 200 and prep['prixCents'] == 1500 and prep['lien'] is None and prep['message'], prep)
    s, d, ev1 = paiement(1500, 'abonne1@exemple.fr', cmd=prep['commande'], app=APP, pi='pi_vente1')
    verif('webhook signé → abonnement', s == 200 and d['resultat'] == 'abonnement_cree', d)
    l = {t: m for t, m, _ in ecr('provider_event_id = ?', (ev1,))}
    verif('créateur 1000 · parrain 100 · apporteur 150 · Alphabette 250', l == {'vente': 1000, 'commission_parrainage': 100, 'commission_apporteur': 150, 'commission': 250}, l)
    verif('total exact 1500 c.', sum(l.values()) == 1500)
    s, d, _ = webhook(json.loads(json.dumps({'id': 'x'})), evid=ev1); verif('webhook rejoué : rien de compté deux fois', d.get('resultat') == 'deja_traite' and len(ecr('provider_event_id = ?', (ev1,))) == 4, d)
    # apporteur qui s'achète l'appli via son propre lien → pas de commission
    s, h, _ = Client('127.62.0.1').req('GET', f'/go/{APP}?ref={code_a}', brut=True); clic2 = re.search(r'clic=(clk_\w+)', h['location']).group(1)
    s, prep2 = Client().post('/api/affiliation.php', {'action': 'preparer', 'app': APP, 'clic': clic2})
    s, d, ev2 = paiement(1500, 'apporteur@exemple.fr', cmd=prep2['commande'], app=APP)
    l = {t: m for t, m, _ in ecr('provider_event_id = ?', (ev2,))}
    verif('anti-auto-attribution (acheteur = apporteur)', 'commission_apporteur' not in l and l['vente'] == 1000 and l['commission'] == 400 and sum(l.values()) == 1500, l)
    # créateur qui recommande sa propre appli → pas de commission non plus
    code_c = connecter_finance('createur@exemple.fr').get('/api/affiliation.php?moi')[1]['code']
    s, h, _ = Client('127.63.0.1').req('GET', f'/go/{APP}?ref={code_c}&src=favorites', brut=True); clic3 = re.search(r'clic=(clk_\w+)', h['location']).group(1)
    s, prep3 = Client().post('/api/affiliation.php', {'action': 'preparer', 'app': APP, 'clic': clic3})
    s, d, ev3 = paiement(1500, 'abonne3@exemple.fr', cmd=prep3['commande'], app=APP)
    verif('anti-auto-attribution (créateur)', 'commission_favoris' not in {t for t, _, _ in ecr('provider_event_id = ?', (ev3,))})
    # vitrine « Mes 3 applis préférées » → 100 c.
    s, h, _ = Client('127.64.0.1').req('GET', f'/go/{APP}?ref={code_a}&src=favorites', brut=True); clic4 = re.search(r'clic=(clk_\w+)', h['location']).group(1)
    s, prep4 = Client().post('/api/affiliation.php', {'action': 'preparer', 'app': APP, 'clic': clic4})
    s, d, ev4 = paiement(1500, 'abonne4@exemple.fr', cmd=prep4['commande'], app=APP)
    l = {t: m for t, m, _ in ecr('provider_event_id = ?', (ev4,))}
    verif('vitrine favoris : +100 c. au recommandeur', l.get('commission_favoris') == 100 and l['commission'] == 300 and l['vente'] == 1000, l)
    # clic de plus de 7 jours → aucune commission d'apport
    s, h, _ = Client('127.65.0.1').req('GET', f'/go/{APP}?ref={code_a}', brut=True); clic5 = re.search(r'clic=(clk_\w+)', h['location']).group(1)
    c = fdb(); c.execute('UPDATE clics SET cree_le = cree_le - 8 * 86400 WHERE id = ?', (clic5,)); c.commit(); c.close()
    s, prep5 = Client().post('/api/affiliation.php', {'action': 'preparer', 'app': APP, 'clic': clic5})
    s, d, ev5 = paiement(1500, 'abonne5@exemple.fr', cmd=prep5['commande'], app=APP)
    verif('fenêtre d\'attribution de 7 jours', 'commission_apporteur' not in {t for t, _, _ in ecr('provider_event_id = ?', (ev5,))})
    s, d, evm = paiement(1400, 'x@exemple.fr', app=APP); verif('montant ≠ 1500 refusé', d['resultat'] == 'ignore_montant')

    print('5. Invitations utilisateurs : +90 jours au parrain, plafond 12 mois/an ; remboursement')
    parrainU = connecter_finance('ami-parrain@exemple.fr')
    code_u = parrainU.get('/api/affiliation.php?moi')[1]['code']
    paiement(1500, 'ami-parrain@exemple.fr', app=APP)
    jours = []
    for k in range(6):
        s, p = Client().post('/api/affiliation.php', {'action': 'preparer', 'app': APP, 'invite': code_u})
        paiement(1500, f'ami{k}@exemple.fr', cmd=p['commande'], app=APP, pi=f'pi_ami{k}')
    jours = [r[0] for r in fdb().execute('SELECT jours FROM invitations WHERE parrain_compte_id = ? ORDER BY abonnement_id', (compte('ami-parrain@exemple.fr'),)).fetchall()]
    verif('90 + 90 + 90 + 90 + 5 jours puis plafond', jours == [90, 90, 90, 90, 5], jours)
    s, a = parrainU.get(f'/api/affiliation.php?acces={APP}'); verif('accès prolongé (abonnement + jours offerts)', a['actif'] and a['payant'], a)
    s, d, _ = webhook({'payment_intent': 'pi_ami0'}, typ='charge.refunded'); verif('remboursement accepté', d['resultat'] == 'rembourse', d)
    verif('jours d\'invitation retirés avec le remboursement', sorted(r[0] for r in fdb().execute('SELECT jours FROM invitations WHERE parrain_compte_id = ?', (compte('ami-parrain@exemple.fr'),)).fetchall()) == [5, 90, 90, 90])
    s, d, _ = webhook({'payment_intent': 'pi_vente1'}, typ='charge.refunded')
    net = dict(fdb().execute("SELECT compte_id, SUM(montant_centimes) FROM ecritures WHERE abonnement_id = (SELECT id FROM abonnements WHERE paiement_ref = 'pi_vente1') GROUP BY compte_id").fetchall())
    verif('remboursement : commissions annulées au centime', all(v == 0 for v in net.values()), net)

    print('6. Pack 10 licences (carte) et codes de licence')
    ecole = connecter_finance('ecole@exemple.fr')
    s, d = ecole.post('/api/boutique.php', {'action': 'commander', 'produit': 'pack', 'nb': 7, 'app': APP}); verif('pack de 7 refusé', s == 400)
    s, cmdp = ecole.post('/api/boutique.php', {'action': 'commander', 'produit': 'pack', 'nb': 10, 'app': APP, 'moyen': 'carte'})
    verif('commande pack 10 = 120 €', s == 200 and cmdp['prixCents'] == 12000 and cmdp['paye'] is False, cmdp)
    s, d, _ = paiement(11000, 'ecole@exemple.fr', cmd=cmdp['commande']); verif('montant falsifié ignoré', d['resultat'] == 'ignore_montant')
    s, d, evp = paiement(12000, 'ecole@exemple.fr', cmd=cmdp['commande']); verif('pack payé', d['resultat'] == 'commande_pack', d)
    l = {t: m for t, m, _ in ecr('provider_event_id = ?', (evp,))}
    verif('pack 10 : 100 € créateur (10 €/licence) / 20 € Alphabette', l == {'vente_pack': 10000, 'commission_pack': 2000}, l)
    s, d, _ = paiement(12000, 'ecole@exemple.fr', cmd=cmdp['commande']); verif('commande déjà payée : rien de plus', len(ecr("type = 'vente_pack'")) == 1)
    s, lic = ecole.get('/api/boutique.php?licences'); codes = lic['packs'][0]['licences'] if s == 200 and lic['packs'] else []
    verif('10 codes LIC-XXXX-XXXX-XXXX', len(codes) == 10 and all(re.fullmatch(r'LIC-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}', x['code']) for x in codes), lic)
    verif('codes chiffrés en base (jamais en clair)', codes and codes[0]['code'] not in json.dumps(fdb().execute('SELECT * FROM licences').fetchall()))
    s, d = parrain.get('/api/boutique.php?licences'); verif('les licences d\'un autre restent invisibles', s == 200 and d['packs'] == [])
    s, d = ecole.post('/api/boutique.php', {'action': 'licence_attribuer', 'licence': codes[0]['id'], 'email': 'eleve@exemple.fr'}); verif('licence envoyée à un élève', s == 200, d)
    intrus = connecter_finance('intrus@exemple.fr')
    s, d = intrus.post('/api/boutique.php', {'action': 'activer', 'code': codes[0]['code']}); verif('licence réservée à son destinataire', s == 400)
    eleve = connecter_finance('eleve@exemple.fr')
    s, d = eleve.post('/api/boutique.php', {'action': 'activer', 'code': codes[0]['code']}); verif('élève active sa licence (1 an)', s == 200 and d['app'] == APP, d)
    s, a = eleve.get(f'/api/affiliation.php?acces={APP}'); verif('accès licence', a['actif'] and a['source'] == 'licence', a)
    s, d = intrus.post('/api/boutique.php', {'action': 'activer', 'code': codes[1]['code']}); verif('licence libre activable par qui l\'a reçue', s == 200)
    s, d = eleve.post('/api/boutique.php', {'action': 'activer', 'code': codes[1]['code']}); verif('licence déjà utilisée', s == 400)
    s, d = ecole.post('/api/boutique.php', {'action': 'licence_reattribuer', 'licence': codes[1]['id']}); verif('réattribution : nouveau code', s == 200 and d['code'] != codes[1]['code'], d)
    s, a = intrus.get(f'/api/affiliation.php?acces={APP}'); verif('l\'ancien titulaire perd l\'accès', a['actif'] is False, a)

    print('7. Boosts (4 places), cadeaux, café, domaine, audit, transparence, solde atomique')
    cre = connecter_finance('createur@exemple.fr')
    s, d = apporteur.post('/api/boutique.php', {'action': 'commander', 'produit': 'boost', 'app': APP, 'moyen': 'carte'}); verif('boost : créateur seulement', s == 403)
    for k in range(3):
        s, cb = cre.post('/api/boutique.php', {'action': 'commander', 'produit': 'boost', 'app': APP, 'moyen': 'carte'})
        paiement(1000, 'createur@exemple.fr', cmd=cb['commande'])
    s, d = cre.post('/api/boutique.php', {'action': 'commander', 'produit': 'boost', 'app': APP, 'moyen': 'carte'})
    verif('5e boost refusé (4 places prises, date de la prochaine)', s == 409 and 'prochainePlace' in d, d)
    verif('jamais plus de 4 boosts en même temps', fdb().execute('SELECT COUNT(*) FROM boosts WHERE debut <= ? AND fin > ?', (int(time.time()), int(time.time()))).fetchone()[0] == 4)
    s, cc = cre.post('/api/boutique.php', {'action': 'commander', 'produit': 'cadeau', 'nb': 2, 'app': APP, 'moyen': 'carte'})
    s, d, _ = paiement(1000, 'createur@exemple.fr', cmd=cc['commande'])
    mail = open(os.path.join(MAILF, 'createur@exemple.fr.txt'), encoding='utf-8').read()
    cadeaux = re.findall(r'ALPHA-[A-Z2-9]{4}-[A-Z2-9]{4}', mail)
    verif('2 codes cadeaux ALPHA-XXXX-XXXX (5 €/code)', len(cadeaux) == 2 and d['resultat'] == 'commande_cadeau', cadeaux)
    ami = connecter_finance('cadeau@exemple.fr')
    s, d = ami.post('/api/boutique.php', {'action': 'activer', 'code': cadeaux[0].lower()}); verif('code cadeau activé', s == 200, d)
    s, d = intrus.post('/api/boutique.php', {'action': 'activer', 'code': cadeaux[0]}); verif('code cadeau à usage unique', s == 400)
    s, d = Client().post('/api/boutique.php', {'action': 'commander', 'produit': 'pourboire', 'app': APP, 'moyen': 'carte'})
    s, w, evc = paiement(300, 'fan@exemple.fr', cmd=d['commande'])
    l = {t: m for t, m, _ in ecr('provider_event_id = ?', (evc,))}
    verif('café 3 € = 200 créateur / 100 Alphabette (sans compte)', l == {'pourboire': 200, 'commission_pourboire': 100}, l)
    s, d = cre.post('/api/boutique.php', {'action': 'commander', 'produit': 'domaine', 'app': APP, 'domaine': 'monquiz.fr'}); verif('domaine : double barre obligatoire', s == 400)
    s, d = cre.post('/api/boutique.php', {'action': 'commander', 'produit': 'domaine', 'app': APP, 'domaine': 'alphabette.fr', 'shell_conserve': True}); verif('domaine alphabette refusé', s == 400)
    s, d = cre.post('/api/boutique.php', {'action': 'commander', 'produit': 'domaine', 'app': APP, 'domaine': 'monquiz.fr', 'shell_conserve': True, 'moyen': 'carte'})
    paiement(2000, 'createur@exemple.fr', cmd=d['commande'])
    verif('domaine 20 €/an enregistré (shell conservé)', fdb().execute("SELECT shell_conserve, fin - debut FROM domaines WHERE domaine = 'monquiz.fr'").fetchone() == (1, 365 * 86400))
    s, d = cre.post('/api/boutique.php', {'action': 'commander', 'produit': 'audit_pro', 'app': APP, 'moyen': 'carte'}); paiement(500, 'createur@exemple.fr', cmd=d['commande'])
    verif('audit IA Pro 5 € en file', fdb().execute("SELECT statut FROM audits_pro").fetchone()[0] == 'a_faire')
    s, d = Client().get(f'/api/boutique.php?transparence={APP}'); verif('transparence désactivée par défaut', d == {'publique': False}, d)
    s, d = apporteur.post('/api/boutique.php', {'action': 'transparence', 'app': APP, 'publique': True}); verif('transparence : créateur seulement', s == 403)
    cre.post('/api/boutique.php', {'action': 'transparence', 'app': APP, 'publique': True})
    s, d = Client().get(f'/api/boutique.php?transparence={APP}'); verif('transparence activée', d.get('publique') is True and d['abonnesActifs'] >= 5, d)
    s, d = intrus.post('/api/boutique.php', {'action': 'commander', 'produit': 'bounty', 'titre': 'Mode sombre', 'description': 'Ajouter un vrai mode sombre lisible partout.', 'montant': 2000, 'moyen': 'solde'})
    verif('solde insuffisant : 402, rien n\'est débité', s == 402 and not ecr("compte_id = ? AND type = 'achat_solde'", (compte('intrus@exemple.fr'),)), d)
    s, d = Client().post('/api/boutique.php', {'action': 'commander', 'produit': 'boost', 'app': APP}); verif('commande sans compte : 401', s == 401)

    print('8. Virement 20 € puis bounty 90/10')
    time.sleep(2.2)  # délai de rétractation réduit à 2 s pour la recette (14 jours en production)
    s, r = cre.get('/api/billing.php?revenus')
    verif('solde disponible créateur ≥ 20 €', s == 200 and r['availableBalanceCents'] >= 2000, r)
    dispo = r['availableBalanceCents']
    s, d = cre.post('/api/billing.php', {'action': 'iban', 'iban': 'FR76 3000 6000 0112 3456 7890 189'}); verif('IBAN enregistré (chiffré)', s == 200, d)
    s, d = cre.post('/api/payouts.php', {'action': 'demander'}); verif('virement : code envoyé', s == 200 and d['montantCents'] == dispo, d)
    s, d = cre.post('/api/payouts.php', {'action': 'confirmer', 'code': code_finance('createur@exemple.fr')})
    verif('virement demandé (montant entier, ≥ 2000 c.)', s == 200 and d['montantCents'] == dispo and dispo >= 2000, d)
    s, d = cre.post('/api/payouts.php', {'action': 'demander'}); verif('plus de solde : seuil 20 € rappelé', s == 400 and d.get('code') == 'seuil', d)
    s, cbt = parrain.post('/api/boutique.php', {'action': 'commander', 'produit': 'bounty', 'titre': 'Mode sombre', 'description': 'Ajouter un vrai mode sombre lisible partout dans le quiz.', 'montant': 500, 'moyen': 'carte'})
    verif('bounty < 10 € refusée', s == 400)
    s, cbt = parrain.post('/api/boutique.php', {'action': 'commander', 'produit': 'bounty', 'titre': 'Mode sombre', 'description': 'Ajouter un vrai mode sombre lisible partout dans le quiz.', 'app': APP, 'montant': 2000, 'moyen': 'carte'})
    s, d, _ = paiement(2000, 'parrain@exemple.fr', cmd=cbt['commande'])
    s, bl = Client().get('/api/boutique.php?bounties'); bid = bl['bounties'][0]['id'] if bl.get('bounties') else 0
    verif('bounty ouverte, séquestre 20 €', bl['bounties'][0]['statut'] == 'ouvert' and bl['bounties'][0]['contributeurCents'] == 1800 and 'email' not in json.dumps(bl), bl)
    s, d = intrus.post('/api/boutique.php', {'action': 'bounty_attribuer', 'id': bid, 'email': 'intrus@exemple.fr'}); verif('seul l\'auteur attribue', s == 400)
    s, d = parrain.post('/api/boutique.php', {'action': 'bounty_attribuer', 'id': bid, 'email': 'parrain@exemple.fr'}); verif('pas d\'auto-attribution de bounty', s == 400)
    s, d = parrain.post('/api/boutique.php', {'action': 'bounty_attribuer', 'id': bid, 'email': 'contributrice@exemple.fr'})
    verif('bounty 90/10 : 18 € / 2 €', s == 200 and d['contributeurCents'] == 1800 and d['alphabetteCents'] == 200, d)
    seq = fdb().execute("SELECT SUM(montant_centimes) FROM ecritures WHERE type IN ('sequestre_bounty','sequestre_libere')").fetchone()[0]
    verif('séquestre soldé à zéro', seq == 0, seq)
    s, d = parrain.post('/api/boutique.php', {'action': 'bounty_attribuer', 'id': bid, 'email': 'autre@exemple.fr'}); verif('bounty déjà attribuée', s == 400)
    s, d = parrain.post('/api/boutique.php', {'action': 'bounty_annuler', 'id': bid}); verif('annulation : admin seulement', s in (403, 503))

    print('9. Essai 7 jours sans carte, invitation, accès')
    essayeur = connecter_finance('essai@exemple.fr')
    s, d = essayeur.post('/api/affiliation.php', {'action': 'essai', 'app': APP}); verif('essai 7 jours', s == 200, d)
    c = fdb(); c.execute('UPDATE essais SET fin = 1 WHERE compte_id = ?', (compte('essai@exemple.fr'),)); c.commit(); c.close()
    s, d = essayeur.post('/api/affiliation.php', {'action': 'essai', 'app': APP}); verif('1 essai à vie par (compte, appli)', s == 409 and d.get('code') == 'essai_deja_utilise', d)
    s, d = eleve.post('/api/affiliation.php', {'action': 'essai', 'app': APP}); verif('pas d\'essai si accès payant', s == 409)
    s, d = Client().get(f'/api/affiliation.php?invite={code_u}'); verif('invitation valide sans rien révéler', d == {'valide': True, 'joursOfferts': 90}, d)

    print('10. Labo communautaire : juge, doublons, statuts, jours .fr, code HMAC')
    labo = inscrire('testeuse@exemple.fr', '127.80.0.1')
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'contribuer', 'type': 'avis', 'app': APP, 'texte': 'Le quiz est clair et rapide, les questions sont bien choisies pour les enfants.'})
    verif('avis validé : +1 pt +1 j', s == 200 and d['statut'] == 'validee' and d['recompense']['jours'] == 1 and d['recompense']['points10'] == 10, d)
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'contribuer', 'type': 'avis', 'app': APP, 'texte': 'Le quiz est clair et rapide, les questions sont bien choisies pour les enfants !'})
    verif('anti-doublon > 80 %', s == 200 and d['statut'] == 'doublon' and d['similarite'] > 0.8, d)
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'contribuer', 'type': 'avis', 'app': APP, 'texte': 'Écrivez-moi à moi@exemple.fr pour en parler, vraiment.'})
    verif('données personnelles refusées', d['statut'] == 'refusee', d)
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'contribuer', 'type': 'avis', 'texte': 'court'}); verif('trop court refusé', d['statut'] == 'refusee')
    erreurs = [{'message': f'TypeError {k}', 'source': 'https://alphabette.eu/app.js?jeton=secret', 'ligne': k} for k in range(12)]
    capture = 'data:image/png;base64,' + base64.b64encode(png_minuscule()).decode()
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'contribuer', 'type': 'bug', 'app': APP, 'texte': 'Le bouton Suivant ne répond plus après la question 3 sur téléphone.', 'erreurs': erreurs, 'capture': capture})
    verif('bug Pro : en attente de confirmation', s == 200 and d['statut'] == 'en_attente', d); bug = d['id']
    row = cdb().execute('SELECT erreurs, capture FROM labo_contribs WHERE id = ?', (bug,)).fetchone()
    verif('10 erreurs JS max, adresses sans paramètres', len(json.loads(row[0])) == 10 and 'jeton' not in row[0] and row[1] == 1, row)
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'contribuer', 'type': 'bug', 'texte': 'Une capture qui n\'en est pas une, vraiment pas.', 'capture': 'data:image/png;base64,QUJD'}); verif('capture invalide refusée', s == 400)
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'contribuer', 'type': 'idee', 'app': APP, 'texte': 'Ajouter un mode duo pour jouer à deux sur le même téléphone.'}); idee = d['id']
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'decider', 'id': bug, 'decision': 'bug_confirme'}); verif('décision : admin seulement', s == 401)
    s, d = adm.post('/api/createurs/communaute.php', {'action': 'decider', 'id': bug, 'decision': 'bug_confirme'}); verif('bug confirmé : +5 pts +5 j', s == 200 and d['jours'] == 5 and d['points10'] == 50, d)
    s, d = adm.post('/api/createurs/communaute.php', {'action': 'decider', 'id': bug, 'decision': 'bug_confirme'}); verif('confirmation idempotente', d.get('deja') is True, d)
    s, d = adm.post('/api/createurs/communaute.php', {'action': 'decider', 'id': idee, 'decision': 'idee_deployee'}); verif('idée déployée ×1,5 (Bêta-Testeur) : +22,5 pts +30 j', d['jours'] == 30 and d['points10'] == 225, d)
    s, moi = labo.get('/api/createurs/communaute.php?moi=1'); verif('statut Testeur Or ×2, 36 jours', moi['statut'] == 'Testeur Or' and moi['multiplicateur'] == 2 and moi['joursFr'] == 36, moi)
    s, d = adm.get(f'/api/createurs/communaute.php?prompt_bug={bug}'); verif('export prompt IA (admin)', s == 200 and 'TypeError 9' in d['prompt'] and 'double barre' in d['prompt'], d)
    for k in range(5): adm.post('/api/createurs/communaute.php', {'action': 'duel_creer', 'question': f'Couleur {k} ?', 'a': 'Bleu', 'b': 'Vert'})
    duels = labo.get('/api/createurs/communaute.php?duels=1')[1]['duels']
    for x in duels: s, d = labo.post('/api/createurs/communaute.php', {'action': 'duel', 'duel': x['id'], 'choix': 'a'})
    verif('5 micro-duels → +1 j', d['duelsCetteSemaine'] == 5 and d['jourGagne'] is True, d)
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'duel', 'duel': duels[0]['id'], 'choix': 'b'}); verif('un vote par duel', s == 409)
    s, d = adm.post('/api/createurs/communaute.php', {'action': 'mission_creer', 'titre': 'Tester le quiz sur tablette', 'app': APP}); mid = d['id']
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'contribuer', 'type': 'mission', 'mission': mid, 'app': APP, 'texte': 'Sur tablette, tout s\'affiche bien mais le texte est un peu petit.'})
    s, d = adm.post('/api/createurs/communaute.php', {'action': 'decider', 'id': d['id'], 'decision': 'valider'}); verif('Mission Flash : +7 j', d['jours'] == 7, d)
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'contribuer', 'type': 'mission', 'mission': mid, 'texte': 'Deuxième participation à la même mission flash.'}); verif('une participation par mission', s == 409)
    # Série de 4 semaines : contributions validées les 3 semaines précédentes
    uid = cdb().execute("SELECT id FROM users WHERE email = 'testeuse@exemple.fr'").fetchone()[0]
    c = cdb()
    for k in (1, 2, 3):
        w = (datetime.now(timezone.utc) - timedelta(weeks=k)).strftime('%G-W%V')
        c.execute("INSERT INTO labo_contribs (userId, appId, type, texte, statut, semaine, createdAt, decidedAt) VALUES (?, '', 'avis', ?, 'validee', ?, 0, 0)", (uid, f'ancien {k}', w))
    c.execute('UPDATE labo_jauge SET total = 99'); c.commit(); c.close()
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'contribuer', 'type': 'avis', 'app': 'iadebat', 'texte': 'IA Débat : les répliques arrivent vite et on voit bien qui écrit.'})
    verif('série 4 semaines : +10 j + badge Pilier', d['recompense']['pilier'] is True and d['recompense']['jours'] >= 11, d)
    verif('jauge collective 100 → +7 j aux actifs', d['recompense']['jauge'] is True, d)
    s, moi = labo.get('/api/createurs/communaute.php?moi=1'); verif('jours cumulés', moi['joursFr'] == 36 + 1 + 7 + 1 + 10 + 7 and moi['pilier'], moi)
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'convertir', 'jours': 1000}); verif('conversion limitée', s == 400)
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'convertir', 'jours': 30}); code_j = d.get('code', '')
    verif('code promo JFR signé HMAC-SHA256', s == 200 and re.fullmatch(r'JFR-30-[a-f0-9]{16}-[a-f0-9]{16}', code_j) and d['reste'] == moi['joursFr'] - 30, d)
    fin_labo = connecter_finance('testeuse@exemple.fr')
    s, d = fin_labo.post('/api/boutique.php', {'action': 'utiliser_code_jours', 'code': code_j[:-1] + ('0' if code_j[-1] != '0' else '1'), 'app': APP}); verif('code falsifié refusé', s == 400)
    s, d = fin_labo.post('/api/boutique.php', {'action': 'utiliser_code_jours', 'code': code_j, 'app': APP}); verif('30 jours .fr offerts', s == 200 and d['jours'] == 30, d)
    s, d = intrus.post('/api/boutique.php', {'action': 'utiliser_code_jours', 'code': code_j, 'app': APP}); verif('code à usage unique', s == 409)
    for k in range(4): adm.post('/api/createurs/communaute.php', {'action': 'roadmap_creer', 'titre': f'Fonction {k}'})
    items = [i for col in labo.get('/api/createurs/communaute.php?roadmap=1')[1]['colonnes'].values() for i in col]
    for i in items[:3]: s, d = labo.post('/api/createurs/communaute.php', {'action': 'voter_roadmap', 'item': i['id']})
    verif('vote pondéré par le statut (×2)', d['poids'] == 2, d)
    s, d = labo.post('/api/createurs/communaute.php', {'action': 'voter_roadmap', 'item': items[3]['id']}); verif('3 votes au maximum', s == 409)
    s, d = Client().get('/api/createurs/communaute.php?hall=1'); verif('Hall of Fame : pseudo, jamais d\'e-mail', d['contributeurs'] and 'testeuse' in d['contributeurs'][0]['pseudo'] and '@' not in json.dumps(d), d)
    labo.post('/api/createurs/communaute.php', {'action': 'hall', 'visible': False})
    s, d = Client().get('/api/createurs/communaute.php?hall=1'); verif('retrait du Hall of Fame', all('testeuse' not in x['pseudo'] for x in d['contributeurs']))
    serveur2 = lancer(PORT2, {'ALPHABETTE_JUGE_REPONSE': '{"verdict":"valide"}'})
    l2 = inscrire('juge@exemple.fr', '127.81.0.1', client=Client('127.81.0.1', PORT2))
    s, d = l2.post('/api/createurs/communaute.php', {'action': 'contribuer', 'type': 'avis', 'texte': 'Réponse du juge incomplète : la décision revient à un humain.'})
    verif('juge IA : JSON non conforme → décision humaine', d.get('statut') == 'a_verifier' and d['juge']['source'] == 'ia_invalide', d)
    serveur2.terminate(); serveur2.wait()
    PORT3 = port_libre(); serveur2 = lancer(PORT3, {'ALPHABETTE_JUGE_REPONSE': '{"verdict":"refuse","raison":"Hors sujet."}'})
    l2.port = PORT3
    s, d = l2.post('/api/createurs/communaute.php', {'action': 'contribuer', 'type': 'avis', 'texte': 'Un texte que le juge IA strict va refuser pour la recette.'})
    verif('juge IA : JSON strict respecté', d.get('statut') == 'refusee' and d['juge'] == {'verdict': 'refuse', 'raison': 'Hors sujet.', 'source': 'ia'}, d)

    print('11. Concours de recrutement, badge, lettre d\'information')
    s, d = Client().get('/api/createurs/recrutement.php?concours=' + time.strftime('%Y-%m', time.gmtime()))
    verif('concours : top 10 (pseudos seulement)', s == 200 and d['top'] and d['top'][0]['filleuls'] == 1 and '@' not in json.dumps(d), d)
    s, d = adm.post('/api/createurs/recrutement.php', {'action': 'clore', 'mois': time.strftime('%Y-%m', time.gmtime())}); verif('mois en cours : pas de clôture', s == 409)
    mois_passe = (datetime.now(timezone.utc).replace(day=1) - timedelta(days=1)).strftime('%Y-%m')
    c = cdb(); c.execute('UPDATE users SET verifiedAt = verifiedAt - 40 * 86400 WHERE sponsorCode IS NOT NULL'); c.commit(); c.close()
    # le parrain gagnant doit avoir une appli : il dépose et l'admin valide
    corps2 = corps.replace(b'Quiz du Lot 5', b'Appli du parrain')
    s, d = parrain_c.req('POST', '/api/createurs/soumissions.php', corps2, entetes={'Content-Type': f'multipart/form-data; boundary={b}'}); app_p = d.get('id')
    adm.post('/api/createurs/admin.php', {'action': 'valider', 'id': app_p})
    s, d = adm.post('/api/createurs/recrutement.php', {'action': 'clore', 'mois': mois_passe})
    verif('n° 1 : boost 15 jours (file d\'attente si les 4 places sont prises)', s == 200 and d['boost'] and fdb().execute("SELECT fin - debut FROM boosts WHERE origine = 'concours'").fetchone()[0] == 15 * 86400, d)
    s, d = adm.post('/api/createurs/recrutement.php', {'action': 'clore', 'mois': mois_passe})
    verif('un seul boost de concours par mois', fdb().execute("SELECT COUNT(*) FROM boosts WHERE origine = 'concours'").fetchone()[0] == 1)
    s, h, svg = Client().req('GET', f'/api/badge.php?slug={APP}', brut=True)
    verif('badge SVG réel (nom, statut .fr, avis)', s == 200 and h['content-type'].startswith('image/svg+xml') and b'Quiz du Lot 5' in svg and b'Sur Alphabette.fr' in svg and b'10' in svg and 'set-cookie' not in h, svg[:200])
    s, h, svg = Client().req('GET', '/api/badge.php?slug=<script>', brut=True); verif('badge : injection impossible', b'<script' not in svg)
    s, d = Client().post('/api/newsletter.php', {'action': 'inscrire', 'email': 'lecteur@exemple.fr'}); verif('newsletter : double confirmation', s == 200)
    lien = re.search(r'(/api/newsletter\.php\?confirmer=[^\s]+)', open(os.path.join(MAILF, 'lecteur@exemple.fr.txt'), encoding='utf-8').read()).group(1)
    s, h, page = Client().req('GET', lien, brut=True); verif('inscription confirmée', s == 200 and 'confirmée' in page.decode())
    s, d = Client().get('/api/newsletter.php?admin'); verif('admin newsletter protégée', s in (403, 503))
    s, d = Client().req('GET', '/api/newsletter.php?admin', entetes={'X-Admin-Password': ADMIN_F}); verif('1 inscrit confirmé', d.get('confirmes') == 1, d)
    s, d = Client().req('POST', '/api/newsletter.php', {'action': 'envoyer', 'sujet': 'Nouvelles du Labo', 'texte': 'Trois nouvelles applis cette semaine sur le Laboratoire.'}, entetes={'X-Admin-Password': ADMIN_F})
    verif('envoi réel avec désinscription en un clic', d.get('envoyes') == 1 and 'desinscrire=' in open(os.path.join(MAILF, 'lecteur@exemple.fr.txt'), encoding='utf-8').read(), d)
    s, d = Client().req('POST', '/api/newsletter.php', {'action': 'envoyer', 'sujet': 'Encore', 'texte': 'Un second envoi le même jour doit être refusé.'}, entetes={'X-Admin-Password': ADMIN_F})
    verif('un envoi par 24 h', s == 429)

    print('12. Invariants comptables (tout en centimes entiers)')
    db = fdb()
    for abo, total, cre_ in db.execute("SELECT abonnement_id, SUM(CASE WHEN montant_centimes > 0 THEN montant_centimes ELSE 0 END), SUM(CASE WHEN type = 'vente' OR type = 'vente_sans_createur' THEN montant_centimes ELSE 0 END) FROM ecritures WHERE abonnement_id IS NOT NULL GROUP BY abonnement_id").fetchall():
        verif(f'abonnement {abo} : 1500 = 1000 créateur + 500 (Alphabette + affiliation)', total == 1500 and cre_ == 1000, (abo, total, cre_))
    verif('aucune part Alphabette négative', db.execute("SELECT COUNT(*) FROM ecritures WHERE type = 'commission' AND montant_centimes < 0 AND abonnement_id NOT IN (SELECT id FROM abonnements WHERE statut = 'rembourse')").fetchone()[0] == 0)
    verif('montants entiers seulement', db.execute("SELECT COUNT(*) FROM ecritures WHERE typeof(montant_centimes) <> 'integer'").fetchone()[0] == 0)
finally:
    serveur.terminate()
    if serveur2: serveur2.terminate()
    shutil.rmtree(TMP, ignore_errors=True)

print(f'\n{ok_n} vérifications réussies, {len(ko)} échec(s)')
sys.exit(1 if ko else 0)
