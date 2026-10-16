// Pokédle : trouve le Pokémon mystère, sans limite d'essais.
// En duel (?duel=1, dans le salon) : tableau partagé, chacun son tour, le premier qui trouve gagne.
(async () => {
  const $ = id => document.getElementById(id), D = Core.Duel;
  let data;
  try { data = await Core.load(); }
  catch { $('info').textContent = 'pokemon.json introuvable : lance outils/generer_pokemon.py, puis commit Ressource/pokemon.json.'; return; }
  const pool = data.filter(p => p.image && p.stade);
  const cible = Core.pick(pool, 1, Core.rng(Core.seed()))[0];
  $('noms').innerHTML = pool.map(p => `<option value="${p.nom}">`).join('');
  let essais = 0, fini = false;
  const num = (v, c, u) => `<td class="${v === c ? 'ok' : 'ko'}">${v}${u}${v < c ? ' ↑' : v > c ? ' ↓' : ''}</td>`;
  const typ = (t, i) => `<td class="${t === cible.types[i] ? 'ok' : t && cible.types.includes(t) ? 'part' : 'ko'}">${t || 'Aucun'}</td>`;
  // Full évolué : Oui / Non (« ? » tant que pokemon.json n'a pas été régénéré avec ce champ).
  const fe = v => v === undefined ? '<td>?</td>' : `<td class="${v === cible.final ? 'ok' : 'ko'}">${v ? 'Oui' : 'Non'}</td>`;
  const ajouter = (p, par) => $('lignes').insertAdjacentHTML('afterbegin', `<tr><td><img src="${p.image}" alt=""> ${p.nom}${D.actif ? `<br><small>${Core.esc(D.noms[par])}</small>` : ''}</td>${typ(p.types[0], 0)}${typ(p.types[1], 1)}${num(p.gen, cible.gen, '')}${num(p.stade, cible.stade, '')}${fe(p.final)}${num(p.taille, cible.taille, ' m')}${num(p.poids, cible.poids, ' kg')}</tr>`);

  // Score = nombre d'essais (le plus bas est le meilleur) ; un abandon n'enregistre rien.
  function terminer(gagne) {
    fini = true; $('rep').disabled = true; $('abandon').hidden = true; $('ok').textContent = 'Rejouer';
    if (!gagne) { $('info').textContent = `Abandon : c'était ${cible.nom}. Pas de score.`; return; }
    $('info').textContent = `Trouvé en ${essais} essai(s) ! Record : ${Core.fin('pokedle', essais)}.`;
  }
  function proposer() {
    if (fini) return location.reload();
    const p = pool.find(x => Core.norm(x.nom) === Core.norm($('rep').value));
    if (!p) { $('info').textContent = 'Nom inconnu : choisis un Pokémon dans la liste.'; return; }
    $('rep').value = '';
    if (D.actif) return D.coup(p.id, appliquer, apres);
    essais++; ajouter(p, 0);
    if (p.id === cible.id) terminer(true); else $('info').textContent = `Essai ${essais}`;
  }

  // Duel : « id » est le Pokémon proposé par le joueur « par ».
  function appliquer(id, par) {
    const p = pool.find(x => x.id === id);
    if (!p) return false;
    ajouter(p, par);
    return p.id === cible.id;
  }
  function apres() {
    $('info').textContent = D.statut() + (D.fini ? ` C'était ${cible.nom}.` : '');
    $('rep').disabled = $('ok').disabled = !D.monTour();
    $('ok').hidden = D.fini;
    if (D.monTour()) $('rep').focus();
  }

  $('ok').onclick = proposer;
  $('abandon').onclick = () => { if (!fini) terminer(false); };
  $('rep').addEventListener('keydown', e => { if (e.key === 'Enter') proposer(); });
  if (D.actif) { $('abandon').hidden = true; D.ecouter(appliquer, apres); apres(); }
})();
