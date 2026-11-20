#!/usr/bin/env python3
"""
Tests de api/paiement.php (Pass, Pass Découverte, Pass Cadeau, crédits IA Débat, Mécènes),
du relais api/iadebat-proxy.php (Pass et crédits en mode Premium) et de la Salle d'embarquement
(api/collectif.php). Rien ne sort de la machine : faux Stripe et faux OpenRouter locaux.

    python3 tests/paiement/test_paiement.py
"""
import hashlib, hmac, json, os, shutil, socket, subprocess, sys, tempfile, threading, time, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
JETON_INSTALLATION = os.environ.get('JETON_INSTALLATION_PAIEMENT', '')
SESSIONS = {}
CREDIT_OR = {'total': 5.0}

def port_libre():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

class Faux(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def envoyer(self, code, d):
        b = json.dumps(d).encode(); self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path.startswith('/v1/checkout/sessions?'):
            return self.envoyer(200 if self.headers.get('Authorization', '').startswith('Bearer rk_test_') else 401, {'data': []})
        if self.path.startswith('/v1/checkout/sessions/'):
            sid = self.path.split('/')[-1]
            return self.envoyer(200, SESSIONS[sid]) if sid in SESSIONS else self.envoyer(404, {'error': {'message': 'No such session'}})
        if self.path == '/api/v1/key':
            return self.envoyer(200, {'data': {'limit_remaining': 10, 'is_free_tier': False}})
        if self.path == '/api/v1/credits':
            return self.envoyer(200, {'data': {'total_credits': CREDIT_OR['total'], 'total_usage': 0}})
        self.envoyer(404, {})

def session(sid, montant, ref=None, paye=True, produit=None):
    s = {'id': sid, 'object': 'checkout.session', 'status': 'complete' if paye else 'open', 'payment_status': 'paid' if paye else 'unpaid',
         'amount_total': montant, 'currency': 'eur', 'client_reference_id': ref, 'metadata': {'produit': produit} if produit else {},
         'customer_details': {'email': 'acheteur@example.org'}}
    SESSIONS[sid] = s
    return s

OK = 0
ECHECS = []
def verifier(cond, nom):
    global OK
    if cond: OK += 1; print('  ✓', nom)
    else: ECHECS.append(nom); print('  ✗', nom)

def main():
    tmp = tempfile.mkdtemp(prefix='paiement-')
    # Comme chez OVH : ~/alphabette/eu/api/… (les données privées vont dans ~/alphabette-…, hors du site).
    maison = os.path.join(tmp, 'maison'); site = os.path.join(maison, 'alphabette', 'eu'); api = os.path.join(site, 'api'); os.makedirs(api)
    journal = os.path.join(tmp, 'mails.jsonl')
    for f in ['serveur/php/paiement.php', 'serveur/php/iadebat-proxy.php', 'labo/serveur/collectif.php']:
        shutil.copy(os.path.join(RACINE, f), api)
    reglages = json.load(open(os.path.join(RACINE, 'data/paiements.json'), encoding='utf-8'))
    json.dump({'pricing': {'perApp': 15, 'ecosystem': 40}}, open(os.path.join(api, 'config.json'), 'w'))
    json.dump({'apps': [
        {'id': 'iadebat', 'slug': 'iadebat', 'name': 'IA Débat', 'status': 'actif'},
        {'id': 'infos-perso', 'slug': 'infos-perso', 'name': 'Info Perso', 'status': 'actif'},
        {'id': 'bonplansenior', 'slug': 'bonplansenior', 'name': 'Senior Bon Plan', 'status': 'actif', 'gratuit': True},
        {'id': 'c-test', 'slug': 'c-test', 'name': 'Appli de créateur', 'status': 'actif', 'communaute': True},
    ]}, open(os.path.join(api, 'apps.json'), 'w'))
    json.dump(reglages, open(os.path.join(api, 'paiements.json'), 'w'))

    pf = port_libre(); faux = ThreadingHTTPServer(('127.0.0.1', pf), Faux)
    threading.Thread(target=faux.serve_forever, daemon=True).start()
    pp = port_libre()
    env = dict(os.environ, HOME=maison, ALPHABETTE_STRIPE_BASE=f'http://127.0.0.1:{pf}', IADEBAT_OPENROUTER_BASE=f'http://127.0.0.1:{pf}', ALPHABETTE_MAIL_JOURNAL=journal)
    php = subprocess.Popen(['php', '-S', f'127.0.0.1:{pp}', '-t', site], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{pp}/api'
    for _ in range(50):
        try: urllib.request.urlopen(base + '/paiement.php?etat', timeout=1); break
        except Exception: time.sleep(.1)

    def req(fichier, corps=None, requete='', entetes=None, brut=None):
        url = f'{base}/{fichier}' + (('?' + requete) if requete else '')
        data = brut if brut is not None else (json.dumps(corps).encode() if corps is not None else None)
        r = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json', **(entetes or {})}, method='POST' if data is not None else 'GET')
        try:
            with urllib.request.urlopen(r, timeout=10) as x: t = x.read().decode(); code = x.status
        except urllib.error.HTTPError as e: t = e.read().decode(); code = e.code
        try: return code, json.loads(t)
        except Exception: return code, t
    P = lambda corps, **k: req('paiement.php', corps, **k)
    R = lambda corps, **k: req('iadebat-proxy.php', corps, **k)
    def mails(): return [json.loads(l) for l in open(journal, encoding='utf-8')] if os.path.exists(journal) else []

    try:
        print('Fermé tant que rien n\'est branché')
        c, d = P(None, requete='etat')
        verifier(c == 200 and not any(d['ouvert'].values()), 'aucune offre ouverte sans clé Stripe ni lien')
        verifier(d['decouverte']['ouverte'] is False, 'Pass Découverte fermé sans relais IA Débat alimenté')
        verifier(set(d['applis_pass']) == {'iadebat', 'infos-perso'}, 'Pass 15 € : seulement les applis payantes d\'Alphabette')
        c, d = P({'action': 'commander', 'produit': 'pass_ecosysteme'})
        verifier(c == 503 and d.get('ferme'), 'commande refusée tant que le paiement est fermé')

        print('Pass Découverte 48 h')
        os.makedirs(os.path.join(maison, 'alphabette-iadebat'))
        json.dump({'cle': 'sk-or-v1-faux', 'secret': 'x' * 40}, open(os.path.join(maison, 'alphabette-iadebat', 'config.json'), 'w'))
        c, d = P(None, requete='etat')
        verifier(d['decouverte']['ouverte'] is True and d['decouverte']['premium_par_jour'] == 3, 'ouvert dès que le relais a sa clé')
        avant = int(time.time() * 1000)
        c, dec = P({'action': 'decouverte'})
        verifier(c == 200 and abs((dec['fin'] - dec['debut']) - 48 * 3600 * 1000) < 1 and dec['debut'] >= avant - 2000, 'exactement 48 h')
        c, d = P({'action': 'decouverte'})
        verifier(c == 429, 'un seul Pass Découverte par connexion et par jour')
        c, d = P({'action': 'verifier', 'jeton': dec['jeton']})
        verifier(d['valide'] and d['offre'] == 'decouverte', 'jeton signé valide')
        faux_jeton = dec['jeton'][:-3] + ('AAA' if not dec['jeton'].endswith('AAA') else 'BBB')
        c, d = P({'action': 'verifier', 'jeton': faux_jeton})
        verifier(not d['valide'], 'jeton modifié refusé')

        print('Relais IA Débat : Pass Découverte en Premium')
        c, e = R(None, requete='etat', entetes={'X-Alphabette-Pass': dec['jeton']})
        verifier(e['premium']['pass']['quota'] == 3 and e['premium']['restants'] == 1 and e['premium']['total'] == 4, 'état : 1 offert + 3 du Pass (« restants » inchangé pour les anciennes versions)')
        c, d = R({'action': 'debut', 'sujet': 's1', 'mode': 'premium', 'pass': dec['jeton']})
        verifier(c == 200 and d['source'] == 'offert', '1er débat Premium : le débat offert')
        sources = [R({'action': 'debut', 'sujet': f's{i}', 'mode': 'premium', 'pass': dec['jeton']})[1].get('source') for i in range(3)]
        verifier(sources == ['pass'] * 3, 'puis 3 débats du Pass Découverte')
        c, d = R({'action': 'debut', 'sujet': 's9', 'mode': 'premium', 'pass': dec['jeton']})
        verifier(c == 429 and 'Pass' in d['erreur'], 'au-delà : message clair, Mode Gratuit rappelé')
        c, d = R({'action': 'debut', 'sujet': 's10', 'mode': 'premium', 'pass': faux_jeton})
        verifier(c == 429 and d.get('premium'), 'Pass falsifié : aucun débat Premium en plus')
        c, d = R({'action': 'debut', 'sujet': 'g', 'mode': 'gratuit', 'pass': dec['jeton']})
        verifier(c == 200 and d['source'] == 'gratuit', 'Mode Gratuit inchangé')

        print('Installation de la clé Stripe (lien à jeton secret)')
        c, d = P({'jeton': 'mauvais', 'stripe_cle': 'rk_test_' + 'a' * 30}, requete='installer')
        verifier(c == 403, 'mauvais jeton refusé')
        if JETON_INSTALLATION:
            c, d = P({'jeton': JETON_INSTALLATION, 'stripe_cle': 'rk_test_' + 'a' * 30, 'webhook_secret': 'whsec_' + 'b' * 30}, requete='installer')
            verifier(c == 200 and d['cle'] and d['webhook'], 'clé et secret enregistrés hors du site')
        else:
            json.dump({'stripe_cle': 'rk_test_' + 'a' * 30, 'webhook_secret': 'whsec_' + 'b' * 30}, open(os.path.join(maison, 'alphabette-paiements', 'config.json'), 'w'))
            print('  (JETON_INSTALLATION_PAIEMENT absent : configuration écrite directement)')
        verifier('rk_test_' not in open(os.path.join(RACINE, 'serveur/php/paiement.php'), encoding='utf-8').read(), 'aucune clé dans le code')
        reglages['liens'] = {k: f'https://buy.stripe.com/test_{k}00' for k in reglages['liens']}
        json.dump(reglages, open(os.path.join(api, 'paiements.json'), 'w'))
        c, d = P(None, requete='etat')
        verifier(all(d['ouvert'].values()), 'offres ouvertes une fois la clé et les liens posés')

        print('Pass Cadeau 40 €')
        c, d = P({'action': 'commander', 'produit': 'pass_ecosysteme', 'pour': 'cadeau', 'message': 'Joyeux anniversaire <b>Maman</b> !'})
        verifier(c == 200 and d['lien'].startswith('https://buy.stripe.com/test_pass_ecosysteme00?client_reference_id=cmd_'), 'lien Stripe + référence de commande')
        ref = d['lien'].split('=')[1]
        session('cs_test_cadeau000000001', 4000, ref)
        c, cad = P({'action': 'confirmer', 'session_id': 'cs_test_cadeau000000001'})
        verifier(c == 200 and cad['type'] == 'cadeau' and cad['code'].startswith('ALPHA-') and len(cad['code']) == 20, 'carte cadeau : code ALPHA-XXXX-XXXX-XXXX')
        verifier(cad['message'] == 'Joyeux anniversaire Maman !', 'petit mot nettoyé (pas de HTML)')
        n = len(mails())
        c, cad2 = P({'action': 'confirmer', 'session_id': 'cs_test_cadeau000000001'})
        verifier(cad2['code'] == cad['code'] and len(mails()) == n, 'recharger la page : même code, pas de 2e e-mail')
        m = [x for x in mails() if x['a'] == 'acheteur@example.org']
        verifier(any(cad['code'] in x['corps'] for x in m), 'code envoyé par e-mail à l\'acheteur')
        verifier(any(x['a'] == 'azertylm@gmail.com' and 'CADEAU' in x['sujet'] for x in mails()), 'Valentin prévenu de la vente')
        c, a1 = P({'action': 'activer', 'code': cad['code'].lower().replace('-', ' ')})
        an = time.time() + 365 * 86400
        verifier(c == 200 and a1['offre'] == 'ecosysteme' and abs(a1['fin'] / 1000 - an) < 2 * 86400, 'activation (même tapé en minuscules) : 12 mois à partir d\'aujourd\'hui')
        for _ in range(2): P({'action': 'activer', 'code': cad['code']})
        c, d = P({'action': 'activer', 'code': cad['code']})
        verifier(c == 410, '3 appareils au plus')
        c, d = P({'action': 'activer', 'code': 'ALPHA-0000-0000-0000'})
        verifier(c == 404, 'code inconnu')

        print('Pass 15 € pour soi (IA Débat)')
        c, d = P({'action': 'commander', 'produit': 'pass_app', 'pour': 'moi', 'app': 'bonplansenior'})
        verifier(c == 400, 'appli gratuite : pas de Pass à vendre')
        c, d = P({'action': 'commander', 'produit': 'pass_app', 'pour': 'moi', 'app': 'iadebat'})
        session('cs_test_passapp00000001', 1500, d['lien'].split('=')[1])
        c, pa = P({'action': 'confirmer', 'session_id': 'cs_test_passapp00000001'})
        verifier(c == 200 and pa['type'] == 'pass' and pa['app'] == 'iadebat' and pa['code'].startswith('ALPHA-'), 'Pass actif dans ce navigateur + code pour les autres appareils')
        c, e = R(None, requete='etat', entetes={'X-Alphabette-Pass': pa['jeton']})
        verifier(e['premium']['pass']['quota'] == reglages['pass']['premium_par_jour'], 'le relais reconnaît le Pass IA Débat')
        c, d = P({'action': 'commander', 'produit': 'pass_app', 'app': 'infos-perso'})
        session('cs_test_passinfo0000001', 1500, d['lien'].split('=')[1])
        c, pi = P({'action': 'confirmer', 'session_id': 'cs_test_passinfo0000001'})
        c, e = R(None, requete='etat', entetes={'X-Alphabette-Pass': pi['jeton']})
        verifier(e['premium']['pass'] is None, 'un Pass Info Perso n\'ouvre pas le Premium d\'IA Débat')

        print('Paiement direct (bouton de la barre, sans commande)')
        session('cs_test_direct000000001', 1500, None)
        c, d = P({'action': 'confirmer', 'session_id': 'cs_test_direct000000001'})
        verifier(c == 200 and d['type'] == 'choisir_app' and 'iadebat' in d['applis'], 'Pass 15 € : on demande l\'application')
        c, d = P({'action': 'confirmer', 'session_id': 'cs_test_direct000000001', 'app': 'infos-perso'})
        verifier(c == 200 and d['type'] == 'pass' and d['app'] == 'infos-perso', 'puis le Pass est délivré')
        c, d = P({'action': 'confirmer', 'session_id': 'cs_test_direct000000001', 'app': 'iadebat'})
        verifier(d['app'] == 'infos-perso', 'le choix ne peut pas être changé ensuite')

        print('Contrôles de paiement')
        session('cs_test_impaye00000001', 4000, None, paye=False)
        c, d = P({'action': 'confirmer', 'session_id': 'cs_test_impaye00000001'})
        verifier(c == 402 and d.get('en_attente'), 'session non payée : rien n\'est délivré')
        c, d = P({'action': 'commander', 'produit': 'pass_ecosysteme', 'pour': 'moi'})
        session('cs_test_troppeu0000001', 1500, d['lien'].split('=')[1])
        c, d = P({'action': 'confirmer', 'session_id': 'cs_test_troppeu0000001'})
        verifier(c == 400, 'montant inférieur au prix : refusé')
        c, d = P({'action': 'confirmer', 'session_id': 'cs_test_inexistant000001'})
        verifier(c == 404, 'session inconnue chez Stripe')
        c, d = P({'action': 'confirmer', 'session_id': '../../etc/passwd'})
        verifier(c == 400, 'identifiant de session invalide')

        print('Crédits IA Débat')
        c, d = P({'action': 'commander', 'produit': 'credits_iadebat'})
        session('cs_test_credits00000001', 500, d['lien'].split('=')[1])
        c, cr = P({'action': 'confirmer', 'session_id': 'cs_test_credits00000001'})
        pm = cr.get('porte_monnaie') or ''
        verifier(c == 200 and cr['ajoutes'] == 50 and cr['solde'] == 50 and pm.startswith('PM-'), '5 € = 50 crédits, nouveau porte-monnaie')
        c, cr2 = P({'action': 'confirmer', 'session_id': 'cs_test_credits00000001'})
        verifier(cr2['solde'] == 50, 'recharger la page ne double pas les crédits')
        # Pass épuisé + offert déjà pris aujourd'hui : les crédits prennent le relais.
        c, d = R({'action': 'debut', 'sujet': 'c1', 'mode': 'premium', 'credits': pm})
        verifier(c == 200 and d['source'] == 'credits' and d['credits_restants'] == 49, '1 crédit décompté par débat Premium lancé')
        c, d = P(None, requete='solde', entetes={'X-Alphabette-Credits': pm})
        verifier(d['solde'] == 49, 'solde relu sur le serveur')
        c, e = R(None, requete='etat', entetes={'X-Alphabette-Credits': pm})
        verifier(e['premium']['credits'] == 49, 'solde visible dans l\'état du relais')
        c, d = P({'action': 'commander', 'produit': 'credits_iadebat', 'porte_monnaie': pm})
        session('cs_test_credits00000002', 500, d['lien'].split('=')[1])
        c, cr3 = P({'action': 'confirmer', 'session_id': 'cs_test_credits00000002'})
        verifier(cr3['solde'] == 99 and cr3['porte_monnaie'] is None, 'recharge sur le même porte-monnaie')
        c, d = P({'action': 'activer', 'code': pm})
        verifier(c == 200 and d['type'] == 'credits' and d['solde'] == 99, 'code PM-… : crédits retrouvés sur un autre appareil')
        CREDIT_OR['total'] = 0
        os.remove(os.path.join(maison, 'alphabette-iadebat', 'sante-credit.json'))
        c, d = R({'action': 'debut', 'sujet': 'c2', 'mode': 'premium', 'credits': pm})
        c2, s2 = P(None, requete='solde', entetes={'X-Alphabette-Credits': pm})
        verifier(c == 503 and s2['solde'] == 99, 'crédit IA du site épuisé : débat refusé, crédits conservés')
        c, d = P(None, requete='etat')
        verifier(d['decouverte']['ouverte'] is False, 'et le Pass Découverte n\'est plus proposé')
        CREDIT_OR['total'] = 5.0
        os.remove(os.path.join(maison, 'alphabette-iadebat', 'sante-credit.json'))

        print('Mécène du Labo')
        c, d = P({'action': 'commander', 'produit': 'mecene_5', 'afficher': True, 'pseudo': 'http://spam.example'})
        verifier(c == 400, 'pseudo avec lien refusé')
        c, d = P({'action': 'commander', 'produit': 'mecene_5', 'afficher': True, 'pseudo': 'Lina'})
        session('cs_test_mecene000000001', 500, d['lien'].split('=')[1])
        c, me = P({'action': 'confirmer', 'session_id': 'cs_test_mecene000000001'})
        verifier(c == 200 and me['type'] == 'mecene' and me['pseudo'] == 'Lina', 'merci + pseudo')
        c, h = P(None, requete='honneur')
        verifier(h['mecenes'] == [{'pseudo': 'Lina', 'depuis': time.strftime('%Y-%m', time.gmtime())}], 'Tableau d\'Honneur : pseudo et mois, jamais le montant')
        c, d = P({'action': 'commander', 'produit': 'mecene_libre', 'afficher': False, 'pseudo': 'Secret'})
        session('cs_test_mecene000000002', 2300, d['lien'].split('=')[1])
        P({'action': 'confirmer', 'session_id': 'cs_test_mecene000000002'})
        c, h = P(None, requete='honneur')
        verifier(len(h['mecenes']) == 1, 'case non cochée : pseudo non affiché')
        lien = next(x['corps'] for x in mails() if 'Mécène' in x['sujet']).split('Tableau d\'Honneur : ')[1].split('\n')[0]
        q = lien.split('?')[1]
        c, t = req('paiement.php', None, requete=q)
        c2, h2 = P(None, requete='honneur')
        verifier(c == 200 and 'Oui, retirer' in t and len(h2['mecenes']) == 1, 'lien de retrait : une confirmation d\'abord (rien n\'est retiré à l\'ouverture)')
        req('paiement.php', None, requete=q, brut=b'')
        c, h = P(None, requete='honneur')
        verifier(h['mecenes'] == [], 'puis le pseudo est retiré')

        print('Webhook Stripe')
        c, d = P({'action': 'commander', 'produit': 'credits_iadebat'})
        session('cs_test_webhook00000001', 500, d['lien'].split('=')[1])
        corps = json.dumps({'type': 'checkout.session.completed', 'data': {'object': SESSIONS['cs_test_webhook00000001']}}).encode()
        t = str(int(time.time()))
        sig = hmac.new(('whsec_' + 'b' * 30).encode(), (t + '.').encode() + corps, hashlib.sha256).hexdigest()
        c, d = req('paiement.php', None, requete='webhook', brut=corps, entetes={'Stripe-Signature': f't={t},v1=deadbeef'})
        verifier(c == 400, 'signature invalide refusée')
        n = len(mails())
        c, d = req('paiement.php', None, requete='webhook', brut=corps, entetes={'Stripe-Signature': f't={t},v1={sig}'})
        verifier(c == 200 and len(mails()) == n + 2, 'événement signé traité (e-mails acheteur + Valentin)')
        c, d = P({'action': 'confirmer', 'session_id': 'cs_test_webhook00000001'})
        verifier(d['solde'] == 50 and len(mails()) == n + 2, 'puis la page « merci » relit le même résultat, sans doublon')

        print('Salle d\'embarquement (collectif.php)')
        C = lambda corps, **k: req('collectif.php', corps, **k)
        base_e = {'action': 'proposer', 'formulaire': 'embarquement', 'regles': [True] * 4, 'duree': 5000, 'nom': 'Recettes Anti-Gaspi',
                  'url': 'https://recettes.example.org', 'depot': '', 'dossier': '', 'description': 'Des recettes avec ce qui reste au frigo. Pour les familles pressées.',
                  'categorie': 'Autre', 'pseudo': 'Lina', 'contact': 'lina@example.org', 'site_web': ''}
        c, d = C(base_e)
        verifier(c == 200 and d['id'].startswith('prop_'), 'proposition enregistrée')
        f = os.path.join(maison, 'alphabette-labo-donnees', 'collectif', 'propositions.json')
        props = json.load(open(f))['propositions'] if os.path.exists(f) else []
        verifier(props and props[-1]['formulaire'] == 'embarquement' and 'alphabette_eu_seulement_jamais_fr' in props[-1]['regles_acceptees'], 'file privée : règles acceptées notées')
        c, d = C(None, requete='propositions=1')
        verifier(all('contact' not in p for p in d['propositions']), 'lecture des agents : sans le contact')
        c, d = C(dict(base_e, regles=[True, True, True, False], url='https://autre.example.org'))
        verifier(c == 400, 'une règle non cochée : refusé')
        c, d = C(dict(base_e, duree=400, url='https://robot.example.org'))
        verifier(c == 200 and d['id'] == 'ignore', 'formulaire rempli trop vite (robot) : ignoré')
        c, d = C(dict(base_e, site_web='http://spam', url='https://robot2.example.org'))
        verifier(d.get('id') == 'ignore', 'piège à robots (honeypot)')
        c, d = C(dict(base_e, url='https://x.example.org', description='Super https://a.example https://b.example offre'))
        verifier(c == 400, 'plus d\'un lien dans la description : refusé')
        c, d = C(dict(base_e, url='https://y.example.org'), entetes={'Origin': 'https://pirate.example'})
        verifier(c == 403, 'envoi depuis un autre site : refusé')
        c, d = C(dict(base_e, url='', depot='lina/recettes', dossier='dist'))
        verifier(c == 200, 'dépôt GitHub accepté (hébergement isolé)')
    finally:
        php.terminate(); faux.shutdown(); shutil.rmtree(tmp, ignore_errors=True)
    print(f'\n{OK} vérifications réussies, {len(ECHECS)} échec(s)')
    if ECHECS: print('Échecs :', *ECHECS, sep='\n  - '); sys.exit(1)

if __name__ == '__main__':
    main()
