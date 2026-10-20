// Pokémon Grid : solo (score = essais, progression sauvegardée) et duel morpion (?duel=1, dans le salon).
(async () => {
  const $ = id => document.getElementById(id), D = Core.Duel, DIFFS = GridMoteur.DIFFS;
  const SAUVE = 'grid:partie', DUREE_TOUR = 90000;
  const statut = t => { $('statut').textContent = t; };
  let data;
  try { data = await Core.load(true); } // true : avec les formes (Méga, Gigamax, régionales)
  catch { statut('pokemon.json introuvable : lance outils/generer_pokemon.py, puis commit Ressource/pokemon.json.'); return; }
  const G = GridMoteur.contexte(data), pool = G.pool;
  const parId = new Map(pool.map(p => [p.id, p])), normes = pool.map(p => Core.norm(p.nom));
  const nomDe = id => (parId.get(id) || { nom: '?' }).nom, crit = id => G.critere(id).nom;
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const image = p => p.image ? `<img src="${p.image}" alt="" loading="lazy">` : '<span class="sans-image">?</span>';
  const log = t => $('journal').prepend(el('li', '', t));
  let lignes = [], colonnes = [], valides = [], casesIdx = [], caseOuverte = null;
  let partie = null; // solo
  let duel = null, tourPrec = null, minuteur = null, fin = 0; // duel
  const lieu = c => `${crit(lignes[Math.floor(c / 3)])} × ${crit(colonnes[c % 3])}`;
  function calculer() { casesIdx = G.cases(lignes, colonnes); valides = casesIdx.map(a => new Set(a.map(i => pool[i].id))); }
  const occupant = c => D.actif ? duel.poke[c] : partie.cases[c];

  // ----- Grille -----
  function dessiner() {
    const g = $('grille'); g.innerHTML = '';
    g.append(el('div'));
    for (const id of colonnes) g.append(el('div', 'ent', crit(id)));
    for (let l = 0; l < 3; l++) {
      g.append(el('div', 'ent', crit(lignes[l])));
      for (let k = 0; k < 3; k++) {
        const c = l * 3 + k, id = occupant(c), b = el('button', 'case');
        b.type = 'button'; b.dataset.c = c; b.setAttribute('aria-label', `Case ${lieu(c)}`);
        if (id != null) {
          const p = parId.get(id);
          b.classList.add(D.actif ? 'p' + duel.proprio[c] : partie.abandon ? 'revele' : 'ok');
          b.innerHTML = image(p) + `<span>${p.nom}</span>`;
        } else b.textContent = '+';
        g.append(b);
      }
    }
  }
  $('grille').addEventListener('click', e => { const b = e.target.closest('.case'); if (b) ouvrir(Number(b.dataset.c)); });

  // ----- Fenêtre d'une case : historique, saisie et suggestions -----
  const peutJouer = c => D.actif ? (D.monTour() && duel.proprio[c] !== D.moi) : !partie.fini;
  function rendrePanneau() {
    const c = caseOuverte;
    if (c === null) return;
    $('p-titre').textContent = lieu(c);
    const actuel = $('p-actuel'), id = occupant(c);
    actuel.innerHTML = '';
    if (id != null) {
      actuel.append(el('p', '', D.actif ? `${nomDe(id)} : case à ${D.noms[duel.proprio[c]]}` : `Actuellement : ${nomDe(id)}`));
      if (!D.actif && !partie.fini) {
        const r = el('button', 'sec', 'Retirer (sans coût)'); r.type = 'button';
        r.onclick = () => { partie.cases[c] = null; sauver(); dessiner(); rendrePanneau(); };
        actuel.append(r);
      }
    }
    const histo = $('p-histo'), liste = D.actif ? duel.histo[c] : [];
    histo.innerHTML = '';
    for (const x of liste) histo.append(el('li', '', `${nomDe(x.id)} (${D.noms[x.par]})`));
    histo.hidden = $('p-histo-t').hidden = !liste.length;
    const ok = peutJouer(c);
    $('p-saisie').hidden = !ok;
    const termine = D.actif ? D.fini : partie.fini, tous = $('p-tous'); // partie finie : toutes les possibilités de la case
    tous.innerHTML = '';
    tous.hidden = $('p-tous-t').hidden = !termine;
    if (termine) {
      const liste = casesIdx[c].map(i => pool[i]);
      $('p-tous-t').textContent = `${liste.length} possibilité${liste.length > 1 ? 's' : ''} pour cette case :`;
      for (const p of liste) {
        const li = el('li', p.id === id ? 'ici' : '');
        li.innerHTML = image(p) + `<span>${p.nom}</span>`;
        tous.append(li);
      }
      tous.scrollTop = 0;
    }
    if (D.actif && !ok) $('p-msg').textContent = D.fini ? '' : duel.proprio[c] === D.moi ? 'Cette case est déjà à toi.' : "Ce n'est pas ton tour.";
    majSuggestions();
  }
  function ouvrir(c) {
    caseOuverte = c; $('p-msg').textContent = ''; $('p-champ').value = ''; $('modal').hidden = false;
    rendrePanneau();
    if (!$('p-saisie').hidden) $('p-champ').focus();
  }
  const fermer = () => { caseOuverte = null; $('modal').hidden = true; };
  function majSuggestions() {
    const ul = $('sugg'), q = Core.norm($('p-champ').value);
    ul.innerHTML = '';
    if (!q || $('p-saisie').hidden) return;
    const exclus = new Set(D.actif ? duel.pris : partie.cases.filter(x => x != null));
    if (D.actif) for (const x of duel.histo[caseOuverte]) exclus.add(x.id);
    const trouves = [];
    pool.forEach((p, i) => { if (!exclus.has(p.id) && normes[i].includes(q)) trouves.push([normes[i].startsWith(q) ? 0 : 1, p]); });
    trouves.sort((a, b) => a[0] - b[0] || a[1].nom.localeCompare(b[1].nom, 'fr'));
    for (const [, p] of trouves.slice(0, 8)) {
      const li = el('li'), b = el('button', 'sg');
      b.type = 'button'; b.dataset.id = p.id; b.innerHTML = image(p) + `<span>${p.nom}</span>`;
      li.append(b); ul.append(li);
    }
  }
  $('p-champ').addEventListener('input', majSuggestions);
  $('p-champ').addEventListener('keydown', e => { if (e.key === 'Enter') { const b = $('sugg').querySelector('button'); if (b) b.click(); } });
  $('sugg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) tenter(caseOuverte, Number(b.dataset.id)); });
  $('p-fermer').onclick = fermer;
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) fermer(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') fermer(); });

  function tenter(c, id) {
    if (c === null || !parId.has(id)) return;
    if (D.actif) {
      const r = duel.refus(c, id, D.moi);
      if (r) { $('p-msg').textContent = { 'deja-pose': 'Ce Pokémon est déjà dans une case.', 'ta-case': 'Cette case est déjà à toi.', 'deja-pour-case': 'Ce Pokémon a déjà été proposé pour cette case.' }[r] || 'Coup impossible.'; return; }
      fermer(); D.coup({ c, p: id }, appliquer, apres); // un coup raté fait perdre le tour
      return;
    }
    if (partie.fini) return;
    if (partie.cases.includes(id)) { $('p-msg').textContent = 'Ce Pokémon est déjà dans une autre case (sans coût).'; return; }
    partie.essais++; partie.tentatives[c]++;
    if (!valides[c].has(id)) { $('p-msg').textContent = `${nomDe(id)} ne correspond pas (+1 essai).`; sauver(); majSolo(); return; }
    partie.cases[c] = id; sauver(); fermer(); dessiner(); majSolo();
    if (partie.cases.every(x => x !== null)) terminer();
  }

  // ----- Solo -----
  const sauver = () => Core.Store.set(SAUVE, partie);
  const sauvegardeValide = s => s && DIFFS[s.diff] && Array.isArray(s.lignes) && Array.isArray(s.colonnes) && s.lignes.length === 3 && s.colonnes.length === 3
    && [...s.lignes, ...s.colonnes].every(id => G.critere(id)) && Array.isArray(s.cases) && s.cases.length === 9 && s.cases.every(x => x === null || parId.has(x));
  function afficherSolo() {
    lignes = partie.lignes; colonnes = partie.colonnes; calculer();
    $('choix-diff').hidden = true; $('jeu').hidden = false; $('legende').hidden = true;
    dessiner(); majSolo();
  }
  function majSolo() {
    $('infos').textContent = `${DIFFS[partie.diff].nom} · ${partie.essais} essai(s)`;
    statut(partie.abandon ? 'Partie abandonnée : voici une solution possible. Touche une case pour voir toutes les possibilités.' : partie.fini ? 'Grille terminée ! Touche une case pour voir toutes les possibilités.' : 'Touche une case pour proposer un Pokémon.');
    $('abandon').hidden = partie.fini;
    $('resultat').hidden = !(partie.fini && !partie.abandon);
    if (!$('resultat').hidden) { $('bilan').textContent = `${partie.essais} essais (9 = parfait) · Record : ${partie.record}`; $('partage').textContent = partage(); }
  }
  function demarrer(diff) {
    const seed = Date.now() % 1e9, g = G.generer(diff, Core.rng(seed), true);
    if (!g) { statut("Impossible de générer une grille : réessaie."); return; }
    partie = { diff, seed, lignes: g.lignes, colonnes: g.colonnes, cases: Array(9).fill(null), essais: 0, tentatives: Array(9).fill(0), fini: false, abandon: false, record: null };
    sauver(); afficherSolo();
  }
  function terminer() {
    partie.fini = true;
    partie.record = Core.fin('grid-' + partie.diff, partie.essais); // record local + compte si connecté
    sauver(); fermer(); dessiner(); majSolo();
  }
  const partage = () => {
    const e = partie.tentatives.map(n => n <= 1 ? '🟩' : n <= 3 ? '🟨' : '🟧');
    return `Pokémon Grid – ${DIFFS[partie.diff].nom} : ${partie.essais} essais\n${e.slice(0, 3).join('')}\n${e.slice(3, 6).join('')}\n${e.slice(6).join('')}`;
  };
  function montrerChoix() {
    fermer(); $('jeu').hidden = true; $('choix-diff').hidden = false; statut('Choisis une difficulté.');
    const r = $('reprise'); r.innerHTML = '';
    if (partie && !partie.fini) {
      const b = el('button', 'sec', `Reprendre ma partie (${DIFFS[partie.diff].nom}, ${partie.essais} essai(s))`);
      b.type = 'button'; b.onclick = afficherSolo; r.append(b);
    }
  }
  for (const b of document.querySelectorAll('[data-diff]')) b.onclick = () => {
    if (partie && !partie.fini && partie.essais > 0 && !confirm('Une partie est en cours : la remplacer par une nouvelle ?')) return;
    demarrer(b.dataset.diff);
  };
  $('nouvelle').onclick = montrerChoix;
  $('abandon').onclick = () => {
    if (!confirm('Abandonner et voir une solution ? Aucun score ne sera enregistré.')) return;
    const sol = G.solution(casesIdx);
    if (sol) partie.cases = sol.map(i => pool[i].id);
    partie.fini = partie.abandon = true; sauver(); fermer(); dessiner(); majSolo();
  };
  $('copier').onclick = async () => {
    const texte = `${$('partage').textContent}\n${location.origin}${location.pathname}`;
    try { await navigator.clipboard.writeText(texte); $('copier').textContent = 'Copié !'; } catch { prompt('Copie ce texte :', texte); }
  };

  // ----- Duel (morpion) -----
  function appliquer(v, par) { // « par » : 0 hôte, 1 invité ; identique sur les deux pages
    if (v && v.passe) { log(`${D.noms[par]} n'a pas joué à temps.`); return false; }
    if (!v || !parId.has(v.p)) return 'rejoue';
    const r = duel.jouer(v.c, v.p, par);
    if (r.type === 'refus') return 'rejoue'; // coup refusé : on ne perd pas son tour
    if (r.type === 'rate') { log(`${D.noms[par]} propose ${nomDe(v.p)} pour ${lieu(v.c)} : raté, il perd son tour.`); return false; }
    log(`${D.noms[par]} ${r.vole ? 'vole' : 'prend'} la case ${lieu(v.c)} avec ${nomDe(v.p)}.`);
    return r.gagnant === null ? false : { gagnant: r.gagnant };
  }
  function lancerMinuteur() {
    clearInterval(minuteur); fin = Date.now() + DUREE_TOUR;
    const tic = () => {
      const reste = Math.max(0, fin - Date.now()), s = Math.ceil(reste / 1000);
      $('temps').textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (!reste) { clearInterval(minuteur); if (D.monTour()) D.coup({ passe: true }, appliquer, apres); } // tour perdu
    };
    minuteur = setInterval(tic, 250); tic();
  }
  function apres() {
    dessiner(); rendrePanneau(); statut(D.statut() + (D.fini ? ' Touche une case pour voir toutes les possibilités.' : ''));
    const l = $('legende'); l.innerHTML = '';
    for (const j of [0, 1]) l.append(el('span', 'joueur p' + j, `${D.noms[j]} : ${duel.proprio.filter(x => x === j).length} case(s)`));
    if (D.fini) { clearInterval(minuteur); $('temps').textContent = ''; }
    else if (D.tour !== tourPrec) { tourPrec = D.tour; lancerMinuteur(); }
  }

  // ----- Démarrage -----
  if (D.actif) {
    const demande = new URLSearchParams(location.search).get('diff'), diff = DIFFS[demande] ? demande : 'normal';
    const g = G.generer(diff, Core.rng(Core.seed()), false);
    if (!g) { statut('Impossible de générer la grille.'); return; }
    lignes = g.lignes; colonnes = g.colonnes; calculer();
    duel = GridMoteur.duel(valides);
    $('choix-diff').hidden = true; $('jeu').hidden = false; $('actions').hidden = true; $('legende').hidden = false;
    $('infos').textContent = `Difficulté : ${DIFFS[diff].nom}`;
    dessiner(); D.ecouter(appliquer, apres); apres();
  } else {
    const s = Core.Store.get(SAUVE, null);
    if (sauvegardeValide(s)) partie = s;
    if (partie && !partie.fini) afficherSolo(); else montrerChoix();
  }
})();
