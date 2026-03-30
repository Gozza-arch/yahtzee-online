import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Convertit le pseudo en email fictif
const pseudoToEmail = (pseudo) => {
  return `${pseudo.toLowerCase().trim()}@yahtzee.game`;
};

// Inscription
export const register = async (pseudo, password) => {
  const email = pseudoToEmail(pseudo);
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Crée le profil joueur dans Firestore
  await setDoc(doc(db, "players", user.uid), {
    pseudo: pseudo,
    victories: 0,
    defeats: 0,
    totalGames: 0,
    badges: [],
    createdAt: new Date(),
  });

  return user;
};

// Connexion
export const login = async (pseudo, password) => {
  const email = pseudoToEmail(pseudo);
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

// Déconnexion
export const logout = async () => {
  await signOut(auth);
};

// Récupérer le profil joueur
export const getPlayerProfile = async (uid) => {
  const docRef = doc(db, "players", uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
};