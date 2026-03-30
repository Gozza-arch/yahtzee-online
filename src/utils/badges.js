import { db } from "../firebase";
import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";

// Définition de tous les badges
export const BADGES = {
  first_game: { id: "first_game", label: "Première partie", icon: "🎮", description: "Tu as joué ta première partie !" },
  first_victory: { id: "first_victory", label: "Première victoire", icon: "🏆", description: "Tu as gagné ta première partie !" },
  yahtzee_scorer: { id: "yahtzee_scorer", label: "Yahtzee !", icon: "🎲", description: "Tu as réussi un Yahtzee !" },
  ten_victories: { id: "ten_victories", label: "10 victoires", icon: "⭐", description: "Tu as gagné 10 parties !" },
  perfect_upper: { id: "perfect_upper", label: "Section haute parfaite", icon: "💯", description: "Tu as rempli toute la section haute !" },
};

// Vérifier et attribuer les badges mérités
export const checkAndAwardBadges = async (playerUid, scores, isWinner, victories) => {
  const playerRef = doc(db, "players", playerUid);
  const playerSnap = await getDoc(playerRef);
  const playerData = playerSnap.data();
  const currentBadges = playerData.badges || [];
  const newBadges = [];

  // Première partie
  if (!currentBadges.includes("first_game")) {
    newBadges.push("first_game");
  }

  // Première victoire
  if (isWinner && !currentBadges.includes("first_victory")) {
    newBadges.push("first_victory");
  }

  // 10 victoires
  if (isWinner && victories >= 10 && !currentBadges.includes("ten_victories")) {
    newBadges.push("ten_victories");
  }

  // Yahtzee réussi
  if (scores.yahtzee === 50 && !currentBadges.includes("yahtzee_scorer")) {
    newBadges.push("yahtzee_scorer");
  }

  // Section haute parfaite (ones à sixes tous remplis)
  const upperCategories = ["ones", "twos", "threes", "fours", "fives", "sixes"];
  const upperComplete = upperCategories.every((cat) => scores[cat] !== undefined);
  if (upperComplete && !currentBadges.includes("perfect_upper")) {
    newBadges.push("perfect_upper");
  }

  // Attribuer les nouveaux badges
  if (newBadges.length > 0) {
    await updateDoc(playerRef, {
      badges: arrayUnion(...newBadges),
    });
  }

  return newBadges.map((id) => BADGES[id]);
};