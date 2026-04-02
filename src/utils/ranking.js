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

export const getLeaderboard = async () => {
  const q = query(
    collection(db, "players"),
    orderBy("victories", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getLeaderboardByPoints = async () => {
  const q = query(
    collection(db, "players"),
    orderBy("totalPoints", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getLeaderboardTriple = async () => {
  const q = query(
    collection(db, "players"),
    orderBy("tripleVictories", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getLeaderboardTriplePoints = async () => {
  const q = query(
    collection(db, "players"),
    orderBy("triplePoints", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const updatePlayerStats = async (winnerUid, loserUid, points, mode) => {
  const winnerRef = doc(db, "players", winnerUid);
  const loserRef = doc(db, "players", loserUid);

  const winnerUpdate = {
    victories: increment(1),
    totalGames: increment(1),
    totalPoints: increment(points.winner),
  };

  const loserUpdate = {
    defeats: increment(1),
    totalGames: increment(1),
    totalPoints: increment(points.loser),
  };

  if (mode === "triple") {
    winnerUpdate.tripleVictories = increment(1);
    winnerUpdate.tripleGames = increment(1);
    loserUpdate.tripleGames = increment(1);
    winnerUpdate.triplePoints = increment(points.winner);
    loserUpdate.triplePoints = increment(points.loser);
  }

  await updateDoc(winnerRef, winnerUpdate);
  await updateDoc(loserRef, loserUpdate);
};