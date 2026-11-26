/**
 * Illustration « Codex de Vinci » (1200×630) : parchemin déchiré, machine de bois sur pieds en A,
 * grande roue, engrenages, manivelle, géométrie de construction, trajectoires en pointillés, livre ailé…
 * Le sommet de la machine et les accessoires changent selon le thème de l'appli. 100 % hors ligne.
 */
const INK = '#5a2c18', RED = '#a8473a';
const f1 = (n) => Math.round(n * 10) / 10;

function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

export function svgCodex({ nom, famille, seed }) {
  const R = rng(seed);
  const u = (a, b) => a + (b - a) * R();
  const o = [];
  const a = (s) => o.push(s);
  const plank = (pts, sw = 4) => { const p = pts.map(([x, y]) => `${x},${y}`).join(' '); a(`<polygon points="${p}" fill="url(#wd)" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/><polygon points="${p}" fill="url(#gr)" opacity=".55"/>`); };
  const bolt = (x, y, r = 7) => a(`<circle cx="${x}" cy="${y}" r="${r}" fill="#d9b98a" stroke="${INK}" stroke-width="2.5"/><circle cx="${x - 1.5}" cy="${y - 1.5}" r="${f1(r * 0.35)}" fill="${INK}"/>`);
  const gear = (cx, cy, r, n, spokes = 5) => {
    const pts = [];
    for (let i = 0; i < n * 4; i += 1) { const t = (2 * Math.PI * i) / (n * 4); const rr = i % 4 < 2 ? r : r * 0.86; pts.push(`${f1(cx + rr * Math.cos(t))},${f1(cy + rr * Math.sin(t))}`); }
    a(`<polygon points="${pts.join(' ')}" fill="url(#wd)" stroke="${INK}" stroke-width="4"/><polygon points="${pts.join(' ')}" fill="url(#ht)" opacity=".35"/><circle cx="${cx}" cy="${cy}" r="${f1(r * 0.72)}" fill="#f1dcb4" stroke="${INK}" stroke-width="3"/>`);
    for (let k = 0; k < spokes; k += 1) { const t = (2 * Math.PI * k) / spokes + 0.3; const d = `M${f1(cx + r * 0.16 * Math.cos(t))} ${f1(cy + r * 0.16 * Math.sin(t))}L${f1(cx + r * 0.66 * Math.cos(t))} ${f1(cy + r * 0.66 * Math.sin(t))}`; a(`<path d="${d}" stroke="url(#wd)" stroke-width="${f1(r * 0.12)}" stroke-linecap="round"/><path d="${d}" stroke="${INK}" stroke-width="2"/>`); }
    a(`<circle cx="${cx}" cy="${cy}" r="${f1(r * 0.2)}" fill="url(#wd)" stroke="${INK}" stroke-width="4"/><circle cx="${cx}" cy="${cy}" r="${f1(r * 0.07)}" fill="${INK}"/>`);
  };
  const dashed = (d) => a(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="10 12" marker-end="url(#ar)" opacity=".8"/>`);
  const spiral = (cx, cy, r, turns = 3) => { const d = []; for (let i = 0; i < 120; i += 1) { const t = (i / 120) * turns * 2 * Math.PI; const rr = (r * i) / 120; d.push(`${f1(cx + rr * Math.cos(t))} ${f1(cy + rr * Math.sin(t))}`); } a(`<path d="M${d.join('L')}" fill="none" stroke="${INK}" stroke-width="2.2" opacity=".75"/>`); };
  const scribble = (x, y, w, lines = 2) => { for (let l = 0; l < lines; l += 1) { let d = `M${x} ${y + l * 34}`; let cx = x; while (cx < x + w) { const s = Math.round(u(8, 22)); d += ` q${s / 2} ${-Math.round(u(8, 20))} ${s} ${Math.round(u(-4, 4))}`; cx += s; } a(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="2" opacity=".7"/>`); } };
  const wing = (x, y, s, flip) => a(`<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})"><path d="M0 0C40-70 120-110 210-120C180-90 175-70 190-45C160-55 140-40 140-20C115-35 90-25 85-5C60-20 30-15 0 0Z" fill="#e9cfa3" stroke="${INK}" stroke-width="4"/><path d="M10-5C70-60 140-95 205-115M30-8C80-40 120-55 188-47M50-8C90-25 110-30 140-22" fill="none" stroke="${INK}" stroke-width="2"/></g>`);
  const book = (x, y, s = 1, rot = -8) => { a(`<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">`); wing(-30, -15, 0.85, true); wing(30, -15, 0.85, false); a(`<path d="M-70-20L0-5L70-20L70 40L0 55L-70 40Z" fill="#c9845c" stroke="${INK}" stroke-width="4"/><path d="M-64-28L0-12L64-28L64 30L0 46L-64 30Z" fill="#f6e7c9" stroke="${INK}" stroke-width="3"/><path d="M0-12V46M-55-15L-8-4M-55-3L-8 8M-55 9L-8 20M8-4L55-15M8 8L55-3M8 20L55 9" stroke="${INK}" stroke-width="1.6" fill="none"/></g>`); };
  const ballFoot = (cx, cy, r) => { a(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f6ead2" stroke="${INK}" stroke-width="4"/>`); const p = []; for (let k = 0; k < 5; k += 1) { const t = ((-90 + 72 * k) * Math.PI) / 180; p.push([cx + r * 0.38 * Math.cos(t), cy + r * 0.38 * Math.sin(t)]); } a(`<polygon points="${p.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ')}" fill="${INK}"/>`); for (const [x, y] of p) a(`<path d="M${f1(x)} ${f1(y)}L${f1(cx + (x - cx) * 2.4)} ${f1(cy + (y - cy) * 2.4)}" stroke="${INK}" stroke-width="3"/>`); };
  const ballBasket = (cx, cy, r) => a(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#c9774f" stroke="${INK}" stroke-width="4"/><path d="M${cx - r} ${cy}H${cx + r}M${cx} ${cy - r}V${cy + r}M${f1(cx - r * 0.7)} ${f1(cy - r * 0.7)}Q${f1(cx - r * 0.2)} ${cy} ${f1(cx - r * 0.7)} ${f1(cy + r * 0.7)}M${f1(cx + r * 0.7)} ${f1(cy - r * 0.7)}Q${f1(cx + r * 0.2)} ${cy} ${f1(cx + r * 0.7)} ${f1(cy + r * 0.7)}" fill="none" stroke="${INK}" stroke-width="3"/>`);
  const glow = () => { a('<circle cx="1210" cy="250" r="190" fill="url(#gl)"/>'); for (const r of [120, 150, 180]) a(`<circle cx="1210" cy="250" r="${r}" fill="none" stroke="${RED}" stroke-width="3" stroke-dasharray="14 10" opacity=".6"/>`); };

  // ---------- parchemin ----------
  const W = 2400, H = 1260, edge = [];
  for (let i = 0; i < 60; i += 1) edge.push([40 + (i * (W - 80)) / 59, 40 + u(-14, 18)]);
  for (let i = 0; i < 30; i += 1) edge.push([W - 40 + u(-18, 14), 40 + (i * (H - 80)) / 29]);
  for (let i = 0; i < 60; i += 1) edge.push([W - 40 - (i * (W - 80)) / 59, H - 40 + u(-18, 14)]);
  for (let i = 0; i < 30; i += 1) edge.push([40 + u(-14, 18), H - 40 - (i * (H - 80)) / 29]);
  const EP = edge.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' ');
  for (let i = 0; i < 12; i += 1) { const x = R() < 0.5 ? u(80, 600) : u(1800, 2320), y = u(80, 1180); a(`<path d="M${Math.round(x)} ${Math.round(y)}q${Math.round(u(40, 90))} ${Math.round(u(-60, 60))} ${Math.round(u(90, 200))} ${Math.round(u(-80, 80))}" fill="none" stroke="${RED}" stroke-width="${Math.round(u(18, 40))}" stroke-linecap="round" opacity=".16" filter="url(#b20)"/>`); }
  for (const [x, y, r] of [[110, 580, 22], [2300, 620, 30], [2150, 240, 18], [260, 140, 14], [1480, 1150, 16], [2290, 1090, 40]]) a(`<circle cx="${x}" cy="${y}" r="${r}" fill="#7a4a1d" opacity=".35" filter="url(#b6)"/>`);
  a('<rect width="2400" height="1260" fill="none" stroke="#8a5a2b" stroke-width="90" opacity=".25" filter="url(#b20)"/>');
  a(`<g fill="none" stroke="${INK}" stroke-width="1.6" opacity=".5"><circle cx="740" cy="560" r="300"/><circle cx="1960" cy="760" r="210"/><circle cx="420" cy="980" r="150"/><path d="M420 400H2180M1200 70V1180M1640 700H2240M300 1080H900"/><path d="M180 230L600 120L560 520Z"/></g>`);
  spiral(2050, 420, 95); spiral(330, 640, 60, 2.5); scribble(1840, 560, 240, 2); scribble(420, 820, 150, 1);

  // ---------- machine commune ----------
  a('<g filter="url(#rf)">');
  a(`<ellipse cx="1200" cy="1105" rx="560" ry="42" fill="url(#ht)" opacity=".45"/>`);
  plank([[820, 1100], [880, 1100], [1150, 470], [1110, 450]]); plank([[1580, 1100], [1520, 1100], [1250, 470], [1290, 450]]);
  plank([[760, 1080], [1640, 1080], [1640, 1115], [760, 1115]]); plank([[930, 860], [1470, 860], [1470, 895], [930, 895]]);
  bolt(950, 877); bolt(1450, 877);
  const cx = 1200, cy = 640, RR = 300;
  a(`<circle cx="${cx}" cy="${cy}" r="${RR}" fill="url(#wd)" stroke="${INK}" stroke-width="6"/><circle cx="${cx}" cy="${cy}" r="${RR}" fill="url(#gr)" opacity=".4"/><circle cx="${cx}" cy="${cy}" r="${RR - 38}" fill="#f3e2c0" stroke="${INK}" stroke-width="4"/>`);
  for (let k = 0; k < 10; k += 1) {
    const t = (2 * Math.PI * k) / 10, tm = t + Math.PI / 10;
    a(`<path d="M${f1(cx + (RR - 38) * Math.cos(t))} ${f1(cy + (RR - 38) * Math.sin(t))}L${f1(cx + (RR - 110) * Math.cos(t))} ${f1(cy + (RR - 110) * Math.sin(t))}" stroke="${INK}" stroke-width="3"/>`);
    a(`<g transform="translate(${f1(cx + (RR - 74) * Math.cos(tm))} ${f1(cy + (RR - 74) * Math.sin(tm))}) rotate(${Math.round((tm * 180) / Math.PI + 90)})">${vignette(famille, k, u)}</g>`);
  }
  a(`<circle cx="${cx}" cy="${cy}" r="${RR - 110}" fill="none" stroke="${INK}" stroke-width="4"/>`);
  for (let k = 0; k < 6; k += 1) { const t = (2 * Math.PI * k) / 6 + 0.2; const d = `M${f1(cx + 60 * Math.cos(t))} ${f1(cy + 60 * Math.sin(t))}L${f1(cx + (RR - 110) * Math.cos(t))} ${f1(cy + (RR - 110) * Math.sin(t))}`; a(`<path d="${d}" stroke="url(#wd)" stroke-width="26" stroke-linecap="round"/><path d="${d}" stroke="${INK}" stroke-width="2.4"/>`); }
  for (let k = 0; k < 16; k += 1) { const t = (2 * Math.PI * k) / 16; bolt(Math.round(cx + (RR - 19) * Math.cos(t)), Math.round(cy + (RR - 19) * Math.sin(t)), 6); }
  gear(cx, cy, 120, 14, 6); gear(1430, 930, 95, 12, 5); gear(1330, 830, 58, 9, 4);
  a(`<path d="M1430 930L1530 990L1530 1050" fill="none" stroke="url(#wd)" stroke-width="22" stroke-linecap="round"/><path d="M1430 930L1530 990L1530 1050" fill="none" stroke="${INK}" stroke-width="3"/><rect x="1514" y="1040" width="34" height="62" rx="12" fill="url(#wd)" stroke="${INK}" stroke-width="4"/>`);
  bolt(1430, 930, 10); plank([[1190, 630], [1210, 650], [1345, 840], [1320, 850]], 3); bolt(1200, 640, 12); bolt(1330, 840, 9);
  plank([[990, 420], [1430, 420], [1430, 450], [990, 450]]);
  // bras articulé à droite
  plank([[1480, 520], [1500, 505], [1700, 370], [1690, 350]], 3); plank([[1690, 350], [1710, 360], [1790, 250], [1770, 240]], 3); bolt(1490, 512, 10); bolt(1700, 360, 9);
  // poulie à gauche
  a(`<circle cx="430" cy="380" r="34" fill="url(#wd)" stroke="${INK}" stroke-width="4"/><circle cx="430" cy="380" r="8" fill="${INK}"/><path d="M396 380V560M464 380V500" stroke="${INK}" stroke-width="3"/><rect x="376" y="560" width="40" height="64" rx="6" fill="url(#wd)" stroke="${INK}" stroke-width="4"/><rect x="446" y="500" width="36" height="54" rx="6" fill="url(#wd)" stroke="${INK}" stroke-width="4"/><path d="M430 346V300H700" stroke="${INK}" stroke-width="3" fill="none"/>`);
  a(`<path d="M2180 820L2120 1020M2180 820L2245 1010M2140 950H2228" stroke="${INK}" stroke-width="6" fill="none"/><circle cx="2180" cy="815" r="14" fill="url(#wd)" stroke="${INK}" stroke-width="4"/>`);

  // ---------- sommet + accessoires selon le thème ----------
  const loupe = () => a(`<circle cx="1800" cy="215" r="48" fill="#f7eed9" fill-opacity=".7" stroke="${INK}" stroke-width="7"/><circle cx="1800" cy="215" r="38" fill="none" stroke="${INK}" stroke-width="2"/><path d="M1780 195q12-12 30-8" stroke="#fff" stroke-width="5" fill="none" opacity=".8"/>`);
  const balance = (gauche, droite) => {
    plank([[560, 520], [860, 500], [860, 512], [560, 532]], 3);
    a(`<path d="M710 512V430" stroke="${INK}" stroke-width="5"/>`);
    for (const [x, y] of [[580, 527], [845, 505]]) a(`<path d="M${x} ${y}L${x - 45} ${y + 120}M${x} ${y}L${x + 45} ${y + 120}" stroke="${INK}" stroke-width="2.5"/><path d="M${x - 62} ${y + 120}Q${x} ${y + 170} ${x + 62} ${y + 120}Z" fill="#d6a85a" stroke="${INK}" stroke-width="4"/>`);
    gauche(580, 620); droite(845, 598);
    plank([[855, 515], [1000, 560], [995, 575], [850, 530]], 3); bolt(1000, 567, 8);
  };
  const des = (x, y, s) => a(`<g transform="translate(${x} ${y}) rotate(${Math.round(u(-25, 25))})"><rect x="${-s}" y="${-s}" width="${2 * s}" height="${2 * s}" rx="${s / 4}" fill="#f1dcb4" stroke="${INK}" stroke-width="4"/><circle cx="${-s / 2}" cy="${-s / 2}" r="${s / 6}" fill="${INK}"/><circle r="${s / 6}" fill="${INK}"/><circle cx="${s / 2}" cy="${s / 2}" r="${s / 6}" fill="${INK}"/></g>`);
  const parchemin = (x, y) => a(`<path d="M${x} ${y}h80q16 0 16 16v60q0 16-16 16h-80q16 0 16-16v-60q0-16-16-16z" fill="#f6e7c9" stroke="${INK}" stroke-width="3"/><path d="M${x + 22} ${y + 26}h52M${x + 22} ${y + 44}h52M${x + 22} ${y + 62}h40" stroke="${INK}" stroke-width="2"/>`);
  switch (famille) {
    case 'stats':
      glow(); plank([[1020, 330], [1135, 330], [1135, 420], [1020, 420]]); plank([[1135, 285], [1285, 285], [1285, 420], [1135, 420]]); plank([[1285, 355], [1400, 355], [1400, 420], [1285, 420]]);
      a(`<g font-family="Georgia,serif" font-style="italic" font-weight="700" fill="${RED}" text-anchor="middle"><text x="1077" y="395" font-size="56">2</text><text x="1210" y="370" font-size="70">1</text><text x="1342" y="405" font-size="44">3</text></g>`);
      a(`<path d="M1160 160h100c0 70-18 100-50 104c-32-4-50-34-50-104z" fill="#e2b864" stroke="${INK}" stroke-width="5"/><path d="M1160 175c-45-5-50 50-5 58M1260 175c45-5 50 50 5 58" fill="none" stroke="${INK}" stroke-width="5"/><path d="M1210 264v14M1180 285h60v-8h-60z" fill="#e2b864" stroke="${INK}" stroke-width="4"/>`);
      balance(ballFoot.bind(null), ballBasket.bind(null)); loupe(); ballFoot(560, 250, 34);
      a(`<ellipse cx="1820" cy="760" rx="46" ry="16" fill="#5a3a25" stroke="${INK}" stroke-width="4"/>`); break;
    case 'voix':
      a(`<path d="M1230 400V300Q1230 260 1190 250L1080 230Q1010 140 960 120Q930 200 950 300Q1010 280 1080 270L1170 290Q1190 296 1190 320V400Z" fill="url(#wd)" stroke="${INK}" stroke-width="5"/><ellipse cx="955" cy="210" rx="30" ry="92" transform="rotate(10 955 210)" fill="#b77c3c" stroke="${INK}" stroke-width="5"/><ellipse cx="955" cy="210" rx="16" ry="60" transform="rotate(10 955 210)" fill="#5a3a25" opacity=".6"/>`);
      for (const r of [40, 75, 110]) a(`<path d="M${900 - r} ${210 - r}q${-r / 2} ${r} 0 ${2 * r}" fill="none" stroke="${RED}" stroke-width="4" opacity=".7"/>`);
      loupe(); parchemin(1520, 600); parchemin(560, 520); break;
    case 'carte':
      glow(); a(`<circle cx="1210" cy="290" r="120" fill="#f1dcb4" stroke="${INK}" stroke-width="5"/><path d="M1210 170l26 120-26 120-26-120zM1090 290l120-26 120 26-120 26z" fill="#d6a85a" stroke="${INK}" stroke-width="4"/><circle cx="1210" cy="290" r="10" fill="${RED}"/>`);
      loupe(); a(`<path d="M520 560q60-40 120 0t120 0v120q-60-40-120 0t-120 0z" fill="#f6e7c9" stroke="${INK}" stroke-width="4"/><path d="M560 600q40 30 80 0t80 20" fill="none" stroke="${RED}" stroke-width="3" stroke-dasharray="8 8"/>`); break;
    case 'jeux':
      glow(); des(1110, 340, 46); des(1240, 300, 56); des(1350, 360, 40); des(600, 560, 40); des(1820, 760, 36); loupe(); break;
    case 'atelier':
      a(`<path d="M1110 420 1200 140 1290 420M1150 330h120" fill="none" stroke="url(#wd)" stroke-width="20"/><path d="M1110 420 1200 140 1290 420" fill="none" stroke="${INK}" stroke-width="3"/><rect x="1130" y="190" width="150" height="120" fill="#f6e7c9" stroke="${INK}" stroke-width="5"/><path d="M1150 290q30-60 60-20t50-40" fill="none" stroke="${RED}" stroke-width="5"/>`);
      loupe(); a(`<ellipse cx="620" cy="600" rx="80" ry="50" fill="#e9cfa3" stroke="${INK}" stroke-width="4"/><circle cx="590" cy="585" r="12" fill="${RED}"/><circle cx="630" cy="575" r="12" fill="#d6a85a"/><circle cx="660" cy="605" r="12" fill="${INK}"/>`); break;
    case 'vie':
      glow(); a(`<path d="M1080 420V260l130-110 130 110v160z" fill="url(#wd)" stroke="${INK}" stroke-width="5"/><path d="M1060 270 1210 140 1360 270" fill="none" stroke="${INK}" stroke-width="8"/><rect x="1175" y="320" width="70" height="100" fill="#f1dcb4" stroke="${INK}" stroke-width="4"/><rect x="1110" y="280" width="44" height="44" fill="#ffd38a" stroke="${INK}" stroke-width="4"/>`);
      loupe(); parchemin(560, 540); break;
    case 'terre':
      for (const [x, y, r] of [[1080, 250, -30], [1210, 200, -20], [1340, 250, -10]]) a(`<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-55" y="-70" width="110" height="140" fill="#e9dcc0" stroke="${INK}" stroke-width="5"/><path d="M-55-70 55 70" stroke="${INK}" stroke-width="1.5" opacity=".5"/></g><path d="M${x} ${y + 70}V420" stroke="${INK}" stroke-width="5"/>`);
      for (let i = 0; i < 5; i += 1) a(`<path d="M${700 + i * 50} 80l${250} 230" stroke="${RED}" stroke-width="3" opacity=".35"/>`);
      a(`<rect x="1770" y="150" width="44" height="260" rx="22" fill="#f1dcb4" stroke="${INK}" stroke-width="5"/><circle cx="1792" cy="420" r="38" fill="${RED}" stroke="${INK}" stroke-width="5"/><rect x="1784" y="240" width="16" height="180" fill="${RED}"/>`); break;
    case 'savoir':
      glow(); book(1210, 280, 1.2, 0); loupe(); parchemin(560, 540); parchemin(1520, 600); break;
    default:
      a(`<path d="M1120 400 1300 160" stroke="url(#wd)" stroke-width="22" stroke-linecap="round"/><path d="M1120 400 1300 160" stroke="${INK}" stroke-width="3"/><rect x="1240" y="110" width="140" height="90" rx="8" transform="rotate(37 1310 155)" fill="url(#wd)" stroke="${INK}" stroke-width="5"/>`);
      loupe(); a(`<path d="M1600 760v120" stroke="${INK}" stroke-width="3"/><rect x="1580" y="880" width="40" height="64" rx="6" fill="url(#wd)" stroke="${INK}" stroke-width="4"/>`);
  }
  a('</g>');
  dashed('M600 290Q800 120 1060 220'); dashed('M1820 730Q1700 560 1560 600'); dashed('M640 700Q760 900 980 940'); dashed('M1550 170Q1660 90 1800 120'); dashed('M1880 290Q1960 420 1930 520');
  if (famille !== 'savoir') { a('<g filter="url(#rf)">'); book(2060, 150, 0.95); a('</g>'); }
  a(`<path d="M560 1000c10-20 20 10 30-5s15-20 25 0 10 15 25-5 20 10 35-10" fill="none" stroke="${INK}" stroke-width="2.2"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="1200" height="630" role="img" aria-label="Illustration de l'application ${nom} : machine de Léonard de Vinci dessinée à l'encre sur parchemin">
<defs><radialGradient id="pp" cx=".5" cy=".48" r=".7"><stop offset="0" stop-color="#fbf1dc"/><stop offset=".65" stop-color="#f1dfbb"/><stop offset="1" stop-color="#d9b98a"/></radialGradient><linearGradient id="wd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecd2a4"/><stop offset=".5" stop-color="#d7ad78"/><stop offset="1" stop-color="#b98657"/></linearGradient><pattern id="ht" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V9" stroke="${INK}" stroke-width="1.4"/></pattern><pattern id="gr" width="60" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(80)"><path d="M0 4Q15 1 30 5T60 3M0 10Q20 13 40 9T60 11" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".6"/></pattern><marker id="ar" markerWidth="16" markerHeight="16" refX="12" refY="8" orient="auto"><path d="M2 2L13 8L2 14" fill="none" stroke="${INK}" stroke-width="2.4"/></marker><filter id="rf" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".022" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter><filter id="gn"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 .42 0 0 0 0 .27 0 0 0 0 .12 0 0 0 .22 0"/></filter><filter id="b20"><feGaussianBlur stdDeviation="22"/></filter><filter id="b6"><feGaussianBlur stdDeviation="6"/></filter><radialGradient id="gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd38a" stop-opacity=".95"/><stop offset=".45" stop-color="#f0a466" stop-opacity=".5"/><stop offset="1" stop-color="#e88b5a" stop-opacity="0"/></radialGradient><clipPath id="pg"><polygon points="${EP}"/></clipPath></defs>
<rect width="${W}" height="${H}" fill="#fdfbf6"/><polygon points="${EP}" fill="#c9a36f" transform="translate(6 8)" opacity=".5" filter="url(#b6)"/>
<g clip-path="url(#pg)"><rect width="${W}" height="${H}" fill="url(#pp)"/><rect width="${W}" height="${H}" filter="url(#gn)"/>
${o.join('\n')}
</g></svg>
`;
}

/** Petite vignette dessinée dans chaque case de la grande roue, selon le thème. */
function vignette(f, k, u) {
  const s = `stroke="${INK}" stroke-width="1.8"`;
  if (f === 'stats') { const h = Math.round(u(14, 40)); return `<path d="M-16 18V${18 - h}h9V18M-3 18V${6 - h}h9V18M10 18V${26 - h}h9V18" fill="${RED}" fill-opacity=".55" ${s}/><path d="M-22 18H24" ${s}/>`; }
  if (f === 'jeux') return `<rect x="-14" y="-14" width="28" height="28" rx="5" fill="none" ${s}/><circle r="3" fill="${INK}"/><circle cx="-7" cy="-7" r="3" fill="${INK}"/><circle cx="7" cy="7" r="3" fill="${INK}"/>`;
  if (f === 'voix') return `<path d="M-14 0h6l8-8v16l-8-8M6-6q6 6 0 12M11-10q10 10 0 20" fill="none" ${s}/>`;
  if (f === 'carte') return `<path d="M-16 10q8-14 16-4t16-6" fill="none" stroke="${RED}" stroke-width="2" stroke-dasharray="4 3"/><circle cx="16" cy="0" r="3" fill="${RED}"/>`;
  if (f === 'terre') return `<circle r="8" fill="none" ${s}/><path d="M0-16v5M0 11v5M-16 0h5M11 0h5" ${s}/>`;
  return k % 2 ? `<path d="M-14-10h28v22h-28zM-10-4h20M-10 2h20M-10 8h12" fill="none" ${s}/>` : `<path d="M-12 14c0-14 8-26 12-30 4 4 12 16 12 30z" fill="none" ${s}/><path d="M-6 6h12" ${s}/>`;
}
