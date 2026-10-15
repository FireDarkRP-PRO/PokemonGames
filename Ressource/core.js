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
  return { rng, norm, pick, load, Store, seed, fin };
})();
if (parent !== window) document.documentElement.classList.add('embed');
