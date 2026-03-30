// Lancer les dés
export const rollDice = (currentDice, kept) => {
  return currentDice.map((die, i) =>
    kept[i] ? die : Math.floor(Math.random() * 6) + 1
  );
};

// Calculer les scores pour chaque catégorie
export const calculateScores = (dice) => {
  const counts = [0, 0, 0, 0, 0, 0];
  dice.forEach((d) => counts[d - 1]++);
  const sum = dice.reduce((a, b) => a + b, 0);
  const uniqueValues = new Set(dice).size;

  return {
    ones:   counts[0] * 1,
    twos:   counts[1] * 2,
    threes: counts[2] * 3,
    fours:  counts[3] * 4,
    fives:  counts[4] * 5,
    sixes:  counts[5] * 6,
    threeOfAKind: counts.some((c) => c >= 3) ? sum : 0,
    fourOfAKind:  counts.some((c) => c >= 4) ? sum : 0,
    fullHouse: counts.some((c) => c === 3) && counts.some((c) => c === 2) ? 25 : 0,
    smallStraight: (
      (counts[0] && counts[1] && counts[2] && counts[3]) ||
      (counts[1] && counts[2] && counts[3] && counts[4]) ||
      (counts[2] && counts[3] && counts[4] && counts[5])
    ) ? 30 : 0,
    largeStraight: uniqueValues === 5 && (
      (counts[0] && counts[1] && counts[2] && counts[3] && counts[4]) ||
      (counts[1] && counts[2] && counts[3] && counts[4] && counts[5])
    ) ? 40 : 0,
    yahtzee: counts.some((c) => c === 5) ? 50 : 0,
    chance: sum,
  };
};

// Catégories section haute
export const UPPER_CATEGORIES = ["ones", "twos", "threes", "fours", "fives", "sixes"];

// Catégories section basse
export const LOWER_CATEGORIES = [
  "threeOfAKind", "fourOfAKind", "fullHouse",
  "smallStraight", "largeStraight", "yahtzee", "chance"
];

// Noms des catégories
export const CATEGORY_NAMES = {
  ones: "As (1)",
  twos: "Deux (2)",
  threes: "Trois (3)",
  fours: "Quatre (4)",
  fives: "Cinq (5)",
  sixes: "Six (6)",
  threeOfAKind: "Brelan",
  fourOfAKind: "Carré",
  fullHouse: "Full House (25pts)",
  smallStraight: "Petite suite (30pts)",
  largeStraight: "Grande suite (40pts)",
  yahtzee: "Yahtzee ! (50pts)",
  chance: "Chance",
};

// Calculer le total section haute + bonus
export const calculateUpperBonus = (scores) => {
  const upperTotal = UPPER_CATEGORIES.reduce((sum, cat) => sum + (scores[cat] || 0), 0);
  const bonus = upperTotal >= 63 ? 35 : 0;
  return { upperTotal, bonus };
};

// Calculer le score total avec bonus
export const calculateTotalScore = (scores) => {
  const { upperTotal, bonus } = calculateUpperBonus(scores);
  const lowerTotal = LOWER_CATEGORIES.reduce((sum, cat) => sum + (scores[cat] || 0), 0);
  return upperTotal + bonus + lowerTotal;
};