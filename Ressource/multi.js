// Salon multijoueur : l'hôte garde l'état de la partie et le renvoie à tous (PeerJS, WebRTC).
// Les jeux tournent dans un iframe avec ?seed= (mêmes questions pour tous) et envoient leur score via Core.fin.
(() => {
  const $ = id => document.getElementById(id);
  const JEUX = [['deviner-silhouette.html', 'Deviner : silhouette'], ['deviner-cri.html', 'Deviner : cri'], ['deviner-pixel.html', 'Deviner : image pixelisée'], ['deviner-description.html', 'Deviner : description du Pokédex'], ['deviner-caracteristiques.html', 'Deviner : caractéristiques'], ['reflexion-pokedle.html', 'Pokédle'], ['reflexion-plusmoins.html', 'Plus ou moins'], ['reflexion-types.html', 'Efficacité des types'], ['reflexion-intrus.html', "Quel est l'intrus ?"], ['autre-shiny.html', 'Lequel est le shiny ?'], ['autre-memory.html', 'Memory']];
  $('jeu').innerHTML = JEUX.map(([f, n]) => `<option value="${f}">${n}</option>`).join('');
  let peer, estHote = false, hote = null, conns = {}, manche = 0;
  let etat = { manche: 0, page: '', seed: 0, joueurs: {} };
  const nom = () => ($('nom').value.trim() || 'Joueur').slice(0, 16);
  const msg = t => $('msg').textContent = t;

  function afficher() {
    $('accueil').hidden = true; $('salon').hidden = false;
    const l = Object.values(etat.joueurs).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    $('scores').innerHTML = '';
    for (const j of l) {
      const tr = document.createElement('tr');
      for (const t of [j.nom, j.score == null ? '…' : `${j.score}/${j.max}`]) { const td = document.createElement('td'); td.textContent = t; tr.append(td); }
      $('scores').append(tr);
    }
    if (etat.manche !== manche && JEUX.some(j => j[0] === etat.page)) {
      manche = etat.manche; $('cadre').hidden = false; $('cadre').src = `${etat.page}?seed=${Number(etat.seed)}`;
    }
  }
  const diffuser = () => { afficher(); for (const c of Object.values(conns)) if (c.open) c.send({ t: 'etat', etat }); };

  function creer() {
    const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 5 }, () => alpha[Math.floor(Math.random() * alpha.length)]).join('');
    peer = new Peer('pq-' + code);
    peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); creer(); } else msg('Erreur de connexion : ' + e.type); });
    peer.on('open', () => {
      estHote = true; $('codeaff').textContent = code; $('hote').hidden = false;
      etat.joueurs.hote = { nom: nom(), score: null, max: 0 }; diffuser();
    });
    peer.on('connection', c => {
      conns[c.peer] = c;
      c.on('data', d => {
        if (d.t === 'hello') etat.joueurs[c.peer] = { nom: String(d.nom).slice(0, 16), score: null, max: 0 };
        if (d.t === 'score' && etat.joueurs[c.peer]) Object.assign(etat.joueurs[c.peer], { score: Number(d.score), max: Number(d.max) });
        diffuser();
      });
      c.on('close', () => { delete conns[c.peer]; delete etat.joueurs[c.peer]; diffuser(); });
    });
  }

  function rejoindre() {
    const code = $('code').value.trim().toUpperCase();
    if (!code) return msg('Entre le code du salon.');
    peer = new Peer();
    peer.on('error', e => msg(e.type === 'peer-unavailable' ? 'Salon introuvable.' : 'Erreur de connexion : ' + e.type));
    peer.on('open', () => {
      hote = peer.connect('pq-' + code, { reliable: true });
      hote.on('open', () => { $('codeaff').textContent = code; hote.send({ t: 'hello', nom: nom() }); });
      hote.on('data', d => { if (d.t === 'etat' && d.etat && typeof d.etat.joueurs === 'object') { etat = d.etat; afficher(); } });
      hote.on('close', () => { msg('Le salon a été fermé.'); manche = 0; $('accueil').hidden = false; $('salon').hidden = true; $('cadre').hidden = true; });
    });
  }

  $('creer').onclick = creer;
  $('rejoindre').onclick = rejoindre;
  $('lancer').onclick = () => {
    etat.manche++; etat.page = $('jeu').value; etat.seed = Math.floor(Math.random() * 1e9) + 1;
    for (const j of Object.values(etat.joueurs)) { j.score = null; j.max = 0; }
    diffuser();
  };
  addEventListener('message', e => {
    if (e.source !== $('cadre').contentWindow || !e.data || e.data.pq !== 'score') return;
    const s = { score: Number(e.data.score), max: Number(e.data.max) };
    if (estHote) { Object.assign(etat.joueurs.hote, s); diffuser(); }
    else if (hote && hote.open) hote.send({ t: 'score', ...s });
  });
})();
