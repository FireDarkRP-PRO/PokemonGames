#!/usr/bin/env node
// Vérifie Pokémon Grid sur le vrai pokemon.json : pour chaque difficulté, génère des grilles avec des graines différentes
// et contrôle, indépendamment du moteur, que chacune est remplissable (9 Pokémon valides et différents, une lignée
// différente par case au niveau Expert) et qu'une partie de duel peut la remplir sans refus.
//
// Usage, depuis la racine du projet :
//     node outils/verifier_grid.mjs [nombre de grilles par difficulté (1000 par défaut)] [chemin d'un autre pokemon.json]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2]) || 1000;
const data = JSON.parse(fs.readFileSync(process.argv[3] || path.join(racine, 'Ressource', 'pokemon.json'), 'utf8'));
// Core.rng et Core.pick sont lus tels quels dans core.js (même aléatoire que sur le site).
const coreSrc = fs.readFileSync(path.join(racine, 'Ressource', 'core.js'), 'utf8').split('\n');
const ligne = nom => coreSrc.find(l => l.trim().startsWith(`const ${nom} =`));
const Core = vm.runInNewContext(`(() => { ${ligne('rng')}\n${ligne('pick')}\nreturn { rng, pick }; })()`);
const GM = vm.runInNewContext(fs.readFileSync(path.join(racine, 'Ressource', 'grid-moteur.js'), 'utf8') + '\n;GridMoteur', { Core });

const avecStats = data.some(p => p.stats);
console.log(`${data.length} entrées, ${avecStats ? 'champ « stats » présent' : 'ATTENTION : pas de champ « stats » (relance outils/generer_pokemon.py) : seuls les critères de total sont actifs'}.`);
const ctx = GM.contexte(data);
const pool = ctx.pool, ligneDe = new Map(pool.map(p => [p.id, p.ligne]));

console.log('\nPokémon valides par critère de statistique :');
for (const c of GM.CRITERES.filter(c => c.stat)) console.log(`  ${c.nom.padEnd(20)} niv ${c.niv}  ${String(ctx.effectifs.get(c.id)).padStart(4)}`);

let echecs = 0;
const probleme = (diff, i, texte) => { if (++echecs <= 15) console.log(`  ÉCHEC ${diff} #${i} : ${texte}`); };
console.log(`\n${N} grilles par difficulté :`);
for (const diff of Object.keys(GM.DIFFS)) {
  const d = GM.DIFFS[diff];
  let nulles = 0, secours = 0, avecStat = 0, minCase = Infinity, nbStats = 0;
  const apparitions = new Map();
  for (let i = 0; i < N; i++) {
    const g = ctx.generer(diff, Core.rng(i * 7919 + 13), true);
    if (!g) { nulles++; probleme(diff, i, 'aucune grille générée'); continue; }
    if (g.secours) secours++;
    const crit = [...g.lignes, ...g.colonnes].map(ctx.critere);
    for (const c of crit) apparitions.set(c.id, (apparitions.get(c.id) || 0) + 1);
    if (crit.some(c => c.stat)) avecStat++;
    const stats = crit.map(c => c.stat).filter(Boolean);
    if (new Set(stats).size !== stats.length) probleme(diff, i, 'deux critères sur la même statistique');
    if (stats.length > d.maxStats) probleme(diff, i, `plus de ${d.maxStats} critère(s) de statistique`);
    nbStats += stats.length;
    if (new Set(crit.map(c => c.id)).size !== 6) probleme(diff, i, 'critère en double');
    const cases = ctx.cases(g.lignes, g.colonnes);
    if (!g.secours) minCase = Math.min(minCase, ...cases.map(v => v.length));
    if (!g.secours && cases.some(v => v.length < d.min)) probleme(diff, i, `case avec moins de ${d.min} Pokémon`);
    const sol = ctx.solution(cases, diff);
    if (!sol) { probleme(diff, i, 'pas de solution'); continue; }
    // Solution recalculée à la main, critère par critère (sans passer par les masques du moteur).
    const ids = new Set(), lignees = new Set();
    for (let c = 0; c < 9; c++) {
      const p = pool[sol[c]], l = ctx.critere(g.lignes[Math.floor(c / 3)]), co = ctx.critere(g.colonnes[c % 3]);
      if (!l.ok(p) || !co.ok(p)) probleme(diff, i, `${p.nom} ne valide pas la case ${c}`);
      if (ids.has(p.id)) probleme(diff, i, `${p.nom} utilisé deux fois`);
      ids.add(p.id);
      if (d.ligne) { if (lignees.has(p.ligne)) probleme(diff, i, `lignée de ${p.nom} utilisée deux fois`); lignees.add(p.ligne); }
    }
    // Duel : le joueur 0 pose la solution case par case ; aucun coup ne doit être refusé ni raté.
    const duel = GM.duel(cases.map(v => new Set(v.map(k => pool[k].id))), d.ligne ? id => ligneDe.get(id) : undefined);
    for (let c = 0; c < 9; c++) { const r = duel.jouer(c, pool[sol[c]].id, 0); if (r.type !== 'pose') probleme(diff, i, `duel : coup refusé case ${c} (${r.raison || r.type})`); }
  }
  // Fréquence moyenne d'un critère de statistique par rapport aux autres (parmi ceux utilisables à cette difficulté) : visé ≈ 0,5.
  const utilisables = GM.CRITERES.filter(c => c.niv <= d.niv && ctx.effectifs.get(c.id) >= d.min);
  const moy = l => l.length ? l.reduce((s, c) => s + (apparitions.get(c.id) || 0), 0) / l.length : 0;
  const mStat = moy(utilisables.filter(c => c.stat)), mAutres = moy(utilisables.filter(c => !c.stat));
  console.log(`  ${d.nom.padEnd(10)} grilles sans solution/échec : ${nulles}  secours : ${secours}  avec au moins 1 critère de stat : ${Math.round(100 * avecStat / N)} % (moyenne ${(nbStats / N).toFixed(2)} par grille)  minimum de Pokémon par case : ${minCase}  fréquence d'un critère de stat / autre : ${mAutres ? (mStat / mAutres).toFixed(2) : '–'}`);
}
console.log(echecs ? `\n${echecs} problème(s) détecté(s).` : '\nTout est bon : chaque grille générée est remplissable.');
process.exit(echecs ? 1 : 0);
