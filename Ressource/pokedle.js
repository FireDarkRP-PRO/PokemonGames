// Pokédle : trouve le Pokémon mystère, sans limite d'essais.
(async () => {
  const $ = id => document.getElementById(id), REF = 8;
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

  // Score : 8 si trouvé du premier coup, jusqu'à 1 au-delà de 8 essais ; 0 si abandon.
  function terminer(gagne) {
    fini = true; $('rep').disabled = true; $('abandon').hidden = true; $('ok').textContent = 'Rejouer';
    const score = gagne ? Math.max(1, REF + 1 - essais) : 0, b = Core.fin('pokedle', score, REF);
    $('info').textContent = (gagne ? `Trouvé en ${essais} essai(s) !` : `Abandon : c'était ${cible.nom}.`) + ` Score ${score}/${REF}, meilleur : ${b}.`;
  }
  function proposer() {
    if (fini) return location.reload();
    const p = pool.find(x => Core.norm(x.nom) === Core.norm($('rep').value));
    if (!p) { $('info').textContent = 'Nom inconnu : choisis un Pokémon dans la liste.'; return; }
    essais++;
    $('lignes').insertAdjacentHTML('afterbegin', `<tr><td><img src="${p.image}" alt=""> ${p.nom}</td>${typ(p.types[0], 0)}${typ(p.types[1], 1)}${num(p.gen, cible.gen, '')}${num(p.stade, cible.stade, '')}${fe(p.final)}${num(p.taille, cible.taille, ' m')}${num(p.poids, cible.poids, ' kg')}</tr>`);
    $('rep').value = '';
    if (p.id === cible.id) terminer(true); else $('info').textContent = `Essai ${essais}`;
  }
  $('ok').onclick = proposer;
  $('abandon').onclick = () => { if (!fini) terminer(false); };
  $('rep').addEventListener('keydown', e => { if (e.key === 'Enter') proposer(); });
})();
