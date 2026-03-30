import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";

// Récupérer le classement des 100 meilleurs joueurs
export const getLeaderboard = async () => {
  const q = query(
    collection(db, "players"),
    orderBy("victories", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Mettre à jour les stats après une partie
export const updatePlayerStats = async (winnerUid, loserUid) => {
  const winnerRef = doc(db, "players", winnerUid);
  const loserRef = doc(db, "players", loserUid);

  await updateDoc(winnerRef, {
    victories: increment(1),
    totalGames: increment(1),
  });

  await updateDoc(loserRef, {
    defeats: increment(1),
    totalGames: increment(1),
  });
};