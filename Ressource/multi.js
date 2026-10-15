// Duel à deux : l'hôte garde l'état et le renvoie à l'invité (PeerJS, WebRTC).
// Les jeux tournent dans un iframe en mode duel (?duel=1) : chacun joue à son tour, le premier qui trouve gagne.
// L'iframe envoie ses coups au salon, qui les relaie à l'adversaire.
(() => {
  const $ = id => document.getElementById(id);
  // [page, titre, description, indisponible en duel]
  const CATS = [
    ['Deviner', [
      ['deviner-silhouette.html', 'Silhouette', 'Reconnais le Pokémon à son ombre.'],
      ['deviner-cri.html', 'Cri', 'Écoute le cri et trouve son propriétaire.'],
      ['deviner-pixel.html', 'Image pixelisée', "L'image se précise à chaque erreur."],
      ['deviner-description.html', 'Description du Pokédex', 'Le nom est masqué dans le texte.'],
      ['deviner-caracteristiques.html', 'Caractéristiques', 'Types, talents, taille : de nouveaux indices à chaque erreur.']]],
    ['Réflexion', [
      ['reflexion-pokedle.html', 'Pokédle', 'Trouve le Pokémon mystère grâce aux indices de chaque proposition.'],
      ['reflexion-plusmoins.html', 'Plus ou moins', 'Le plus lourd, le plus grand, le plus fort.'],
      ['reflexion-types.html', 'Efficacité des types', "Trouve le multiplicateur de dégâts d'une attaque."],
      ['reflexion-intrus.html', "Quel est l'intrus ?", 'Trois Pokémon partagent un type, pas le quatrième.']]],
    ['Autre', [
      ['autre-shiny.html', 'Lequel est le shiny ?', 'Deux images, une seule est chromatique.'],
      ['autre-memory.html', 'Memory', 'Chacun son tour : celui qui trouve le plus de paires gagne.']]]
  ];
  const PAGES = new Set(CATS.flatMap(c => c[1].filter(j => !j[3]).map(j => j[0])));
  let peer, estHote = false, hote = null, invite = null, manche = 0, pret = false, attente = [];
  let etat = { phase: 'salon', noms: ['Hôte', null], suggestion: null, partie: null, victoires: [0, 0], fini: false, manche: 0 };
  const moi = () => estHote ? 0 : 1;
  const nom = () => ($('nom').value.trim() || 'Joueur').slice(0, 16);
  const msg = t => $('msg').textContent = t;
  const montrer = id => { for (const s of ['accueil', 'salon', 'menu', 'duel']) $(s).hidden = s !== id; };

  // Menu des jeux (même organisation que l'accueil du site).
  const tuiles = new Map();
  for (const [titre, jeux] of CATS) {
    const h = document.createElement('h2'), g = document.createElement('div');
    h.textContent = titre; g.className = 'grille';
    for (const [page, nomJeu, desc, off] of jeux) {
      const el = document.createElement(off ? 'div' : 'button');
      el.className = 'tuile' + (off ? ' off' : '');
      for (const [tag, txt, cls] of [['strong', nomJeu], ['span', desc], ['em', '', 'badge']]) {
        const x = document.createElement(tag); x.textContent = txt; if (cls) x.className = cls; el.append(x);
      }
      if (!off) { el.type = 'button'; el.onclick = () => choisir(page); tuiles.set(page, el); }
      g.append(el);
    }
    $('jeux').append(h, g);
  }

  function afficher() {
    const [a, b] = etat.noms;
    document.querySelectorAll('.vic').forEach(p => p.textContent = `${a} ${etat.victoires[0]} – ${etat.victoires[1]} ${b ?? '…'}`);
    if (etat.phase === 'salon') {
      montrer('salon');
      $('joueurs').innerHTML = '';
      for (const n of etat.noms) if (n) { const li = document.createElement('li'); li.textContent = n; $('joueurs').append(li); }
      $('attente').textContent = !b ? "En attente d'un adversaire…" : estHote ? 'Adversaire connecté : clique sur Jouer.' : "En attente de l'hôte…";
      $('jouer').hidden = !(estHote && b);
    } else if (etat.phase === 'menu') {
      montrer('menu');
      $('aide').textContent = estHote
        ? (etat.suggestion ? `${b} suggère un jeu (entouré en jaune). Clique sur n'importe quel jeu pour lancer le duel.` : 'Clique sur un jeu pour lancer le duel.')
        : "Clique sur un jeu pour le suggérer à l'hôte, qui lance la partie.";
      for (const [page, el] of tuiles) {
        const s = page === etat.suggestion;
        el.classList.toggle('sugg', s);
        el.querySelector('.badge').textContent = s ? (estHote ? `Suggestion de ${b}` : 'Ta suggestion') : '';
      }
    } else {
      montrer('duel');
      $('hote').hidden = !estHote;
      const p = etat.partie;
      if (etat.manche !== manche && p && PAGES.has(p.page)) {
        manche = etat.manche; pret = false; attente = [];
        const q = new URLSearchParams({ seed: Number(p.seed), duel: 1, moi: moi(), debut: Number(p.debut) ? 1 : 0, n0: etat.noms[0], n1: etat.noms[1] });
        $('cadre').src = `${p.page}?${q}`;
      }
    }
  }
  const diffuser = () => { afficher(); if (invite && invite.open) invite.send({ t: 'etat', etat }); };
  const versIframe = val => { if (pret) $('cadre').contentWindow.postMessage({ pq: 'coup', val }, '*'); else attente.push(val); };

  function choisir(page) {
    if (estHote) lancer(page);
    else if (hote && hote.open) hote.send({ t: 'suggere', page });
  }
  function lancer(page) {
    etat.manche++; etat.phase = 'duel'; etat.fini = false; etat.suggestion = null;
    etat.partie = { page, seed: Math.floor(Math.random() * 1e9) + 1, debut: (etat.manche - 1) % 2 };
    diffuser();
  }

  function creer() {
    const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 5 }, () => alpha[Math.floor(Math.random() * alpha.length)]).join('');
    peer = new Peer('pq-' + code);
    peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); creer(); } else msg('Erreur de connexion : ' + e.type); });
    peer.on('open', () => { estHote = true; $('codeaff').textContent = code; etat.noms[0] = nom(); diffuser(); });
    peer.on('connection', c => {
      if (invite) { c.on('open', () => c.close()); return; } // salon à deux joueurs
      invite = c;
      c.on('data', d => {
        if (d.t === 'hello') { let n = String(d.nom).slice(0, 16) || 'Joueur'; if (n === etat.noms[0]) n += ' 2'; etat.noms[1] = n; diffuser(); }
        else if (d.t === 'suggere' && etat.phase === 'menu' && PAGES.has(d.page)) { etat.suggestion = d.page; diffuser(); }
        else if (d.t === 'coup') versIframe(d.val);
        else if (d.t === 'gagne' && etat.phase === 'duel' && !etat.fini) { etat.victoires[1]++; etat.fini = true; diffuser(); }
      });
      c.on('close', () => {
        invite = null;
        etat = { phase: 'salon', noms: [etat.noms[0], null], suggestion: null, partie: null, victoires: [0, 0], fini: false, manche: etat.manche };
        diffuser();
      });
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
      hote.on('data', d => {
        if (d.t === 'etat' && d.etat && Array.isArray(d.etat.noms) && Array.isArray(d.etat.victoires)) { etat = d.etat; afficher(); }
        else if (d.t === 'coup') versIframe(d.val);
      });
      hote.on('close', () => { msg('Le salon est fermé ou complet.'); manche = 0; montrer('accueil'); });
    });
  }

  $('creer').onclick = creer;
  $('rejoindre').onclick = rejoindre;
  $('jouer').onclick = () => { etat.phase = 'menu'; diffuser(); };
  $('rejouer').onclick = () => lancer(etat.partie.page);
  $('changer').onclick = () => { etat.phase = 'menu'; etat.suggestion = null; diffuser(); };

  // Messages de l'iframe : prêt, coup joué (à relayer), manche gagnée.
  addEventListener('message', e => {
    const m = e.data;
    if (e.source !== $('cadre').contentWindow || !m || typeof m !== 'object') return;
    if (m.pq === 'pret') { pret = true; for (const v of attente.splice(0)) versIframe(v); }
    else if (m.pq === 'coup') { const c = estHote ? invite : hote; if (c && c.open) c.send({ t: 'coup', val: m.val }); }
    else if (m.pq === 'nul') { if (estHote && !etat.fini) { etat.fini = true; diffuser(); } }
    else if (m.pq === 'gagne') {
      if (estHote) { if (!etat.fini) { etat.victoires[0]++; etat.fini = true; diffuser(); } }
      else if (hote && hote.open) hote.send({ t: 'gagne' });
    }
  });
})();
