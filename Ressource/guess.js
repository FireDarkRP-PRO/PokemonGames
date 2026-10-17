// Moteur commun des jeux « Deviner » : le mode vient de <body data-mode>.
// ?seed=123 dans l'URL donne les mêmes questions à tous.
// En duel (?duel=1, dans le salon) : une seule question, essais illimités, chacun son tour.
(async () => {
  const mode = document.body.dataset.mode, $ = id => document.getElementById(id), D = Core.Duel;
  const N = D.actif ? 1 : 10, ESSAIS = D.actif ? Infinity : 3, NIV = [8, 16, 32, 64];
  let seed = Core.seed(), dejaJoue = false;
  let data;
  try { data = await Core.load(); }
  catch { $('media').textContent = 'pokemon.json introuvable : lance outils/generer_pokemon.py, puis commit Ressource/pokemon.json.'; return; }
  const jouable = p => p.image && (mode === 'cri' ? p.cri : mode === 'description' ? p.desc : mode === 'caracteristiques' ? p.talents && p.talents.length : true);
  const gens = [...new Set(data.map(p => p.gen))].sort((a, b) => a - b);
  $('gen').innerHTML = '<option value="0">Toutes</option>' + gens.map(g => `<option value="${g}">Génération ${g}</option>`).join('');
  $('noms').innerHTML = data.map(p => `<option value="${p.nom}">`).join('');
  if (D.actif) { $('gen').parentElement.hidden = true; $('info').insertAdjacentHTML('afterend', '<ul id="hist"></ul>'); }
  const img = new Image();
  let qs, i, score, essais, fini, termine, audio;

  const maj = () => $('score').textContent = D.actif ? D.statut() : `Question ${Math.min(i + 1, qs.length)}/${qs.length} : ${score} essai(s)`;
  const niv = () => NIV[Math.min(essais, NIV.length - 1)];
  const paint = n => {
    const c = $('cv'), t = document.createElement('canvas'), x = c.getContext('2d');
    t.width = t.height = n; t.getContext('2d').drawImage(img, 0, 0, n, n);
    x.imageSmoothingEnabled = false; x.clearRect(0, 0, 288, 288); x.drawImage(t, 0, 0, 288, 288);
  };

  function start() {
    if (dejaJoue) seed = Date.now() % 1e9; // chaque nouvelle partie = nouvelles questions
    dejaJoue = true;
    const g = Number($('gen').value);
    qs = Core.pick(data.filter(p => jouable(p) && (!g || p.gen === g)), N, Core.rng(seed + g));
    i = 0; score = 0; question();
  }
  function question() {
    const p = qs[i], m = $('media');
    essais = 0; fini = termine = false;
    $('rep').value = ''; $('rep').disabled = false; $('info').textContent = '';
    $('ok').textContent = 'Valider'; $('passe').hidden = D.actif; maj();
    if (mode === 'silhouette') { m.innerHTML = '<img id="im" class="sil" alt="Silhouette d\'un Pokémon">'; $('im').src = p.image; }
    if (mode === 'pixel') { m.innerHTML = '<canvas id="cv" width="288" height="288" aria-label="Image pixelisée"></canvas>'; img.onload = () => paint(niv()); img.src = p.image; }
    if (mode === 'cri') {
      m.innerHTML = '<button id="ecoute" type="button">Écouter le cri</button>';
      audio = new Audio(p.cri); $('ecoute').onclick = () => { audio.currentTime = 0; audio.play(); }; audio.play().catch(() => {});
    }
    if (mode === 'description') { m.innerHTML = '<blockquote id="txt"></blockquote>'; $('txt').textContent = p.desc.replace(new RegExp(p.nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '●●●'); }
    if (mode === 'caracteristiques') { m.innerHTML = '<ul id="ind" class="indices"></ul>'; hint(p, 0); }
    $('rep').focus();
  }
  function hint(p, n) {
    const l = [`Types : ${p.types.join(' / ')}`, `Talents : ${p.talents.join(', ')}`];
    if (n >= 1) l.push(`Génération ${p.gen}`, `Stade d'évolution : ${p.stade}`);
    if (n >= 2) l.push(`Taille : ${p.taille} m`, `Poids : ${p.poids} kg`);
    $('ind').innerHTML = l.map(x => `<li>${x}</li>`).join('');
  }
  function reveal(p, n) {
    fini = true; $('rep').disabled = true; $('passe').hidden = true;
    $('ok').textContent = i + 1 < qs.length ? 'Suivant' : 'Voir le score';
    if (mode === 'silhouette') $('im').classList.remove('sil');
    if (mode === 'pixel') paint(288);
    if (['cri', 'description', 'caracteristiques'].includes(mode)) $('media').innerHTML = `<img src="${p.image}" alt="${p.nom}">`;
    $('info').textContent = n ? `Bravo, c'est ${p.nom} ! Trouvé en ${n} essai(s).` : `C'était ${p.nom}.` + (D.actif ? '' : ` Compte pour ${ESSAIS + 1} essais.`);
    maj();
  }
  function valider() {
    if (D.actif) { const v = $('rep').value.trim(); if (v && D.monTour()) { $('rep').value = ''; D.coup(v, appliquer, apres); } return; }
    if (termine) return start();
    if (fini) { i++; return i < qs.length ? question() : fin(); }
    const p = qs[i], v = $('rep').value;
    if (!v.trim()) return;
    if (Core.norm(v) === Core.norm(p.nom)) { score += essais + 1; return reveal(p, essais + 1); }
    if (++essais >= ESSAIS) { score += ESSAIS + 1; return reveal(p, 0); }
    $('info').textContent = `Raté, encore ${ESSAIS - essais} essai(s).`;
    if (mode === 'pixel') paint(niv());
    if (mode === 'caracteristiques') hint(p, essais);
    $('rep').select();
  }
  function fin() {
    const b = Core.fin(mode, score, Number($('gen').value) === 0); termine = true;
    $('media').innerHTML = `<p class="final">${score} essais (${qs.length} = parfait)<br>Record : ${b}</p>`;
    $('info').textContent = ''; $('ok').textContent = 'Rejouer'; $('passe').hidden = true; $('rep').disabled = true;
  }

  // Duel : « par » est le joueur (0 hôte, 1 invité) qui a proposé v.
  function appliquer(v, par) {
    const p = qs[0], bon = Core.norm(String(v)) === Core.norm(p.nom), li = document.createElement('li');
    li.textContent = `${D.noms[par]} : ${v} ${bon ? '✓' : '✗'}`;
    $('hist').prepend(li);
    if (bon) { reveal(p, 0); return true; }
    essais++;
    if (mode === 'pixel') paint(niv());
    if (mode === 'caracteristiques') hint(p, essais);
    return false;
  }
  function apres() {
    maj();
    $('rep').disabled = $('ok').disabled = !D.monTour();
    $('ok').hidden = D.fini;
    if (D.fini) $('info').textContent = `C'était ${qs[0].nom}.`;
    else if (D.monTour()) $('rep').focus();
  }

  $('ok').onclick = valider;
  $('passe').onclick = () => { if (!fini && !termine) { score += ESSAIS + 1; reveal(qs[i], 0); } };
  $('rep').addEventListener('keydown', e => { if (e.key === 'Enter') valider(); });
  $('gen').onchange = start;
  start();
  if (D.actif) { D.ecouter(appliquer, apres); apres(); }
})();
