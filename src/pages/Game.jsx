import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { rollDice, calculateScores, CATEGORY_NAMES, UPPER_CATEGORIES, LOWER_CATEGORIES, calculateUpperBonus, calculateTotalScore } from "../utils/yahtzee";
import { listenToGame, updateDice, saveScore, updatePlayerStats } from "../utils/gameManager";
import { checkAndAwardBadges } from "../utils/badges";
import BadgeNotification from "../components/BadgeNotification";
import { motion, AnimatePresence } from "framer-motion";

const TOTAL_CATEGORIES = Object.keys(CATEGORY_NAMES).length;

const diceFaces = [
  [[false,false,false],[false,true,false],[false,false,false]],
  [[true,false,false],[false,false,false],[false,false,true]],
  [[true,false,false],[false,true,false],[false,false,true]],
  [[true,false,true],[false,false,false],[true,false,true]],
  [[true,false,true],[false,true,false],[true,false,true]],
  [[true,false,true],[true,false,true],[true,false,true]],
];

const Die = ({ value, kept, onClick, isMyTurn, rolling }) => (
  <motion.div
    onClick={onClick}
    whileHover={isMyTurn ? { scale: 1.08 } : {}}
    whileTap={isMyTurn ? { scale: 0.92 } : {}}
    className={rolling && !kept ? "die-shake" : ""}
    style={{
      width: "64px", height: "64px",
      background: kept ? "linear-gradient(135deg, #f0c040, #e6a800)" : "white",
      borderRadius: "10px",
      cursor: isMyTurn ? "pointer" : "default",
      border: kept ? "3px solid #c8860a" : "3px solid #ddd",
      boxShadow: kept ? "0 0 16px rgba(240,192,64,0.6)" : "0 3px 8px rgba(0,0,0,0.25)",
      display: "grid", gridTemplateRows: "repeat(3, 1fr)",
      padding: "8px", gap: "2px",
    }}
  >
    {diceFaces[value - 1].map((row, rowIndex) => (
      <div key={rowIndex} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px" }}>
        {row.map((dot, colIndex) => (
          <div key={colIndex} style={{
            borderRadius: "50%",
            background: dot ? (kept ? "#5a3e00" : "#1a1a2e") : "transparent",
            width: "100%", aspectRatio: "1",
            boxShadow: dot ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
          }} />
        ))}
      </div>
    ))}
  </motion.div>
);

const Game = () => {
  const { gameId } = useParams();
  const { currentUser, playerProfile } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [currentScores, setCurrentScores] = useState({});
  const [newBadges, setNewBadges] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [rolling, setRolling] = useState(false);

  const checkGameOver = useCallback(async (gameData) => {
    const players = Object.entries(gameData.players);
    const allDone = players.every(([, player]) =>
      Object.keys(player.scores).length === TOTAL_CATEGORIES
    );
    if (allDone && !gameOver) {
      setGameOver(true);
      const scores = players.map(([uid, player]) => ({
        uid, total: calculateTotalScore(player.scores),
      }));
      const winnerData = scores.reduce((a, b) => (a.total > b.total ? a : b));
      const loserData = scores.reduce((a, b) => (a.total < b.total ? a : b));
      setWinner(winnerData);
      await updatePlayerStats(winnerData.uid, loserData.uid);
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
      if (gameData.rollsLeft < 3) setCurrentScores(calculateScores(gameData.dice));
      if (gameData.status === "playing") checkGameOver(gameData);
    });
    return unsubscribe;
  }, [gameId, checkGameOver]);

  if (!game) return (
    <div style={{ color: "white", textAlign: "center", marginTop: "100px", fontSize: "20px" }}>
      🎲 Chargement...
    </div>
  );

  const isMyTurn = game.currentTurn === currentUser.uid;
  const myScores = game.players[currentUser.uid]?.scores || {};
  const players = Object.entries(game.players);
  const shareLink = `${window.location.origin}/game/${gameId}`;
  const { upperTotal, bonus } = calculateUpperBonus(myScores);
  const totalScore = calculateTotalScore(myScores);

  const handleRoll = async () => {
    if (!isMyTurn || game.rollsLeft === 0) return;
    setRolling(true);
    setTimeout(() => setRolling(false), 500);
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

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      overflow: "hidden",
    }}>
      {newBadges.length > 0 && <BadgeNotification badges={newBadges} onClose={() => setNewBadges([])} />}

      {/* BARRE DU HAUT */}
      <div style={{
        background: "rgba(0,0,0,0.3)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, gap: "16px",
      }}>
        {/* Infos joueurs */}
        <div style={{ display: "flex", gap: "12px", flexShrink: 0 }}>
          {players.map(([uid, player]) => (
            <div key={uid} style={{
              padding: "6px 14px", borderRadius: "8px",
              background: uid === game.currentTurn ? "rgba(124,106,247,0.3)" : "rgba(255,255,255,0.05)",
              border: uid === game.currentTurn ? "1px solid rgba(124,106,247,0.5)" : "1px solid transparent",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{uid === game.currentTurn ? "🎯 " : ""}{player.pseudo}</div>
              <div style={{ fontSize: "16px", fontWeight: 900 }}>{calculateTotalScore(player.scores)} pts</div>
            </div>
          ))}
        </div>

        {/* Dés + bouton — toujours visible */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {game.dice.map((die, i) => (
              <Die key={i} value={die} kept={game.kept[i]} onClick={() => toggleKeep(i)} isMyTurn={isMyTurn} rolling={rolling} />
            ))}
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleRoll}
            disabled={!isMyTurn || game.rollsLeft === 0}
            style={{
              padding: "10px 20px", fontSize: "15px", fontWeight: 700,
              background: isMyTurn && game.rollsLeft > 0
                ? "linear-gradient(135deg, #7c6af7, #5a4fcf)"
                : "rgba(255,255,255,0.1)",
              color: "white", whiteSpace: "nowrap",
            }}
          >
            🎲 Relancer ({game.rollsLeft}/3)
          </motion.button>
        </div>

        {/* Droite : lien partage + lobby */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
          {game.status === "waiting" && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ⏳ En attente...
              </span>
              <button onClick={() => navigator.clipboard.writeText(shareLink)} style={{ padding: "4px 10px", background: "rgba(124,106,247,0.5)", color: "white", fontSize: "12px" }}>
                📋 Copier le lien
              </button>
            </div>
          )}
          <button onClick={() => navigate("/")} style={{ padding: "6px 14px", background: "rgba(255,255,255,0.08)", color: "white", fontSize: "13px" }}>
            🏠 Lobby
          </button>
        </div>
      </div>

      {/* Message tour */}
      {game.status === "playing" && (
        <div style={{
          textAlign: "center", padding: "6px",
          background: isMyTurn ? "rgba(124,106,247,0.2)" : "rgba(255,255,255,0.05)",
          fontSize: "13px", color: isMyTurn ? "#a89af7" : "rgba(255,255,255,0.5)",
          flexShrink: 0,
        }}>
          {isMyTurn
            ? game.rollsLeft > 0
              ? `🎯 À toi ! Clique sur les dés à garder puis relance — ${game.rollsLeft} lancer(s) restant(s)`
              : "✅ Plus de lancers — choisis une catégorie dans le tableau"
            : "⏳ Tour de l'adversaire, patiente..."}
        </div>
      )}

      {/* Fin de partie */}
      <AnimatePresence>
        {gameOver && winner && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              textAlign: "center", padding: "12px",
              background: winner.uid === currentUser.uid ? "rgba(46,213,115,0.2)" : "rgba(255,71,87,0.2)",
              borderBottom: `1px solid ${winner.uid === currentUser.uid ? "rgba(46,213,115,0.4)" : "rgba(255,71,87,0.4)"}`,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "20px", fontWeight: 900 }}>
              {winner.uid === currentUser.uid ? "🏆 Tu as gagné !" : "😢 Tu as perdu !"}
            </span>
            <button onClick={() => navigate("/")} style={{ marginLeft: "16px", padding: "6px 16px", background: "rgba(255,255,255,0.15)", color: "white", fontSize: "14px" }}>
              🏠 Retour au lobby
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TABLEAU DE SCORE */}
      <div style={{ flex: 1, overflow: "auto", margin: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ padding: "8px 16px", background: "rgba(255,255,255,0.08)", textAlign: "left", fontSize: "12px", color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: "1px", width: "60%" }}>
                CATÉGORIE
              </th>
              {players.map(([uid, player]) => (
                <th key={uid} style={{
                  padding: "8px 16px", textAlign: "center", fontSize: "14px", fontWeight: 800,
                  background: uid === game.currentTurn ? "rgba(124,106,247,0.2)" : "rgba(255,255,255,0.05)",
                  color: uid === game.currentTurn ? "#a89af7" : "white",
                }}>
                  {player.pseudo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Section haute */}
            <tr>
              <td colSpan={players.length + 1} style={{ padding: "4px 16px", background: "rgba(124,106,247,0.15)", fontSize: "11px", fontWeight: 800, letterSpacing: "1px", color: "#a89af7", textTransform: "uppercase" }}>
                🎯 Section haute
              </td>
            </tr>

            {UPPER_CATEGORIES.map((key) => {
              const cat = CATEGORY_NAMES[key];
              const scored = myScores[key] !== undefined;
              const preview = currentScores[key];
              return (
                <tr
                  key={key}
                  onClick={() => selectCategory(key)}
                  style={{ cursor: isMyTurn && !scored ? "pointer" : "default", background: scored ? "rgba(46,213,115,0.06)" : "transparent", transition: "background 0.15s" }}
                  onMouseEnter={e => { if (isMyTurn && !scored) e.currentTarget.style.background = "rgba(124,106,247,0.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = scored ? "rgba(46,213,115,0.06)" : "transparent"; }}
                >
                  <td style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700 }}>{cat.label}</div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{cat.desc}</div>
                  </td>
                  <td style={{ textAlign: "center", padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontWeight: 800, fontSize: "15px",
                    color: scored ? "#2ed573" : preview !== undefined ? "#ffd700" : "rgba(255,255,255,0.2)" }}>
                    {scored ? myScores[key] : preview !== undefined ? `+${preview}` : "-"}
                  </td>
                </tr>
              );
            })}

            {/* Bonus */}
            <tr style={{ background: bonus > 0 ? "rgba(46,213,115,0.1)" : "rgba(255,255,255,0.02)" }}>
              <td style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ fontSize: "14px", fontWeight: 700 }}>🎁 Bonus</div>
                <div style={{ fontSize: "11px", color: bonus > 0 ? "#2ed573" : "rgba(255,255,255,0.4)" }}>
                  35 pts si section haute ≥ 63 — {upperTotal}/63 {bonus === 0 && `(encore ${63 - upperTotal} pts)`}
                </div>
              </td>
              <td style={{ textAlign: "center", fontWeight: 800, fontSize: "15px", color: bonus > 0 ? "#2ed573" : "rgba(255,255,255,0.2)", borderBottom: "1px solid rgba(255,255,255,0.1)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                {bonus > 0 ? "+35" : "-"}
              </td>
            </tr>

            {/* Section basse */}
            <tr>
              <td colSpan={players.length + 1} style={{ padding: "4px 16px", background: "rgba(124,106,247,0.15)", fontSize: "11px", fontWeight: 800, letterSpacing: "1px", color: "#a89af7", textTransform: "uppercase" }}>
                🎲 Section basse
              </td>
            </tr>

            {LOWER_CATEGORIES.map((key) => {
              const cat = CATEGORY_NAMES[key];
              const scored = myScores[key] !== undefined;
              const preview = currentScores[key];
              return (
                <tr
                  key={key}
                  onClick={() => selectCategory(key)}
                  style={{ cursor: isMyTurn && !scored ? "pointer" : "default", background: scored ? "rgba(46,213,115,0.06)" : "transparent", transition: "background 0.15s" }}
                  onMouseEnter={e => { if (isMyTurn && !scored) e.currentTarget.style.background = "rgba(124,106,247,0.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = scored ? "rgba(46,213,115,0.06)" : "transparent"; }}
                >
                  <td style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700 }}>{cat.label}</div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{cat.desc}</div>
                  </td>
                  <td style={{ textAlign: "center", padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontWeight: 800, fontSize: "15px",
                    color: scored ? "#2ed573" : preview !== undefined ? "#ffd700" : "rgba(255,255,255,0.2)" }}>
                    {scored ? myScores[key] : preview !== undefined ? `+${preview}` : "-"}
                  </td>
                </tr>
              );
            })}

            {/* Total */}
            <tr style={{ background: "rgba(124,106,247,0.2)" }}>
              <td style={{ padding: "10px 16px", fontWeight: 800, fontSize: "15px" }}>🏆 Score total</td>
              <td style={{ textAlign: "center", fontWeight: 900, fontSize: "20px", color: "#a89af7" }}>{totalScore}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Game;