// Moteur de Pokémon Grid (sans interface) : critères (types, générations, statuts, formes, statistiques), génération des grilles, appariement et règles du duel.
// Vérifier une grille sur le vrai pokemon.json : node outils/verifier_grid.mjs
const GridMoteur = (() => {
  const TYPES = ['Normal', 'Feu', 'Eau', 'Électrik', 'Plante', 'Glace', 'Combat', 'Poison', 'Sol', 'Vol', 'Psy', 'Insecte', 'Roche', 'Spectre', 'Dragon', 'Ténèbres', 'Acier', 'Fée'];
  const REGIONS = ['alola', 'galar', 'hisui', 'paldea'];
  // niv : difficulté minimale où le critère apparaît (1 facile, 2 normal, 3 difficile) ; rare : critère « rare » du mode Difficile.
  // Statistiques de base (champ « stats » de pokemon.json, et « total » pour leur somme). Seuils choisis pour que chaque
  // critère reste sélectif (jamais « stat > 10 ») : niveau 2 (Normal, Expert) : ≥ 120 (≥ 110 pour les PV) ou ≤ 40 ;
  // niveau 3 (Difficile, critères « rares ») : ≥ 150 ou ≤ 25. Total : ≥ 600 / ≤ 250, puis ≥ 680 / ≤ 200.
  // Sans le champ « stats » (ancien pokemon.json), les critères par statistique n'ont aucun Pokémon valide et sont écartés.
  // « stat » : deux critères de la même statistique ne sont jamais dans la même grille (ils se recouvrent ou s'excluent).
  // poids : chance relative d'être tiré (1 pour un critère classique) : un critère de statistique en a deux fois moins.
  const POIDS_STAT = 0.5;
  const STATS = [['pv', 'PV'], ['atq', 'Attaque'], ['def', 'Défense'], ['atqs', 'Atq. Spé.'], ['defs', 'Déf. Spé.'], ['vit', 'Vitesse']];
  const statCrit = (cle, nom, haut, seuil, niv) => ({
    id: `${cle}_${haut ? 'h' : 'b'}${seuil}`, nom: `${nom} ${haut ? '≥' : '≤'} ${seuil}`, niv, rare: niv === 3, stat: cle, poids: POIDS_STAT,
    ok: p => !!p.stats && (haut ? p.stats[cle] >= seuil : p.stats[cle] <= seuil)
  });
  const CRITERES_STATS = [
    ...STATS.flatMap(([cle, nom]) => [
      statCrit(cle, nom, true, cle === 'pv' ? 110 : 120, 2), statCrit(cle, nom, false, 40, 2),
      statCrit(cle, nom, true, 150, 3), statCrit(cle, nom, false, 25, 3)
    ]),
    ...[[true, 600, 2], [false, 250, 2], [true, 680, 3], [false, 200, 3]].map(([haut, seuil, niv]) => ({
      id: `total_${haut ? 'h' : 'b'}${seuil}`, nom: `Total ${haut ? '≥' : '≤'} ${seuil}`, niv, rare: niv === 3, stat: 'total', poids: POIDS_STAT,
      ok: p => haut ? p.total >= seuil : p.total <= seuil
    }))
  ];
  const CRITERES = [
    ...TYPES.map(t => ({ id: 'type:' + t, nom: t, niv: 1, ok: p => p.types.includes(t) })),
    ...Array.from({ length: 9 }, (_, i) => ({ id: 'gen:' + (i + 1), nom: 'Gén ' + (i + 1), niv: 1, ok: p => p.gen === i + 1 })),
    { id: 'leg', nom: 'Légendaire', niv: 2, ok: p => p.legendaire },
    { id: 'fab', nom: 'Fabuleux', niv: 2, ok: p => p.fabuleux },
    { id: 'st1', nom: '1er stade', niv: 2, ok: p => p.stade === 1 }, // y compris un Pokémon sans évolution
    { id: 'st2', nom: '2e stade', niv: 2, ok: p => p.stade === 2 }, // y compris un Pokémon pleinement évolué au 2e stade
    { id: 'stf', nom: 'Pleinement évolué', niv: 2, ok: p => p.final },
    { id: 'starter', nom: 'Starter', niv: 2, rare: true, ok: p => p.starter },
    { id: 'mega', nom: 'Méga-évolution', niv: 3, rare: true, ok: p => p.forme === 'mega' },
    { id: 'gmax', nom: 'Gigamax', niv: 3, rare: true, ok: p => p.forme === 'gmax' },
    { id: 'regional', nom: 'Forme régionale', niv: 3, rare: true, ok: p => REGIONS.includes(p.forme) },
    ...CRITERES_STATS
  ];
  const PAR_ID = new Map(CRITERES.map(c => [c.id, c]));
  // min : nombre minimum de Pokémon valides par case ; force : au moins un critère de ce groupe dans la grille ;
  // maxStats : nombre maximum de critères de statistique dans une même grille (ils ne doivent pas écraser les critères classiques).
  const DIFFS = {
    facile: { nom: 'Facile', niv: 1, min: 10, force: null, maxStats: 0 },
    normal: { nom: 'Normal', niv: 2, min: 3, force: c => c.niv === 2, maxStats: 2 },
    difficile: { nom: 'Difficile', niv: 3, min: 1, force: c => c.rare, maxStats: 3 },
    // Expert : critères du niveau Normal, mais deux Pokémon de la même lignée évolutive (champ « ligne ») ne peuvent pas être dans la grille.
    expert: { nom: 'Expert', niv: 2, min: 3, force: null, ligne: true, maxStats: 2 }
  };
  const ALIGNEMENTS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  // Pokémon jouables : de base et toutes les formes alternatives (Méga, Primo, Gigamax, régionales, mais aussi styles,
  // coloris et formes diverses : Shifours Style Mille Poings, les Plumeline, Necrozma Ailes de l'Aurore...), sauf :
  //  - les formes qui ne sont pas de vrais Pokémon (suffixe PokéAPI de pokemon.json) : casquettes et costumes de Pikachu,
  //    Pikachu et Évoli Partenaire, Totems (« Dominant »), Éthernatos Infinimax, Zygarde « Générateur » (même forme que 10 % / 50 %) ;
  //  - les espèces dont les formes ne sont que des couleurs : Météno (13 formes identiques), seule sa forme de base reste.
  const SUFFIXES_EXCLUS = ['cap', 'totem', 'rock-star', 'belle', 'pop-star', 'phd', 'libre', 'cosplay', 'starter', 'eternamax', 'power-construct'];
  const BASES_SANS_FORMES = ['Météno'];
  const garder = p => !p.forme || (!BASES_SANS_FORMES.includes(p.base) && !/Casquette/.test(p.nom)
    && !SUFFIXES_EXCLUS.some(x => ('-' + (p.suffixe || '') + '-').includes('-' + x + '-')));

  function contexte(data) {
    const pool = data.filter(garder);
    const masques = new Map(CRITERES.map(c => [c.id, Uint8Array.from(pool, p => c.ok(p) ? 1 : 0)]));
    // Nombre de Pokémon qui valident deux critères à la fois (mis en cache).
    const comptes = new Map();
    const paire = (a, b) => {
      const k = a < b ? a + '|' + b : b + '|' + a;
      let n = comptes.get(k);
      if (n === undefined) {
        const x = masques.get(a), y = masques.get(b);
        n = 0;
        for (let i = 0; i < x.length; i++) n += x[i] & y[i];
        comptes.set(k, n);
      }
      return n;
    };
    // Nombre de Pokémon valides pour chaque critère seul.
    const effectifs = new Map(CRITERES.map(c => [c.id, masques.get(c.id).reduce((s, x) => s + x, 0)]));
    // Tirage de n critères sans remise, chacun selon son poids (Efraimidis-Spirakis : clé = aléa^(1/poids)).
    const tirage = (liste, n, rng) => liste.map(c => ({ c, k: Math.pow(rng(), 1 / (c.poids ?? 1)) })).sort((a, b) => b.k - a.k).slice(0, n).map(x => x.c);
    const memeStat = (a, b) => !!a.stat && a.stat === b.stat;
    const doublonStat = (l, max) => { const s = l.map(c => c.stat).filter(Boolean); return new Set(s).size !== s.length || s.length > max; };
    // Pour chaque case (ligne * 3 + colonne) : index (dans pool) des Pokémon valides.
    const cases = (L, C) => {
      const res = [];
      for (const a of L) for (const b of C) {
        const x = masques.get(a), y = masques.get(b), v = [];
        for (let i = 0; i < x.length; i++) if (x[i] & y[i]) v.push(i);
        res.push(v);
      }
      return res;
    };
    // Appariement biparti : un Pokémon différent par case (et, au niveau Expert, une lignée différente par case), ou null si impossible.
    const solution = (valides, diff) => {
      const cle = diff && DIFFS[diff].ligne ? i => pool[i].ligne : i => i;
      const prise = new Map(), res = Array(9);
      const chercher = (c, vus) => {
        for (const i of valides[c]) {
          const k = cle(i);
          if (vus.has(k)) continue;
          vus.add(k);
          if (!prise.has(k) || chercher(prise.get(k), vus)) { prise.set(k, c); res[c] = i; return true; }
        }
        return false;
      };
      for (let c = 0; c < 9; c++) if (!chercher(c, new Set())) return null;
      return res;
    };
    // Tire une grille avec les critères « dispo » : au moins « min » Pokémon par case, pas deux critères sur la même
    // statistique, et un appariement complet (un Pokémon différent par case, une lignée différente par case au niveau
    // Expert) vérifié pour CHAQUE grille renvoyée : toute grille générée est donc remplissable, en solo comme en duel.
    function tirer(diff, rng, dispo, min, force, essais) {
      const maxStats = DIFFS[diff].maxStats;
      for (let t = 0; t < essais; t++) {
        const L = tirage(dispo, 3, rng);
        if (doublonStat(L, maxStats)) continue;
        // Colonnes possibles : chaque case doit avoir au moins « min » Pokémon valides avec les trois lignes.
        const cand = dispo.filter(c => !L.includes(c) && !L.some(l => memeStat(l, c)) && L.every(l => paire(l.id, c.id) >= min));
        if (cand.length < 3) continue;
        let C;
        if (!force || L.some(force)) C = tirage(cand, 3, rng);
        else { // aucun critère du groupe imposé dans les lignes : il en faut un dans les colonnes
          const f = cand.filter(force);
          if (!f.length) continue;
          const un = tirage(f, 1, rng)[0];
          C = Core.pick([un, ...tirage(cand.filter(c => c !== un), 2, rng)], 3, rng);
        }
        if (doublonStat([...L, ...C], maxStats)) continue;
        let lignes = L.map(c => c.id), colonnes = C.map(c => c.id);
        if (rng() < 0.5) [lignes, colonnes] = [colonnes, lignes];
        if (!solution(cases(lignes, colonnes), diff)) continue;
        return { lignes, colonnes };
      }
      return null;
    }
    // Le 3e argument (ancien « solo ») est ignoré : la grille est toujours garantie remplissable.
    // Secours (très improbable) : types et générations seulement, au moins 1 Pokémon par case ; la grille porte alors « secours: true ».
    function generer(diff, rng) {
      const d = DIFFS[diff];
      const g = tirer(diff, rng, CRITERES.filter(c => c.niv <= d.niv && effectifs.get(c.id) >= d.min), d.min, d.force, 3000);
      if (g) return g;
      const s = tirer(diff, rng, CRITERES.filter(c => c.niv === 1), 1, null, 3000);
      return s && { ...s, secours: true };
    }
    return { pool, generer, cases, solution, effectifs, critere: id => PAR_ID.get(id) };
  }

  // Règles du duel (morpion) : valides[c] = ensemble des id de Pokémon valides pour la case c.
  // ligneDe (optionnel, niveau Expert) : id de Pokémon -> lignée ; deux cases ne peuvent pas avoir la même lignée.
  function duel(valides, ligneDe) {
    const proprio = Array(9).fill(null), poke = Array(9).fill(null), pris = new Set();
    const histo = Array.from({ length: 9 }, () => []);
    const refus = (c, id, par) => {
      if (!Number.isInteger(c) || c < 0 || c > 8 || id == null) return 'invalide';
      if (pris.has(id)) return 'deja-pose';
      if (ligneDe && poke.some((x, k) => k !== c && x !== null && ligneDe(x) === ligneDe(id))) return 'meme-ligne';
      if (proprio[c] === par) return 'ta-case';
      if (histo[c].some(h => h.id === id)) return 'deja-pour-case';
      return null;
    };
    function jouer(c, id, par) {
      const r = refus(c, id, par);
      if (r) return { type: 'refus', raison: r };
      if (!valides[c].has(id)) return { type: 'rate' };
      const vole = proprio[c] !== null;
      if (poke[c] !== null) pris.delete(poke[c]);
      poke[c] = id; proprio[c] = par; pris.add(id); histo[c].push({ id, par });
      let gagnant = null;
      if (ALIGNEMENTS.some(l => l.every(k => proprio[k] === par))) gagnant = par;
      else if (proprio.every(x => x !== null)) gagnant = proprio.filter(x => x === 0).length > 4 ? 0 : 1; // 9 cases : pas d'égalité
      return { type: 'pose', vole, gagnant };
    }
    return { proprio, poke, pris, histo, refus, jouer };
  }

  return { CRITERES, DIFFS, ALIGNEMENTS, contexte, duel };
})();
