import { db } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  getDoc,
  arrayUnion,
  increment,
} from "firebase/firestore";

export const createGame = async (playerUid, playerPseudo, mode = "classic", playerAvatar = "🎲") => {
  const isTriple = mode === "triple";
  const gameRef = await addDoc(collection(db, "games"), {
    status: "waiting",
    mode,
    creatorUid: playerUid,
    players: {
      [playerUid]: { pseudo: playerPseudo, avatar: playerAvatar, scores: isTriple ? { grid1: {}, grid2: {}, grid3: {} } : {}, ready: true },
    },
    currentTurn: playerUid,
    dice: [1, 1, 1, 1, 1],
    kept: [false, false, false, false, false],
    rollsLeft: 3,
    createdAt: new Date(),
  });
  return gameRef.id;
};

// Rejoindre une partie existante
export const joinGame = async (gameId, playerUid, playerPseudo, playerAvatar = "🎲") => {
  const gameRef = doc(db, "games", gameId);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) throw new Error("Partie introuvable");
  const game = gameSnap.data();
  if (Object.keys(game.players).length >= 2) throw new Error("Partie pleine");

  const isTriple = game.mode === "triple";
  await updateDoc(gameRef, {
    [`players.${playerUid}.pseudo`]: playerPseudo,
    [`players.${playerUid}.avatar`]: playerAvatar,
    [`players.${playerUid}.scores`]: isTriple ? { grid1: {}, grid2: {}, grid3: {} } : {},
    [`players.${playerUid}.ready`]: true,
    status: "playing",
  });
};

// Écouter les changements d'une partie en temps réel
export const listenToGame = (gameId, callback) => {
  const gameRef = doc(db, "games", gameId);
  return onSnapshot(gameRef, (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
};

// Mettre à jour l'état des dés
export const updateDice = async (gameId, dice, kept, rollsLeft) => {
  const gameRef = doc(db, "games", gameId);
  await updateDoc(gameRef, { 
    dice, 
    kept, 
    rollsLeft,
    lastDice: dice,
  });
};

export const saveScore = async (gameId, playerUid, category, score, players, bonusYahtzee = 0) => {
  const gameRef = doc(db, "games", gameId);
  const playerIds = Object.keys(players);
  const nextPlayer = playerIds.find((id) => id !== playerUid) || playerUid;

  const myScores = { ...(players[playerUid]?.scores || {}), [category]: score };
  const myComplete = Object.keys(myScores).length === 13;
  const otherPlayerUid = nextPlayer;
  const otherScores = players[otherPlayerUid]?.scores || {};
  const otherComplete = Object.keys(otherScores).length === 13;
  const gameComplete = myComplete && otherComplete;

  await updateDoc(gameRef, {
  [`players.${playerUid}.scores.${category}`]: score,
  [`players.${playerUid}.yahtzeeBonus`]: increment(bonusYahtzee),
  currentTurn: myComplete && !otherComplete ? otherPlayerUid : nextPlayer,
  status: gameComplete ? "finished" : "playing",
  dice: [1, 1, 1, 1, 1],
  kept: [false, false, false, false, false],
  rollsLeft: 3,
  history: arrayUnion({
    playerUid,
    pseudo: players[playerUid].pseudo,
    category,
    score,
    dice: [],
    timestamp: Date.now(),
  }),
});
};

// Quitter une partie
export const leaveGame = async (gameId) => {
  const gameRef = doc(db, "games", gameId);
  await updateDoc(gameRef, {
    status: "abandoned",
  });
};
// Sauvegarder un score en mode triple
export const saveTripleScore = async (gameId, playerUid, category, score, grid, players) => {
  const gameRef = doc(db, "games", gameId);
  const playerIds = Object.keys(players);
  const nextPlayer = playerIds.find((id) => id !== playerUid) || playerUid;

  // Vérifier si toutes les grilles du joueur actif sont complètes
  const currentGrids = players[playerUid].scores;
  const updatedGrid = { ...currentGrids[grid], [category]: score };

  const totalCategories = 13;
  const myAllComplete = ["grid1", "grid2", "grid3"].every(g =>
    Object.keys(g === grid ? updatedGrid : currentGrids[g] || {}).length === totalCategories
  );

  const otherPlayerUid = nextPlayer;
  const otherGrids = players[otherPlayerUid]?.scores || {};
  const otherAllComplete = ["grid1", "grid2", "grid3"].every(g =>
    Object.keys(otherGrids[g] || {}).length === totalCategories
  );

  const gameComplete = myAllComplete && otherAllComplete;

  await updateDoc(gameRef, {
    [`players.${playerUid}.scores.${grid}.${category}`]: score,
    currentTurn: myAllComplete && !otherAllComplete ? otherPlayerUid : nextPlayer,
    status: gameComplete ? "finished" : "playing",
    dice: [1, 1, 1, 1, 1],
    kept: [false, false, false, false, false],
    rollsLeft: 3,
    history: arrayUnion({
      playerUid,
      pseudo: players[playerUid].pseudo,
      category,
      score,
      grid,
      dice: [],
      timestamp: Date.now(),
    }),
  });
};