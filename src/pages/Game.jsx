import { useState } from "react";
import { rollDice, calculateScores, CATEGORY_NAMES } from "../utils/yahtzee";
import { useAuth } from "../context/AuthContext";

const initialDice = [1, 1, 1, 1, 1];
const initialKept = [false, false, false, false, false];

const Game = () => {
  const { playerProfile } = useAuth();
  const [dice, setDice] = useState(initialDice);
  const [kept, setKept] = useState(initialKept);
  const [rollsLeft, setRollsLeft] = useState(3);
  const [scores, setScores] = useState({});
  const [currentScores, setCurrentScores] = useState({});

  const handleRoll = () => {
    if (rollsLeft === 0) return;
    const newDice = rollDice(dice, kept);
    setDice(newDice);
    setRollsLeft(rollsLeft - 1);
    setCurrentScores(calculateScores(newDice));
  };

  const toggleKeep = (i) => {
    if (rollsLeft === 3) return;
    const newKept = [...kept];
    newKept[i] = !newKept[i];
    setKept(newKept);
  };

  const selectCategory = (category) => {
    if (scores[category] !== undefined) return;
    if (rollsLeft === 3) return;
    setScores({ ...scores, [category]: currentScores[category] });
    setDice(initialDice);
    setKept(initialKept);
    setRollsLeft(3);
    setCurrentScores({});
  };

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  return (
    <div style={{ color: "white", textAlign: "center", padding: "20px" }}>
      <h1>🎲 Yahtzee</h1>
      <p>Joueur : {playerProfile?.pseudo}</p>
      <p>Score total : {totalScore}</p>

      {/* Dés */}
      <div style={{ display: "flex", justifyContent: "center", gap: "10px", margin: "20px 0" }}>
        {dice.map((die, i) => (
          <div
            key={i}
            onClick={() => toggleKeep(i)}
            style={{
              width: "60px",
              height: "60px",
              background: kept[i] ? "#f0c040" : "#fff",
              color: "#333",
              fontSize: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "bold",
              border: kept[i] ? "3px solid orange" : "3px solid #ccc",
            }}
          >
            {die}
          </div>
        ))}
      </div>

      <p>Lancers restants : {rollsLeft}</p>
      <button
        onClick={handleRoll}
        disabled={rollsLeft === 0}
        style={{ padding: "10px 30px", fontSize: "16px", cursor: "pointer", marginBottom: "20px" }}
      >
        🎲 Lancer
      </button>

      {/* Feuille de score */}
      <h2>Feuille de score</h2>
      <div style={{ display: "inline-block", textAlign: "left" }}>
        {Object.entries(CATEGORY_NAMES).map(([key, label]) => (
          <div
            key={key}
            onClick={() => selectCategory(key)}
            style={{
              padding: "8px 16px",
              margin: "4px 0",
              background: scores[key] !== undefined ? "#2d5a2d" : "#1a1a2e",
              borderRadius: "8px",
              cursor: scores[key] !== undefined ? "default" : "pointer",
              display: "flex",
              justifyContent: "space-between",
              gap: "40px",
              opacity: scores[key] !== undefined ? 0.7 : 1,
            }}
          >
            <span>{label}</span>
            <span>
              {scores[key] !== undefined
                ? scores[key]
                : currentScores[key] !== undefined
                ? `(${currentScores[key]})`
                : "-"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Game;