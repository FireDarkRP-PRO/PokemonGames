// Comptes et statistiques (Firebase Auth + Firestore). Chargé en module ; expose window.Compte.
// Pas d'e-mail réel : le pseudo sert à fabriquer un e-mail factice (voir firestore.rules).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, query, orderBy, limit, serverTimestamp, runTransaction, writeBatch } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

// Configuration publique (ce n'est pas un secret : la sécurité vient des règles Firestore).
const app = initializeApp({
  apiKey: 'AIzaSyDYNtXAGZqmVyK6ivq6eiO1Mwo8sHvPt1o',
  authDomain: 'pokemongames-7f7fb.firebaseapp.com',
  projectId: 'pokemongames-7f7fb',
  storageBucket: 'pokemongames-7f7fb.firebasestorage.app',
  messagingSenderId: '1032706021167',
  appId: '1:1032706021167:web:6aea2b022422e1627133da'
});
const auth = getAuth(app), db = getFirestore(app);

const JEUX = {
  silhouette: 'Silhouette', cri: 'Cri', pixel: 'Image pixelisée', description: 'Description du Pokédex', caracteristiques: 'Caractéristiques',
  pokedle: 'Pokédle', plusmoins: 'Plus ou moins', types: 'Efficacité des types', intrus: "Quel est l'intrus ?",
  shiny: 'Lequel est le shiny ?', memory: 'Memory', quiestce: 'Qui est-ce ? (aléatoire)', 'quiestce-perso': 'Qui est-ce ? (personnalisé)',
  'grid-facile': 'Pokémon Grid (Facile)', 'grid-normal': 'Pokémon Grid (Normal)', 'grid-difficile': 'Pokémon Grid (Difficile)', 'grid-expert': 'Pokémon Grid (Expert)', grid: 'Pokémon Grid (duel)'
};
const PSEUDO = /^[A-Za-z0-9_-]{3,16}$/;
const email = p => p.toLowerCase() + '@joueurs.pokemongames.invalid';

let utilisateur = null, pseudo = null, pret = false, enCours = false;
const ecouteurs = [];
const notifier = () => ecouteurs.forEach(f => f(utilisateur, pseudo));
const ecoute = f => { ecouteurs.push(f); if (pret) f(utilisateur, pseudo); };

async function assurerProfil(u) { // crée le profil s'il manque (inscription interrompue)
  const ref = doc(db, 'joueurs', u.uid), s = await getDoc(ref);
  if (s.exists()) return s.data().pseudo;
  const p = u.displayName || u.email.split('@')[0];
  await setDoc(ref, { pseudo: p, creeLe: serverTimestamp() });
  return p;
}
onAuthStateChanged(auth, async u => {
  if (enCours) return; // inscription en cours : elle notifie elle-même
  utilisateur = u; pseudo = null;
  if (u) { try { pseudo = await assurerProfil(u); } catch (e) { console.warn(e); } }
  pret = true; notifier();
});

async function inscrire(p, mdp) {
  if (!PSEUDO.test(p)) throw new Error('pseudo invalide');
  enCours = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email(p), mdp);
    await updateProfile(cred.user, { displayName: p });
    await setDoc(doc(db, 'joueurs', cred.user.uid), { pseudo: p, creeLe: serverTimestamp() });
    utilisateur = cred.user; pseudo = p; pret = true; notifier();
  } finally { enCours = false; }
}
const connecter = (p, mdp) => signInWithEmailAndPassword(auth, email(p), mdp);
const deconnecter = () => signOut(auth);
async function supprimerCompte(mdp) { // supprime les statistiques, le profil, puis le compte
  const u = auth.currentUser;
  if (!u) return;
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, mdp));
  const lot = writeBatch(db);
  for (const j of Object.keys(JEUX)) lot.delete(doc(db, 'classements', j, 'joueurs', u.uid));
  lot.delete(doc(db, 'joueurs', u.uid));
  await lot.commit();
  await deleteUser(u);
}

// Mise à jour atomique des statistiques d'un jeu.
function maj(jeu, calcul) {
  if (!auth.currentUser || !pseudo || !JEUX[jeu]) return Promise.resolve();
  const ref = doc(db, 'classements', jeu, 'joueurs', auth.currentUser.uid);
  return runTransaction(db, async tx => {
    const s = await tx.get(ref), a = s.exists() ? s.data() : {};
    tx.set(ref, { ...a, ...calcul(a), pseudo, derniere: serverTimestamp() });
  });
}
const enregistrer = async (jeu, score) => {
  if (!Number.isInteger(score) || score < 1) return;
  await maj(jeu, a => ({ record: Math.min(a.record ?? Infinity, score), parties: (a.parties || 0) + 1, total: (a.total || 0) + score }));
};
const enregistrerDuel = async (jeu, resultat) => { // 'victoire' | 'defaite' | 'nul'
  await maj(jeu, a => ({ duels: (a.duels || 0) + 1, victoires: (a.victoires || 0) + (resultat === 'victoire' ? 1 : 0), nuls: (a.nuls || 0) + (resultat === 'nul' ? 1 : 0) }));
};

async function statsJoueur(uid) {
  const res = {};
  await Promise.all(Object.keys(JEUX).map(async j => { const s = await getDoc(doc(db, 'classements', j, 'joueurs', uid)); if (s.exists()) res[j] = s.data(); }));
  return res;
}
async function top(jeu, champ, sens = 'asc', n = 20) {
  if (!JEUX[jeu] || !['record', 'victoires'].includes(champ)) return [];
  const s = await getDocs(query(collection(db, 'classements', jeu, 'joueurs'), orderBy(champ, sens), limit(n)));
  return s.docs.map(d => ({ uid: d.id, ...d.data() }));
}

window.Compte = { JEUX, ecoute, utilisateur: () => auth.currentUser, inscrire, connecter, deconnecter, supprimerCompte, enregistrer, enregistrerDuel, statsJoueur, top };
window.dispatchEvent(new Event('compte-pret'));
