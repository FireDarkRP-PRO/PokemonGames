// Qui est-ce ? (duel uniquement). Chaque joueur garde son Pokémon secret pour lui ; les questions, réponses et
// propositions circulent via le salon (messages « coup » relayés tels quels). Les deux pages ont le même groupe.
// <body data-groupe="alea"> : 30 Pokémon tirés au hasard (même graine) ; "perso" : 15 choisis par chaque joueur.
(async () => {
  const $ = id => document.getElementById(id), D = Core.Duel, moi = D.moi, adv = 1 - D.moi, TAILLE = 15;
  if (!D.actif) { $('statut').textContent = 'Ce mode est réservé au multijoueur : crée un salon depuis la page Multijoueur.'; return; }
  let data;
  try { data = await Core.load(); }
  catch { $('statut').textContent = 'pokemon.json introuvable : lance outils/generer_pokemon.py, puis commit Ressource/pokemon.json.'; return; }
  const pool = data.filter(p => p.image), parId = new Map(pool.map(p => [p.id, p]));
  const seed = Core.seed(), perso = document.body.dataset.groupe === 'perso';
  const send = val => parent.postMessage({ pq: 'coup', val }, '*');
  const nomDe = id => (parId.get(id) || { nom: '?' }).nom;
  let groupe = [], mine = [], advListe = null, listeEnvoyee = false;
  let secret = null, advPret = false, phase = perso ? 'groupe' : 'secret';
  let tour = D.tour, sub = 'tour'; // tour : qui pose la question ; sub : tour | reponse | verdict
  let fini = false, resultat = '', modeDeviner = false, choix = null, dernier = null, modalOuvert = false;
  $('noms').innerHTML = pool.map(p => `<option value="${p.nom}">`).join('');

  const log = t => { const li = document.createElement('li'); li.textContent = t; $('journal').prepend(li); };
  const monTour = () => phase === 'jeu' && !fini && sub === 'tour' && tour === moi;
  const construire = ids => {
    groupe = ids.map(id => parId.get(id));
    $('plateau').innerHTML = groupe.map(p => `<button type="button" class="tq" data-id="${p.id}"><img src="${p.image}" alt=""><span>${p.nom}</span></button>`).join('');
  };

  // ----- Groupe -----
  const composer = () => { // mes 15 + ceux de l'adversaire ; doublons remplacés au hasard (même graine des deux côtés)
    const ids = [...new Set(moi === 0 ? [...mine, ...advListe] : [...advListe, ...mine])];
    const reste = Core.pick(pool.filter(p => !ids.includes(p.id)), 2 * TAILLE - ids.length, Core.rng(seed + 7)).map(p => p.id);
    construire(Core.pick([...ids, ...reste], 2 * TAILLE, Core.rng(seed + 1)));
  };
  function essaiGroupe() { if (phase === 'groupe' && listeEnvoyee && advListe) { composer(); phase = 'secret'; } }
  function essaiJeu() { if (phase === 'secret' && secret !== null && advPret) { phase = 'jeu'; tour = D.tour; sub = 'tour'; } }
  function majListe() {
    $('compteur').textContent = `${mine.length}/${TAILLE}`;
    $('mes-pokes').innerHTML = '';
    for (const id of mine) {
      const li = document.createElement('li'), b = document.createElement('button');
      li.append(nomDe(id) + ' ');
      b.type = 'button'; b.textContent = '×'; b.className = 'sec'; b.disabled = listeEnvoyee; b.setAttribute('aria-label', `Retirer ${nomDe(id)}`);
      b.onclick = () => { mine = mine.filter(x => x !== id); majListe(); };
      li.append(b); $('mes-pokes').append(li);
    }
    $('valider-liste').disabled = mine.length !== TAILLE || listeEnvoyee;
  }
  const ajouterId = id => { if (listeEnvoyee || mine.length >= TAILLE || mine.includes(id)) return false; mine.push(id); majListe(); return true; };
  const hasard = n => { for (const p of Core.pick(pool.filter(p => !mine.includes(p.id)), n, Math.random)) ajouterId(p.id); };
  $('ajouter').onclick = () => {
    const p = pool.find(x => Core.norm(x.nom) === Core.norm($('ajout').value));
    $('info-groupe').textContent = !p ? 'Nom inconnu : choisis un Pokémon dans la liste.' : ajouterId(p.id) ? '' : 'Déjà dans ta sélection, ou sélection complète.';
    if (p) $('ajout').value = '';
  };
  $('ajout').addEventListener('keydown', e => { if (e.key === 'Enter') $('ajouter').click(); });
  $('hasard1').onclick = () => hasard(1);
  $('hasard').onclick = () => hasard(TAILLE - mine.length);
  $('valider-liste').onclick = () => { listeEnvoyee = true; send({ k: 'liste', ids: mine }); majListe(); essaiGroupe(); maj(); };

  // ----- Affichage -----
  function statut() {
    if (fini) return resultat;
    if (phase === 'groupe') return listeEnvoyee ? `En attente de la sélection de ${D.noms[adv]}…` : 'Compose ta moitié du groupe.';
    if (phase === 'secret') return secret === null ? 'Choisis le Pokémon que ton adversaire devra deviner : clique sur une tuile.' : `En attente du choix de ${D.noms[adv]}…`;
    if (sub === 'tour') return tour === moi ? 'À toi : pose une question ou devine le Pokémon.' : `${D.noms[tour]} réfléchit…`;
    if (sub === 'reponse') return tour === moi ? `En attente de la réponse de ${D.noms[adv]}…` : `${D.noms[tour]} te pose une question.`;
    return `${D.noms[tour]} propose un Pokémon…`;
  }
  function maj() {
    const jeu = phase === 'jeu', choixSecret = phase === 'secret' && secret === null;
    $('p-groupe').hidden = phase !== 'groupe';
    $('plateau').hidden = phase === 'groupe';
    $('p-jeu').hidden = $('journal').hidden = !jeu;
    $('zone-q').hidden = !monTour();
    $('zone-r').hidden = !(jeu && !fini && sub === 'reponse' && tour !== moi);
    $('deviner').textContent = modeDeviner ? 'Annuler la proposition' : 'Deviner le Pokémon';
    const ouvert = choix !== null && (choixSecret || (monTour() && modeDeviner)); // popup de validation
    $('modal').hidden = !ouvert;
    if (ouvert) {
      $('modal-img').src = parId.get(choix).image;
      $('modal-titre').textContent = choixSecret ? `${nomDe(choix)} sera ton Pokémon secret ?` : `Proposer ${nomDe(choix)} ?`;
      $('modal-texte').textContent = choixSecret ? 'Tu ne pourras plus le changer.' : `Si ce n'est pas le bon, la main passe à ${D.noms[adv]}.`;
      if (!modalOuvert) $('modal-ok').focus();
    }
    modalOuvert = ouvert;
    for (const t of $('plateau').children) { const id = Number(t.dataset.id); t.classList.toggle('sel', id === choix); t.classList.toggle('secret', id === secret); }
    $('mon-secret').textContent = secret === null ? '' : `Ton Pokémon, que ${D.noms[adv]} doit deviner : ${nomDe(secret)} (entouré en jaune).`;
    $('statut').textContent = statut();
  }
  function terminer(g, secretAdv) {
    fini = true;
    resultat = g === moi ? `Bravo, tu as deviné le Pokémon de ${D.noms[adv]} : tu gagnes la manche !` : `${D.noms[adv]} a deviné ton Pokémon : tu perds la manche.`;
    if (parId.has(secretAdv)) log(`Le Pokémon de ${D.noms[adv]} était ${nomDe(secretAdv)}.`);
    if (g === moi) { parent.postMessage({ pq: 'gagne' }, '*'); send({ k: 'revele', id: secret }); }
  }

  // ----- Actions du joueur -----
  $('plateau').onclick = e => {
    const t = e.target.closest('.tq');
    if (!t || fini) return;
    const id = Number(t.dataset.id);
    if ((phase === 'secret' && secret === null) || (monTour() && modeDeviner)) { choix = id; return maj(); } // un popup demande de valider
    t.classList.toggle('cache'); // cacher / réafficher une tuile (privé)
  };
  $('modal-ok').onclick = () => {
    if (choix === null) return;
    if (phase === 'secret' && secret === null) { secret = choix; choix = null; send({ k: 'pret' }); essaiJeu(); }
    else if (monTour() && modeDeviner) { dernier = choix; send({ k: 'guess', id: choix }); sub = 'verdict'; modeDeviner = false; choix = null; }
    maj();
  };
  $('modal-non').onclick = () => { choix = null; maj(); };
  addEventListener('keydown', e => { if (e.key === 'Escape' && choix !== null) { choix = null; maj(); } });
  $('deviner').onclick = () => { if (!monTour()) return; modeDeviner = !modeDeviner; choix = null; maj(); };
  $('envoyer').onclick = () => {
    const t = $('question').value.trim();
    if (!t || !monTour()) return;
    send({ k: 'question', texte: t }); log(`Toi : ${t}`);
    $('question').value = ''; modeDeviner = false; choix = null; sub = 'reponse'; maj();
  };
  for (const [id, oui] of [['oui', true], ['non', false]]) $(id).onclick = () => {
    if (!(phase === 'jeu' && !fini && sub === 'reponse' && tour !== moi)) return;
    send({ k: 'rep', oui }); log(`Tu réponds : ${oui ? 'Oui' : 'Non'}`); tour = moi; sub = 'tour'; maj();
  };

  // ----- Messages de l'adversaire -----
  function recevoir(m) {
    if (fini && m.k !== 'revele') return;
    if (m.k === 'liste') {
      if (Array.isArray(m.ids) && m.ids.length === TAILLE && new Set(m.ids).size === TAILLE && m.ids.every(id => parId.has(id))) { advListe = m.ids; essaiGroupe(); }
    } else if (m.k === 'pret') { advPret = true; essaiJeu(); }
    else if (m.k === 'question' && phase === 'jeu' && sub === 'tour' && tour === adv && typeof m.texte === 'string') {
      const q = m.texte.slice(0, 200); log(`${D.noms[adv]} demande : ${q}`); $('q-recue').textContent = q; sub = 'reponse';
    } else if (m.k === 'rep' && sub === 'reponse' && tour === moi) {
      log(`${D.noms[adv]} répond : ${m.oui ? 'Oui' : 'Non'}`); tour = adv; sub = 'tour';
    } else if (m.k === 'guess' && phase === 'jeu' && sub === 'tour' && tour === adv && parId.has(m.id)) {
      const ok = m.id === secret;
      send(ok ? { k: 'verdict', ok, secret } : { k: 'verdict', ok });
      if (ok) terminer(adv);
      else { log(`${D.noms[adv]} propose ${nomDe(m.id)} : raté !`); tour = moi; sub = 'tour'; }
    } else if (m.k === 'verdict' && sub === 'verdict' && tour === moi) {
      if (m.ok) terminer(moi, m.secret);
      else {
        log(`Tu proposes ${nomDe(dernier)} : raté, ce n'est pas son Pokémon.`);
        const t = $('plateau').querySelector(`[data-id="${dernier}"]`); if (t) t.classList.add('cache');
        tour = adv; sub = 'tour';
      }
    } else if (m.k === 'revele' && fini && parId.has(m.id)) log(`Le Pokémon de ${D.noms[adv]} était ${nomDe(m.id)}.`);
    maj();
  }

  // ----- Démarrage -----
  if (perso) majListe(); else { construire(Core.pick(pool, 2 * TAILLE, Core.rng(seed)).map(p => p.id)); }
  maj();
  addEventListener('message', e => { const m = e.data; if (e.source === parent && m && m.pq === 'coup' && m.val && typeof m.val === 'object') recevoir(m.val); });
  parent.postMessage({ pq: 'pret' }, '*');
})();
