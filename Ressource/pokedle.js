// Pokédle : trouve le Pokémon mystère en 8 essais.
(async () => {
  const $ = id => document.getElementById(id), MAX = 8;
  let data;
  try { data = await Core.load(); }
  catch { $('info').textContent = 'pokemon.json introuvable : lance outils/generer_pokemon.py, puis commit Ressource/pokemon.json.'; return; }
  const pool = data.filter(p => p.image && p.stade);
  const cible = Core.pick(pool, 1, Core.rng(Core.seed()))[0];
  $('noms').innerHTML = pool.map(p => `<option value="${p.nom}">`).join('');
  let essais = 0, fini = false;
  const num = (v, c, u) => `<td class="${v === c ? 'ok' : 'ko'}">${v}${u}${v < c ? ' ↑' : v > c ? ' ↓' : ''}</td>`;
  const typ = (t, i) => `<td class="${t === cible.types[i] ? 'ok' : t && cible.types.includes(t) ? 'part' : 'ko'}">${t || 'Aucun'}</td>`;
  function proposer() {
    if (fini) return location.reload();
    const p = pool.find(x => Core.norm(x.nom) === Core.norm($('rep').value));
    if (!p) { $('info').textContent = 'Nom inconnu : choisis un Pokémon dans la liste.'; return; }
    essais++;
    $('lignes').insertAdjacentHTML('afterbegin', `<tr><td><img src="${p.image}" alt=""> ${p.nom}</td>${typ(p.types[0], 0)}${typ(p.types[1], 1)}${num(p.gen, cible.gen, '')}${num(p.stade, cible.stade, '')}${num(p.taille, cible.taille, ' m')}${num(p.poids, cible.poids, ' kg')}</tr>`);
    $('rep').value = '';
    const gagne = p.id === cible.id;
    if (gagne || essais >= MAX) {
      fini = true; $('rep').disabled = true;
      const score = gagne ? MAX + 1 - essais : 0, b = Core.fin('pokedle', score, MAX);
      $('info').textContent = (gagne ? `Trouvé en ${essais} essai(s) !` : `Perdu : c'était ${cible.nom}.`) + ` Score ${score}/${MAX}, meilleur : ${b}.`;
      $('ok').textContent = 'Rejouer';
    } else $('info').textContent = `Essai ${essais}/${MAX}`;
  }
  $('ok').onclick = proposer;
  $('rep').addEventListener('keydown', e => { if (e.key === 'Enter') proposer(); });
})();
