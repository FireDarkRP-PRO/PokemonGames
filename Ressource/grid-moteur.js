// Moteur de Pokémon Grid (sans interface) : critères, génération des grilles, appariement et règles du duel.
const GridMoteur = (() => {
  const TYPES = ['Normal', 'Feu', 'Eau', 'Électrik', 'Plante', 'Glace', 'Combat', 'Poison', 'Sol', 'Vol', 'Psy', 'Insecte', 'Roche', 'Spectre', 'Dragon', 'Ténèbres', 'Acier', 'Fée'];
  const REGIONS = ['alola', 'galar', 'hisui', 'paldea'];
  // niv : difficulté minimale où le critère apparaît (1 facile, 2 normal, 3 difficile) ; rare : critère « rare » du mode Difficile.
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
    { id: 'regional', nom: 'Forme régionale', niv: 3, rare: true, ok: p => REGIONS.includes(p.forme) }
  ];
  const PAR_ID = new Map(CRITERES.map(c => [c.id, c]));
  // min : nombre minimum de Pokémon valides par case ; force : au moins un critère de ce groupe dans la grille.
  const DIFFS = {
    facile: { nom: 'Facile', niv: 1, min: 10, force: null },
    normal: { nom: 'Normal', niv: 2, min: 3, force: c => c.niv === 2 },
    difficile: { nom: 'Difficile', niv: 3, min: 1, force: c => c.rare }
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
    // Appariement biparti : un Pokémon différent par case, ou null si impossible.
    const solution = valides => {
      const prise = new Map();
      const chercher = (c, vus) => {
        for (const i of valides[c]) {
          if (vus.has(i)) continue;
          vus.add(i);
          if (!prise.has(i) || chercher(prise.get(i), vus)) { prise.set(i, c); return true; }
        }
        return false;
      };
      for (let c = 0; c < 9; c++) if (!chercher(c, new Set())) return null;
      const res = Array(9);
      for (const [i, c] of prise) res[c] = i;
      return res;
    };
    // solo = true : la grille est garantie remplissable avec 9 Pokémon différents.
    function generer(diff, rng, solo) {
      const d = DIFFS[diff], dispo = CRITERES.filter(c => c.niv <= d.niv);
      for (let t = 0; t < 3000; t++) {
        const L = Core.pick(dispo, 3, rng);
        // Colonnes possibles : chaque case doit avoir au moins d.min Pokémon valides avec les trois lignes.
        const cand = dispo.filter(c => !L.includes(c) && L.every(l => paire(l.id, c.id) >= d.min));
        if (cand.length < 3) continue;
        let C;
        if (!d.force || L.some(d.force)) C = Core.pick(cand, 3, rng);
        else { // aucun critère du groupe imposé dans les lignes : il en faut un dans les colonnes
          const f = cand.filter(d.force);
          if (!f.length) continue;
          const un = Core.pick(f, 1, rng)[0];
          C = Core.pick([un, ...Core.pick(cand.filter(c => c !== un), 2, rng)], 3, rng);
        }
        let lignes = L.map(c => c.id), colonnes = C.map(c => c.id);
        if (rng() < 0.5) [lignes, colonnes] = [colonnes, lignes];
        if (solo && !solution(cases(lignes, colonnes))) continue;
        return { lignes, colonnes };
      }
      return null;
    }
    return { pool, generer, cases, solution, critere: id => PAR_ID.get(id) };
  }

  // Règles du duel (morpion) : valides[c] = ensemble des id de Pokémon valides pour la case c.
  function duel(valides) {
    const proprio = Array(9).fill(null), poke = Array(9).fill(null), pris = new Set();
    const histo = Array.from({ length: 9 }, () => []);
    const refus = (c, id, par) => {
      if (!Number.isInteger(c) || c < 0 || c > 8 || id == null) return 'invalide';
      if (pris.has(id)) return 'deja-pose';
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
