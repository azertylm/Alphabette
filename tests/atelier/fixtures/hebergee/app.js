const sortie = document.getElementById('valeur');
let n = Number(localStorage.getItem('compteur') || 0);
sortie.textContent = String(n);
document.getElementById('plus').addEventListener('click', () => { n += 1; localStorage.compteur = String(n); sortie.textContent = String(n); });
// Ce que l'appli voit du site qui l'héberge (doit rester vide / refusé) :
const vu = [];
try { vu.push('cookie=' + document.cookie); } catch (e) { vu.push('cookie:refusé'); }
try { vu.push('parent=' + parent.document.title); } catch (e) { vu.push('parent:refusé'); }
try { vu.push('secret=' + localStorage.getItem('secret-du-hub')); } catch (e) { vu.push('secret:refusé'); }
fetch('./donnees.json').then((r) => r.json()).then((d) => { vu.push('donnees=' + d.ok); document.getElementById('espion').textContent = vu.join(' | '); })
  .catch(() => { vu.push('donnees:échec'); document.getElementById('espion').textContent = vu.join(' | '); });
