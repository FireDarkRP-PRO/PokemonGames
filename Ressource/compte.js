// Page « Mon compte » : connexion, inscription, profil et statistiques.
Core.surCompte(C => {
  const $ = id => document.getElementById(id);
  const ERR = {
    'auth/email-already-in-use': 'Ce pseudo est déjà pris.', 'auth/invalid-credential': 'Pseudo ou mot de passe incorrect.',
    'auth/wrong-password': 'Pseudo ou mot de passe incorrect.', 'auth/user-not-found': 'Pseudo ou mot de passe incorrect.',
    'auth/weak-password': 'Mot de passe trop faible (8 caractères minimum).', 'auth/too-many-requests': 'Trop de tentatives : réessaie plus tard.',
    'auth/network-request-failed': 'Problème de connexion.', 'auth/invalid-email': 'Pseudo refusé par le service de comptes.'
  };
  const erreur = e => ERR[e.code] || `Erreur : ${e.code || e.message}`;
  const COULEURS = ['#e0392b', '#ffcb05', '#243b6b', '#2e9e5b', '#8e44ad', '#e67e22', '#16a0b8', '#d6336c', '#7f8c8d', '#9acd32', '#ff8fab', '#4b6cb7', '#a0522d'];
  let creation = false;
  const msg = t => { $('msg').textContent = t; };
  function mode(c) {
    creation = c;
    $('envoyer').textContent = c ? 'Créer mon compte' : 'Se connecter';
    $('l-mdp2').hidden = $('note-mdp').hidden = !c;
    $('mdp').autocomplete = c ? 'new-password' : 'current-password';
    $('onglet-cr').classList.toggle('sec', !c); $('onglet-co').classList.toggle('sec', c); msg('');
  }
  $('onglet-co').onclick = () => mode(false);
  $('onglet-cr').onclick = () => mode(true);
  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    const p = $('pseudo').value.trim(), m = $('mdp').value;
    if (!/^[A-Za-z0-9_-]{3,16}$/.test(p)) return msg('Pseudo : 3 à 16 caractères (lettres, chiffres, - et _).');
    if (m.length < 8) return msg('Mot de passe : 8 caractères minimum.');
    if (creation && m !== $('mdp2').value) return msg('Les deux mots de passe sont différents.');
    $('envoyer').disabled = true; msg('…');
    try { await (creation ? C.inscrire(p, m) : C.connecter(p, m)); msg(''); $('mdp').value = $('mdp2').value = ''; }
    catch (err) { msg(erreur(err)); }
    finally { $('envoyer').disabled = false; }
  });
  $('deco').onclick = () => C.deconnecter();
  $('supprimer').onclick = async () => {
    if (!$('mdp-sup').value) { $('msg-sup').textContent = 'Entre ton mot de passe pour confirmer.'; return; }
    if (!confirm('Supprimer définitivement ton compte et toutes tes statistiques ?')) return;
    try { await C.supprimerCompte($('mdp-sup').value); }
    catch (err) { $('msg-sup').textContent = erreur(err); }
  };

  function camembert(donnees) { // [{ nom, valeur }]
    const cible = $('camembert'), total = donnees.reduce((s, d) => s + d.valeur, 0);
    cible.innerHTML = '';
    if (!total) { cible.textContent = 'Pas encore de partie terminée.'; return; }
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), ul = document.createElement('ul');
    svg.setAttribute('viewBox', '-1.05 -1.05 2.1 2.1'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Répartition des parties par jeu');
    ul.className = 'legende';
    let angle = -Math.PI / 2;
    donnees.forEach((d, i) => {
      const part = d.valeur / total, fin = angle + part * 2 * Math.PI, couleur = COULEURS[i % COULEURS.length];
      const el = document.createElementNS(NS, donnees.length === 1 ? 'circle' : 'path');
      if (donnees.length === 1) el.setAttribute('r', 1);
      else el.setAttribute('d', `M0 0 L${Math.cos(angle)} ${Math.sin(angle)} A1 1 0 ${part > .5 ? 1 : 0} 1 ${Math.cos(fin)} ${Math.sin(fin)} Z`);
      el.setAttribute('fill', couleur); el.setAttribute('stroke', '#1a2744'); el.setAttribute('stroke-width', '.02');
      svg.append(el); angle = fin;
      const li = document.createElement('li'), pastille = document.createElement('span');
      pastille.className = 'pastille'; pastille.style.background = couleur;
      li.append(pastille, `${d.nom} : ${d.valeur} (${Math.round(part * 100)} %)`); ul.append(li);
    });
    cible.append(svg, ul);
  }

  async function profil(u, pseudo) {
    $('entete').textContent = pseudo ? `Connecté : ${pseudo}` : 'Compte connecté, mais le profil est introuvable.';
    $('stats').innerHTML = '';
    let stats = {};
    try { stats = await C.statsJoueur(u.uid); } catch (e) { console.warn(e); }
    const jeux = Object.keys(C.JEUX).filter(j => stats[j]);
    $('aucune').hidden = jeux.length > 0;
    const donnees = [];
    for (const j of jeux) {
      const s = stats[j], parties = s.parties || 0, duels = s.duels || 0, v = s.victoires || 0, n = s.nuls || 0;
      const tr = document.createElement('tr');
      for (const t of [C.JEUX[j], s.record ?? '–', parties || '–', parties ? (s.total / parties).toFixed(1) : '–', duels ? `${v} / ${n} / ${duels - v - n}` : '–']) {
        const td = document.createElement('td'); td.textContent = t; tr.append(td);
      }
      $('stats').append(tr);
      donnees.push({ nom: C.JEUX[j], valeur: parties + duels });
    }
    camembert(donnees.filter(d => d.valeur > 0).sort((a, b) => b.valeur - a.valeur));
  }

  C.ecoute((u, pseudo) => {
    $('chargement').hidden = true;
    $('visiteur').hidden = !!u; $('profil').hidden = !u;
    if (u) profil(u, pseudo);
  });
});
