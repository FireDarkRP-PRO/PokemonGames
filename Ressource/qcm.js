// Jeux à choix multiples (<body data-jeu>) : plus ou moins, efficacité des types, intrus, shiny.
(async () => {
  const $ = id => document.getElementById(id), jeu = document.body.dataset.jeu, N = 10;
  let data;
  try { data = await Core.load(); }
  catch { $('media').textContent = 'pokemon.json introuvable : lance outils/generer_pokemon.py, puis commit Ressource/pokemon.json.'; return; }
  const r = Core.rng(Core.seed()), un = l => l[Math.floor(r() * l.length)];
  const pool = data.filter(p => p.image && p.types && p.total);
  const img = (s, alt = '') => `<img src="${s}" alt="${alt}">`;

  const T = ['Normal', 'Feu', 'Eau', 'Électrik', 'Plante', 'Glace', 'Combat', 'Poison', 'Sol', 'Vol', 'Psy', 'Insecte', 'Roche', 'Spectre', 'Dragon', 'Ténèbres', 'Acier', 'Fée'];
  // Attaquant : [super efficace contre, peu efficace contre, sans effet sur]
  const C = {
    Normal: [[], ['Roche', 'Acier'], ['Spectre']],
    Feu: [['Plante', 'Glace', 'Insecte', 'Acier'], ['Feu', 'Eau', 'Roche', 'Dragon'], []],
    Eau: [['Feu', 'Sol', 'Roche'], ['Eau', 'Plante', 'Dragon'], []],
    Électrik: [['Eau', 'Vol'], ['Électrik', 'Plante', 'Dragon'], ['Sol']],
    Plante: [['Eau', 'Sol', 'Roche'], ['Feu', 'Plante', 'Poison', 'Vol', 'Insecte', 'Dragon', 'Acier'], []],
    Glace: [['Plante', 'Sol', 'Vol', 'Dragon'], ['Feu', 'Eau', 'Glace', 'Acier'], []],
    Combat: [['Normal', 'Glace', 'Roche', 'Ténèbres', 'Acier'], ['Poison', 'Vol', 'Psy', 'Insecte', 'Fée'], ['Spectre']],
    Poison: [['Plante', 'Fée'], ['Poison', 'Sol', 'Roche', 'Spectre'], ['Acier']],
    Sol: [['Feu', 'Électrik', 'Poison', 'Roche', 'Acier'], ['Plante', 'Insecte'], ['Vol']],
    Vol: [['Plante', 'Combat', 'Insecte'], ['Électrik', 'Roche', 'Acier'], []],
    Psy: [['Combat', 'Poison'], ['Psy', 'Acier'], ['Ténèbres']],
    Insecte: [['Plante', 'Psy', 'Ténèbres'], ['Feu', 'Combat', 'Poison', 'Vol', 'Spectre', 'Acier', 'Fée'], []],
    Roche: [['Feu', 'Glace', 'Vol', 'Insecte'], ['Combat', 'Sol', 'Acier'], []],
    Spectre: [['Psy', 'Spectre'], ['Ténèbres'], ['Normal']],
    Dragon: [['Dragon'], ['Acier'], ['Fée']],
    Ténèbres: [['Psy', 'Spectre'], ['Combat', 'Ténèbres', 'Fée'], []],
    Acier: [['Glace', 'Roche', 'Fée'], ['Feu', 'Eau', 'Électrik', 'Acier'], []],
    Fée: [['Combat', 'Dragon', 'Ténèbres'], ['Feu', 'Poison', 'Acier'], []]
  };
  const mult = (a, def) => def.reduce((m, d) => m * (C[a][2].includes(d) ? 0 : C[a][0].includes(d) ? 2 : C[a][1].includes(d) ? .5 : 1), 1);
  const fois = v => '×' + ({ .25: '¼', .5: '½' }[v] ?? v);
  const commun = l => T.find(t => l.every(p => p.types.includes(t)));
  const STATS = [['lourd', p => p.poids, v => v + ' kg'], ['grand', p => p.taille, v => v + ' m'], ['fort', p => p.total, v => v + ' pts de stats']];
  const VAL = [0, .25, .5, 1, 2, 4];

  const JEUX = {
    plusmoins() {
      const [mot, f, fmt] = un(STATS); let a, b;
      do { [a, b] = Core.pick(pool, 2, r); } while (f(a) === f(b));
      return { q: `<p class="q">Lequel est le plus ${mot} ?</p>`, choix: [a, b].map(p => img(p.image) + p.nom), bonne: f(a) > f(b) ? 0 : 1, expl: `${a.nom} : ${fmt(f(a))}, ${b.nom} : ${fmt(f(b))}.` };
    },
    types() {
      const a = un(T), p = un(pool), m = mult(a, p.types);
      return { q: `${img(p.image, p.nom)}<p class="q">${p.nom} (${p.types.join(' / ')}) reçoit une attaque de type ${a}. Quel multiplicateur de dégâts ?</p>`, choix: VAL.map(fois), bonne: VAL.indexOf(m), expl: `Multiplicateur : ${fois(m)}.` };
    },
    intrus() {
      for (;;) {
        const t = un(T), avec = pool.filter(p => p.types.includes(t));
        if (avec.length < 3) continue;
        const s = Core.pick([...Core.pick(avec, 3, r), un(pool.filter(p => !p.types.includes(t)))], 4, r);
        const k = s.map((_, i) => i).filter(i => commun(s.filter((_, j) => j !== i)));
        if (k.length === 1) return { q: '<p class="q">Trois de ces Pokémon ont un type en commun. Qui est l\'intrus ?</p>', choix: s.map(p => img(p.image) + p.nom), bonne: k[0], expl: `Les trois autres sont de type ${commun(s.filter((_, j) => j !== k[0]))}.` };
      }
    },
    shiny() {
      const p = un(pool.filter(p => p.shiny)), g = r() < .5;
      return { q: `<p class="q">Lequel est la version shiny de ${p.nom} ?</p>`, choix: (g ? [p.shiny, p.image] : [p.image, p.shiny]).map(s => img(s)), bonne: g ? 0 : 1, expl: `Le shiny était à ${g ? 'gauche' : 'droite'}.` };
    }
  };

  let i = 0, score = 0, cur, fini = false;
  const maj = () => $('score').textContent = `Question ${Math.min(i + 1, N)}/${N} : ${score} pts`;
  function question() {
    cur = JEUX[jeu](); fini = false;
    $('media').innerHTML = cur.q; $('info').textContent = ''; $('suite').hidden = true; maj();
    $('choix').innerHTML = cur.choix.map((c, k) => `<button type="button" data-k="${k}">${c}</button>`).join('');
  }
  function bilan() {
    const b = Core.fin(jeu, score, N); cur = null;
    $('media').innerHTML = `<p class="final">${score} / ${N} points<br>Meilleur score : ${b}</p>`;
    $('choix').innerHTML = ''; $('info').textContent = ''; $('suite').textContent = 'Rejouer';
  }
  $('choix').onclick = e => {
    const b = e.target.closest('button');
    if (!b || fini || !cur) return;
    fini = true;
    const bon = Number(b.dataset.k) === cur.bonne;
    if (bon) score++;
    $('choix').children[cur.bonne].classList.add('bon');
    if (!bon) b.classList.add('mauvais');
    $('info').textContent = (bon ? 'Bravo ! ' : 'Raté. ') + cur.expl;
    $('suite').textContent = i + 1 < N ? 'Suivant' : 'Voir le score'; $('suite').hidden = false; maj();
  };
  $('suite').onclick = () => {
    if (!cur) { i = 0; score = 0; question(); }
    else if (i + 1 < N) { i++; question(); }
    else bilan();
  };
  question();
})();
