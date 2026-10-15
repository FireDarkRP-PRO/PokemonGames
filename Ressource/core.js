// Outils partagés par tous les jeux.
const Core = (() => {
  const BASE = document.currentScript.src;
  const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const pick = (list, n, r) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  const load = async () => { const r = await fetch(new URL('pokemon.json', BASE)); if (!r.ok) throw new Error('pokemon.json introuvable'); return (await r.json()).filter(p => !p.forme); }; // formes alternatives ignorées pour l'instant
  // Sauvegarde locale. Seul endroit à changer quand la base de données arrivera.
  const Store = {
    get(k, d) { try { const v = localStorage.getItem('pq:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('pq:' + k, JSON.stringify(v)); } catch {} }
  };
  const seed = () => Number(new URLSearchParams(location.search).get('seed')) || Date.now() % 1e9;
  // Fin de partie : garde le meilleur score et prévient le salon multijoueur si la page est dans un iframe.
  const fin = (mode, score, max) => {
    const k = 'meilleur:' + mode, b = Math.max(Store.get(k, 0), score);
    Store.set(k, b);
    if (parent !== window) parent.postMessage({ pq: 'score', mode, score, max }, '*');
    return b;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Mode duel (iframe du salon, ?duel=1) : deux joueurs jouent à tour de rôle, le premier qui trouve gagne.
  // Chaque page rejoue les mêmes coups (même graine) : seuls les coups circulent, relayés par le salon.
  const Duel = (() => {
    const q = new URLSearchParams(location.search);
    const d = { actif: q.get('duel') === '1', moi: q.get('moi') === '1' ? 1 : 0, tour: q.get('debut') === '1' ? 1 : 0, fini: false, gagnant: null, noms: [q.get('n0') || 'Joueur 1', q.get('n1') || 'Joueur 2'] };
    d.monTour = () => d.actif && !d.fini && d.tour === d.moi;
    d.statut = () => d.fini ? (d.gagnant === null ? 'Égalité parfaite !' : d.gagnant === d.moi ? 'Bravo, tu gagnes la manche !' : `${d.noms[d.gagnant]} gagne la manche.`) : d.monTour() ? 'À toi de jouer !' : `Tour de ${d.noms[d.tour]}…`;
    // appliquer(val, par) affiche le coup du joueur « par » et renvoie :
    //   true : bonne réponse, « par » gagne ;  false : coup raté, c'est à l'autre joueur ;
    //   'rejoue' : coup valide, « par » continue ;  { gagnant } : fin de partie (0, 1, ou null pour une égalité).
    const jouer = (val, par, appliquer, apres) => {
      const r = appliquer(val, par);
      if (r === true || (r && typeof r === 'object')) {
        const g = r === true ? par : r.gagnant;
        d.fini = true; d.gagnant = g;
        if (g === d.moi) parent.postMessage({ pq: 'gagne' }, '*');
        else if (g === null && d.moi === 0) parent.postMessage({ pq: 'nul' }, '*');
      } else if (r !== 'rejoue') d.tour = 1 - par;
      apres();
    };
    d.coup = (val, appliquer, apres) => { if (!d.monTour()) return; parent.postMessage({ pq: 'coup', val }, '*'); jouer(val, d.moi, appliquer, apres); };
    d.ecouter = (appliquer, apres) => {
      addEventListener('message', e => { const m = e.data; if (e.source === parent && m && m.pq === 'coup' && !d.fini) jouer(m.val, 1 - d.moi, appliquer, apres); });
      parent.postMessage({ pq: 'pret' }, '*');
    };
    return d;
  })();
  return { rng, norm, pick, load, Store, seed, fin, esc, Duel };
})();
if (parent !== window) document.documentElement.classList.add('embed');
