import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { rollDice, calculateScores, CATEGORY_NAMES } from "../utils/yahtzee";
import { listenToGame, updateDice, saveScore, updatePlayerStats } from "../utils/gameManager";
import { checkAndAwardBadges } from "../utils/badges";
import BadgeNotification from "../components/BadgeNotification";

const TOTAL_CATEGORIES = Object.keys(CATEGORY_NAMES).length;

const Game = () => {
  const { gameId } = useParams();
  const { currentUser, playerProfile } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [currentScores, setCurrentScores] = useState({});
  const [newBadges, setNewBadges] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);

  const checkGameOver = useCallback(async (gameData) => {
    const players = Object.entries(gameData.players);
    const allDone = players.every(([, player]) =>
      Object.keys(player.scores).length === TOTAL_CATEGORIES
    );

    if (allDone && !gameOver) {
      setGameOver(true);
      const scores = players.map(([uid, player]) => ({
        uid,
        total: Object.values(player.scores).reduce((a, b) => a + b, 0),
      }));
      const winnerData = scores.reduce((a, b) => (a.total > b.total ? a : b));
      const loserData = scores.reduce((a, b) => (a.total < b.total ? a : b));
      setWinner(winnerData);

      // Mettre à jour les stats
      await updatePlayerStats(winnerData.uid, loserData.uid);

      // Vérifier les badges
      const myScores = gameData.players[currentUser.uid]?.scores || {};
      const isWinner = winnerData.uid === currentUser.uid;
      const victories = (playerProfile?.victories || 0) + (isWinner ? 1 : 0);
      const awarded = await checkAndAwardBadges(currentUser.uid, myScores, isWinner, victories);
      if (awarded.length > 0) setNewBadges(awarded);
    }
  }, [gameOver, currentUser.uid, playerProfile]);

  useEffect(() => {
    const unsubscribe = listenToGame(gameId, (gameData) => {
      setGame(gameData);
      if (gameData.rollsLeft < 3) {
        setCurrentScores(calculateScores(gameData.dice));
      }
      if (gameData.status === "playing") {
        checkGameOver(gameData);
      }
    });
    return unsubscribe;
  }, [gameId, checkGameOver]);

  if (!game) return <div style={{ color: "white", textAlign: "center", marginTop: "100px" }}>Chargement...</div>;

  const isMyTurn = game.currentTurn === currentUser.uid;
  const myScores = game.players[currentUser.uid]?.scores || {};
  const players = Object.entries(game.players);
  const shareLink = `${window.location.origin}/game/${gameId}`;

  const handleRoll = async () => {
    if (!isMyTurn || game.rollsLeft === 0) return;
    const newDice = rollDice(game.dice, game.kept);
    await updateDice(gameId, newDice, game.kept, game.rollsLeft - 1);
  };

  const toggleKeep = async (i) => {
    if (!isMyTurn || game.rollsLeft === 3) return;
    const newKept = [...game.kept];
    newKept[i] = !newKept[i];
    await updateDice(gameId, game.dice, newKept, game.rollsLeft);
  };

  const selectCategory = async (category) => {
    if (!isMyTurn || myScores[category] !== undefined || game.rollsLeft === 3) return;
    await saveScore(gameId, currentUser.uid, category, currentScores[category], game.players);
    setCurrentScores({});
  };

  const totalScore = Object.values(myScores).reduce((a, b) => a + b, 0);

  return (
    <div style={{ color: "white", textAlign: "center", padding: "20px" }}>

      {/* Notification de badges */}
      {newBadges.length > 0 && (
        <BadgeNotification badges={newBadges} onClose={() => setNewBadges([])} />
      )}

      <h1>🎲 Yahtzee</h1>

      {/* Fin de partie */}
      {gameOver && winner && (
        <div style={{
          background: winner.uid === currentUser.uid ? "#2d5a2d" : "#5a2d2d",
          padding: "20px", borderRadius: "12px", marginBottom: "20px"
        }}>
          <h2>{winner.uid === currentUser.uid ? "🏆 Tu as gagné !" : "😢 Tu as perdu !"}</h2>
          <button onClick={() => navigate("/")} style={{ padding: "10px 30px", cursor: "pointer" }}>
            🏠 Retour au lobby
          </button>
        </div>
      )}

      {/* En attente d'un adversaire */}
      {game.status === "waiting" && (
        <div style={{ background: "#1a1a2e", padding: "15px", borderRadius: "10px", marginBottom: "20px" }}>
          <p>⏳ En attente d'un adversaire...</p>
          <p style={{ fontSize: "12px", color: "#aaa" }}>Partage ce lien :</p>
          <p style={{ fontSize: "12px", background: "#333", padding: "8px", borderRadius: "5px" }}>{shareLink}</p>
          <button onClick={() => navigator.clipboard.writeText(shareLink)} style={{ padding: "6px 16px", cursor: "pointer" }}>
            📋 Copier le lien
          </button>
        </div>
      )}

      {/* Scores des joueurs */}
      <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "20px" }}>
        {players.map(([uid, player]) => (
          <div key={uid} style={{
            background: uid === game.currentTurn ? "#2d5a2d" : "#1a1a2e",
            padding: "10px 20px", borderRadius: "10px"
          }}>
            <p>{uid === game.currentTurn ? "🎯 " : ""}{player.pseudo}</p>
            <p>{Object.values(player.scores).reduce((a, b) => a + b, 0)} pts</p>
          </div>
        ))}
      </div>

      {/* Dés */}
      <div style={{ display: "flex", justifyContent: "center", gap: "10px", margin: "20px 0" }}>
        {game.dice.map((die, i) => (
          <div
            key={i}
            onClick={() => toggleKeep(i)}
            style={{
              width: "60px", height: "60px",
              background: game.kept[i] ? "#f0c040" : "#fff",
              color: "#333", fontSize: "28px",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: "10px", cursor: isMyTurn ? "pointer" : "default",
              fontWeight: "bold",
              border: game.kept[i] ? "3px solid orange" : "3px solid #ccc",
            }}
          >
            {die}
          </div>
        ))}
      </div>

      <p>{isMyTurn ? `Lancers restants : ${game.rollsLeft}` : "⏳ Tour de l'adversaire..."}</p>

      <button
        onClick={handleRoll}
        disabled={!isMyTurn || game.rollsLeft === 0}
        style={{ padding: "10px 30px", fontSize: "16px", cursor: "pointer", marginBottom: "20px" }}
      >
        🎲 Lancer
      </button>

      {/* Feuille de score */}
      <h2>Ta feuille de score ({totalScore} pts)</h2>
      <div style={{ display: "inline-block", textAlign: "left" }}>
        {Object.entries(CATEGORY_NAMES).map(([key, label]) => (
          <div
            key={key}
            onClick={() => selectCategory(key)}
            style={{
              padding: "8px 16px", margin: "4px 0",
              background: myScores[key] !== undefined ? "#2d5a2d" : "#1a1a2e",
              borderRadius: "8px",
              cursor: isMyTurn && myScores[key] === undefined ? "pointer" : "default",
              display: "flex", justifyContent: "space-between", gap: "40px",
              opacity: myScores[key] !== undefined ? 0.7 : 1,
            }}
          >
            <span>{label}</span>
            <span>
              {myScores[key] !== undefined
                ? myScores[key]
                : currentScores[key] !== undefined
                ? `(${currentScores[key]})`
                : "-"}
            </span>
          </div>
        ))}
      </div>

      <button onClick={() => navigate("/")} style={{ marginTop: "20px", padding: "8px 20px", cursor: "pointer" }}>
        🏠 Retour au lobby
      </button>
    </div>
  );
};

export default Game;