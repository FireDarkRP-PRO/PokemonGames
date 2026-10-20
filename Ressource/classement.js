// Page « Classements » : meilleurs records et victoires en duel, par jeu.
Core.surCompte(C => {
  const $ = id => document.getElementById(id);
  $('jeu').innerHTML = Object.entries(C.JEUX).map(([id, nom]) => `<option value="${id}">${nom}</option>`).join('');
  const lignes = (corps, rangs, moi) => {
    corps.innerHTML = '';
    if (!rangs.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 5; td.textContent = 'Personne pour le moment.'; tr.append(td); corps.append(tr); return; }
    rangs.forEach((cells, i) => {
      const tr = document.createElement('tr');
      if (cells.moi) tr.className = 'moi';
      for (const t of [i + 1, ...cells.valeurs]) { const td = document.createElement('td'); td.textContent = t; tr.append(td); }
      corps.append(tr);
    });
  };
  async function charger() {
    const jeu = $('jeu').value, u = C.utilisateur(), duelSeul = jeu.startsWith('quiestce') || jeu === 'grid';
    $('solo-bloc').hidden = duelSeul; $('msg').textContent = 'Chargement…';
    try {
      const [solo, duel] = await Promise.all([duelSeul ? [] : C.top(jeu, 'record', 'asc'), C.top(jeu, 'victoires', 'desc')]);
      lignes($('solo'), solo.map(d => ({ moi: u && d.uid === u.uid, valeurs: [d.pseudo, d.record, d.parties || 0, d.parties ? (d.total / d.parties).toFixed(1) : '–'] })));
      lignes($('duel'), duel.map(d => ({ moi: u && d.uid === u.uid, valeurs: [d.pseudo, d.victoires || 0, d.duels || 0, d.duels ? Math.round(100 * (d.victoires || 0) / d.duels) + ' %' : '–'] })));
      $('msg').textContent = '';
    } catch (e) { $('msg').textContent = 'Impossible de charger le classement (' + (e.code || e.message) + ').'; }
  }
  $('jeu').onchange = charger;
  C.ecoute(charger); // relance aussi quand la connexion change (ligne du joueur en surbrillance)
});
