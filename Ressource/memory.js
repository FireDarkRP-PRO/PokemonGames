// Memory : 6 paires de Pokémon. Score = 24 - coups (18 au mieux).
(async () => {
  const $ = id => document.getElementById(id);
  let data;
  try { data = await Core.load(); }
  catch { $('info').textContent = 'pokemon.json introuvable : lance outils/generer_pokemon.py, puis commit Ressource/pokemon.json.'; return; }
  const r = Core.rng(Core.seed()), six = Core.pick(data.filter(p => p.image), 6, r);
  const cartes = Core.pick([...six, ...six], 12, r);
  let ouvertes = [], coups = 0, trouvees = 0, bloque = false;
  $('plateau').innerHTML = cartes.map((p, k) => `<button type="button" class="carte" data-k="${k}" aria-label="Carte ${k + 1}"><span class="dos"></span><img src="${p.image}" alt="${p.nom}"></button>`).join('');
  const maj = () => $('score').textContent = `${coups} coup(s)`;
  $('plateau').onclick = e => {
    const c = e.target.closest('.carte');
    if (!c || bloque || c.classList.contains('ouverte') || c.classList.contains('trouvee')) return;
    c.classList.add('ouverte'); ouvertes.push(c);
    if (ouvertes.length < 2) return;
    coups++; maj();
    const [a, b] = ouvertes; ouvertes = [];
    if (cartes[a.dataset.k].id === cartes[b.dataset.k].id) {
      for (const x of [a, b]) x.classList.replace('ouverte', 'trouvee');
      if (++trouvees === 6) {
        const score = Math.max(0, 24 - coups), best = Core.fin('memory', score, 18);
        $('info').textContent = `Bravo ! ${coups} coups, score ${score}/18, meilleur : ${best}.`; $('rejouer').hidden = false;
      }
    } else { bloque = true; setTimeout(() => { a.classList.remove('ouverte'); b.classList.remove('ouverte'); bloque = false; }, 800); }
  };
  $('rejouer').onclick = () => location.reload();
  maj();
})();
