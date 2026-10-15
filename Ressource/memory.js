// Memory. Solo : 6 paires, score = 24 - coups (18 au mieux).
// Duel (?duel=1) : 12 paires, chacun son tour (une paire trouvée fait rejouer, une erreur passe la main),
// le gagnant est celui qui a trouvé le plus de paires.
(async () => {
  const $ = id => document.getElementById(id), D = Core.Duel;
  const PAIRES_DUEL = 12, NB = D.actif ? PAIRES_DUEL : 6;
  let data;
  try { data = await Core.load(); }
  catch { $('info').textContent = 'pokemon.json introuvable : lance outils/generer_pokemon.py, puis commit Ressource/pokemon.json.'; return; }
  const r = Core.rng(Core.seed()), moitie = Core.pick(data.filter(p => p.image), NB, r);
  const cartes = Core.pick([...moitie, ...moitie], NB * 2, r);
  $('plateau').innerHTML = cartes.map((p, k) => `<button type="button" class="carte" data-k="${k}" aria-label="Carte ${k + 1}"><span class="dos"></span><img src="${p.image}" alt="${p.nom}"></button>`).join('');
  if (D.actif) $('plateau').classList.add('large');
  const els = [...$('plateau').children];
  let ouvertes = [], coups = 0, trouvees = 0, bloque = false, timer = null;
  const paires = [0, 0];

  // ----- Duel -----
  const fermer = () => { clearTimeout(timer); for (const k of ouvertes) els[k].classList.remove('ouverte'); ouvertes = []; };
  function appliquer(k, par) {
    const c = els[k];
    if (!Number.isInteger(k) || !c || c.classList.contains('trouvee') || ouvertes.includes(k)) return 'rejoue';
    if (ouvertes.length === 2) fermer();
    c.classList.add('ouverte'); ouvertes.push(k);
    if (ouvertes.length < 2) return 'rejoue';
    const [a, b] = ouvertes;
    if (cartes[a].id !== cartes[b].id) { timer = setTimeout(() => { fermer(); apres(); }, 900); return false; } // raté : à l'autre joueur
    for (const x of ouvertes) els[x].classList.replace('ouverte', 'trouvee');
    ouvertes = []; paires[par]++;
    if (paires[0] + paires[1] === NB) return { gagnant: paires[0] > paires[1] ? 0 : paires[1] > paires[0] ? 1 : null };
    return 'rejoue';
  }
  function apres() {
    $('score').textContent = D.statut();
    $('info').textContent = `${D.noms[0]} : ${paires[0]} paire(s) – ${paires[1]} paire(s) : ${D.noms[1]}`;
  }

  // ----- Solo -----
  const maj = () => $('score').textContent = `${coups} coup(s)`;
  $('plateau').onclick = e => {
    const c = e.target.closest('.carte');
    if (!c) return;
    if (D.actif) { if (ouvertes.length < 2) D.coup(Number(c.dataset.k), appliquer, apres); return; }
    if (bloque || c.classList.contains('ouverte') || c.classList.contains('trouvee')) return;
    c.classList.add('ouverte'); ouvertes.push(c);
    if (ouvertes.length < 2) return;
    coups++; maj();
    const [a, b] = ouvertes; ouvertes = [];
    if (cartes[a.dataset.k].id === cartes[b.dataset.k].id) {
      for (const x of [a, b]) x.classList.replace('ouverte', 'trouvee');
      if (++trouvees === NB) {
        const score = Math.max(0, 24 - coups), best = Core.fin('memory', score, 18);
        $('info').textContent = `Bravo ! ${coups} coups, score ${score}/18, meilleur : ${best}.`; $('rejouer').hidden = false;
      }
    } else { bloque = true; setTimeout(() => { a.classList.remove('ouverte'); b.classList.remove('ouverte'); bloque = false; }, 800); }
  };
  $('rejouer').onclick = () => location.reload();
  if (D.actif) { D.ecouter(appliquer, apres); apres(); } else maj();
})();
