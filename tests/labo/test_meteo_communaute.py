"""
tests/labo/test_meteo_communaute.py — Météo du Labo (file_attente), pseudo du Tableau d'Honneur, boîte à idées.
Lance un `php -S` dans un dossier temporaire (données hors du dépôt) avec labo/serveur/feedback.php et collectif.php.
Usage (racine du hub) : python3 tests/labo/test_meteo_communaute.py
"""
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
tmp = tempfile.mkdtemp()
site = os.path.join(tmp, 'a', 'b', 'site')
os.makedirs(os.path.join(site, 'api', 'labo'))
for f in ('feedback.php', 'collectif.php'):
    shutil.copy(os.path.join(RACINE, 'labo', 'serveur', f), os.path.join(site, 'api', f))
json.dump({'apps': [{'id': 'iadebat', 'url': 'https://alphabette.eu/apps/iadebat/'}, {'id': 'orbit', 'url': 'https://alphabette.eu/orbit/'}]},
          open(os.path.join(site, 'api', 'apps.json'), 'w'))
STATUTS = os.path.join(site, 'api', 'labo', 'idees-statuts.json')
json.dump({'statuts': {}}, open(STATUTS, 'w'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); PORT = s.getsockname()[1]; s.close()
php = subprocess.Popen(['php', '-S', f'127.0.0.1:{PORT}', '-t', site], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
B = f'http://127.0.0.1:{PORT}/api/'

def req(f, data=None):
    r = urllib.request.Request(B + f, data=json.dumps(data).encode() if data is not None else None, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read())

ok=0; ko=0
def check(nom, cond, info=''):
    global ok, ko
    if cond: ok+=1
    else: ko+=1; print('ÉCHEC', nom, info)
# avis + pseudo
c,d=req('feedback.php',{'action':'avis','app_id':'iadebat','rating':4,'category':'Bug','comment':'Le bouton ne marche pas','version_tested':'main','pseudo':'Mouette34','site_web':''}); check('avis pseudo', c==201, d)
c,d=req('feedback.php',{'action':'avis','app_id':'iadebat','rating':None,'category':'Idée','comment':'Ajouter un mode sombre','pseudo':'jean@mail.fr','site_web':''}); check('pseudo email refusé', c==400 and 'Pseudo' in d.get('erreur',''), d)
c,d=req('feedback.php',{'action':'avis','app_id':'iadebat','rating':None,'category':'Idée','comment':'Ajouter un mode sombre','pseudo':'0612345678','site_web':''}); check('pseudo numéro refusé', c==400, d)
c,d=req('feedback.php',{'action':'avis','app_id':'orbit','rating':5,'category':'Idée','comment':'','site_web':''}); check('note seule', c==201, d)
c,d=req('feedback.php',{'action':'avis','app_id':'orbit','rating':None,'category':'Design','comment':'Texte trop petit','site_web':''}); check('avis sans pseudo', c==201, d)
c,d=req('feedback.php'); check('file_attente = 2', c==200 and d.get('file_attente')==2, d)
c,d=req('feedback.php?export=1'); p=[a.get('pseudo') for a in d['feedbacks']]; check('pseudo stocké', p.count('Mouette34')==1 and p.count(None)==2, p)
# idées
c,d=req('collectif.php?idees=1'); check('idées vides', c==200 and d['idees']==[], d)
c,d=req('collectif.php',{'action':'idee','titre':'Rappel des poubelles','phrase':'Me prévenir la veille du jour de collecte de ma rue.','site_web':''}); check('idée ok', c==201 and d['idee']['votes']==1, d); i1=d.get('idee',{}).get('id')
c,d=req('collectif.php',{'action':'idee','titre':'rappel des poubelles !','phrase':'Une autre phrase assez longue ici.','site_web':''}); check('doublon', c==409, d)
c,d=req('collectif.php',{'action':'idee','titre':'Pub','phrase':'Visitez www.exemple.com pour gagner','site_web':''}); check('lien refusé', c==400, d)
c,d=req('collectif.php',{'action':'idee','titre':'Contact','phrase':'Appelez-moi au 06 12 34 56 78 svp','site_web':''}); check('numéro refusé', c==400, d)
c,d=req('collectif.php',{'action':'idee','titre':'SUPER APPLI GENIALE','phrase':'VOTEZ POUR MOI TOUT DE SUITE MAINTENANT','site_web':''}); check('majuscules refusées', c==400, d)
c,d=req('collectif.php',{'action':'idee','titre':'Casino gratuit','phrase':'Une appli de casino pour tout le monde.','site_web':''}); check('mot refusé', c==400, d)
c,d=req('collectif.php',{'action':'idee','titre':'X','phrase':'court','site_web':''}); check('trop court', c==400, d)
c,d=req('collectif.php',{'action':'idee','titre':'Robot','phrase':'Je suis un robot qui remplit tout.','site_web':'http://spam'}); check('piège', c==200 and d.get('id')=='ignore', d)
c,d=req('collectif.php',{'action':'idee','titre':'Covoiturage du marché','phrase':'Trouver un voisin qui va au marché le samedi.','site_web':''}); check('idée 2', c==201, d); i2=d.get('idee',{}).get('id')
for k in range(5):
    c,d=req('collectif.php',{'action':'voter_idee','id':i2}); check(f'vote même connexion {k+1}', c==200 and d['votes']==2+k, d)
c,d=req('collectif.php',{'action':'voter_idee','id':i2}); check('6e vote même connexion refusé', c==409, d)
# 3e idée → ok puis 4e → limite
c,d=req('collectif.php',{'action':'idee','titre':'Prêt d outils','phrase':'Prêter sa perceuse aux voisins du quartier.','site_web':''}); check('idée 3', c==201, d); i3=d.get('idee',{}).get('id')
c,d=req('collectif.php',{'action':'idee','titre':'Quatrième idée','phrase':'Une idée de trop pour aujourd hui.','site_web':''}); check('limite 3/jour', c==429, d)
c,d=req('collectif.php',{'action':'voter_idee','id':'idee_1_zzzz'}); check('id invalide', c==400, d)
c,d=req('collectif.php?idees=1'); check('3 idées', len(d['idees'])==3, d)
# masquage
open(STATUTS,'w').write(json.dumps({'statuts':{i3:'masquee', i1:'retenue'}}))
c,d=req('collectif.php?idees=1'); ids=[x['id'] for x in d['idees']]; check('masquée cachée', i3 not in ids and len(ids)==2, ids)
check('statut retenue', [x for x in d['idees'] if x['id']==i1][0]['statut']=='retenue', d)
c,d=req('collectif.php',{'action':'voter_idee','id':i3}); check('vote masquée refusé', c==404, d)
php.terminate(); shutil.rmtree(tmp, ignore_errors=True)
print(f'{ok} OK, {ko} échec(s)')
sys.exit(1 if ko else 0)
