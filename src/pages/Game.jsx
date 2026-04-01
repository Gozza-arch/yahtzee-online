import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { rollDice, calculateScores, CATEGORY_NAMES, UPPER_CATEGORIES, LOWER_CATEGORIES, calculateUpperBonus, calculateTotalScore, isYahtzeeBonus } from "../utils/yahtzee";
import { listenToGame, updateDice, saveScore, saveTripleScore, leaveGame } from "../utils/gameManager";
import { checkAndAwardBadges } from "../utils/badges";
import BadgeNotification from "../components/BadgeNotification";
import { motion, AnimatePresence } from "framer-motion";
import { updatePlayerStats } from "../utils/ranking";
import { playVictory, playDefeat, playYahtzee } from "../utils/sounds";
import { launchVictoryConfetti, launchYahtzeeConfetti } from "../utils/confetti";
import { getTheme, THEMES } from "../utils/themes";

const TOTAL_CATEGORIES = Object.keys(CATEGORY_NAMES).length;
const GRIDS = ["grid1", "grid2", "grid3"];
const GRID_MULTIPLIERS = { grid1: 1, grid2: 2, grid3: 3 };

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
      transition: "transform 0.1s ease",
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

const calculateTripleTotalScore = (scores) => {
  if (!scores || typeof scores !== "object") return 0;
  return GRIDS.reduce((total, grid) => {
    const gridScores = scores[grid] || {};
    const { bonus } = calculateUpperBonus(gridScores);
    const gridTotal = Object.values(gridScores).reduce((a, b) => a + b, 0) + bonus;
    return total + gridTotal * GRID_MULTIPLIERS[grid];
  }, 0);
};

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
  const [playerOrder, setPlayerOrder] = useState(null);
  const [showLobbyConfirm, setShowLobbyConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const checkGameOver = useCallback(async (gameData) => {
    const players = Object.entries(gameData.players);
    const isTriple = gameData.mode === "triple";

    const allDone = players.every(([, player]) => {
      if (isTriple) {
        return GRIDS.every(g =>
          Object.keys(player.scores[g] || {}).length === TOTAL_CATEGORIES
        );
      }
      return Object.keys(player.scores).length === TOTAL_CATEGORIES;
    });

    if (allDone && !gameOver) {
      setGameOver(true);
      const scores = players.map(([uid, player]) => ({
        uid,
        total: isTriple
          ? calculateTripleTotalScore(player.scores)
          : calculateTotalScore(player.scores, player.yahtzeeBonus || 0),
      }));
      const winnerData = scores.reduce((a, b) => (a.total > b.total ? a : b));
      const loserData = scores.reduce((a, b) => (a.total < b.total ? a : b));
      setWinner(winnerData);
      if (winnerData.uid === currentUser.uid) {
        playVictory();
        launchVictoryConfetti();
      } else {
        playDefeat();
      }
      await updatePlayerStats(winnerData.uid, loserData.uid, {
        winner: winnerData.total,
        loser: loserData.total,
      }, gameData.mode);
      const myScores = gameData.players[currentUser.uid]?.scores || {};
      const isWinner = winnerData.uid === currentUser.uid;
      const victories = (playerProfile?.victories || 0) + (isWinner ? 1 : 0);
      const awarded = await checkAndAwardBadges(currentUser.uid, myScores, isWinner, victories);
      if (awarded.length > 0) setNewBadges(awarded);
    }
  }, [gameOver, currentUser.uid, playerProfile]);

  useEffect(() => {
    const unsubscribe = listenToGame(gameId, (gameData) => {
      if (!playerOrder && gameData.players) {
        setPlayerOrder(Object.keys(gameData.players));
      }
      if (gameData.status === "abandoned") {
        navigate("/");
        return;
      }
      setGame(gameData);
      const scores = gameData.rollsLeft < 3 ? calculateScores(gameData.dice) : {};
      setCurrentScores(scores);
      if (scores.yahtzee === 50) {
        playYahtzee();
        launchYahtzeeConfetti();
      }
      if (gameData.status === "playing" || gameData.status === "finished") checkGameOver(gameData);
    });
    return unsubscribe;
  }, [gameId, checkGameOver, playerOrder, navigate]);

  if (!game) return (
    <div style={{ color: "white", textAlign: "center", marginTop: "100px", fontSize: "20px" }}>
      🎲 Chargement...
    </div>
  );

  const isTriple = game.mode === "triple";
  const isMyTurn = game.currentTurn === currentUser.uid;
  const myScores = game.players[currentUser.uid]?.scores || {};
  const activeTurnUid = game.currentTurn;
  const orderedPlayers = playerOrder || Object.keys(game.players);
  const players = orderedPlayers.map(uid => [uid, game.players[uid]]).filter(([, p]) => p);
  const { upperTotal, bonus } = isTriple ? { upperTotal: 0, bonus: 0 } : calculateUpperBonus(myScores);

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

const selectCategory = async (category, grid = null) => {
  if (!isMyTurn || game.rollsLeft === 3) return;
  if (isTriple) {
    const gridScores = myScores[grid] || {};
    if (gridScores[category] !== undefined) return;
    await saveTripleScore(gameId, currentUser.uid, category, currentScores[category], grid, game.players);
  } else {
    if (myScores[category] !== undefined) return;
    const yahtzeeBonus = isYahtzeeBonus(game.dice, myScores) ? 100 : 0;
    await saveScore(gameId, currentUser.uid, category, currentScores[category], game.players, yahtzeeBonus);
    if (yahtzeeBonus > 0) {
      playYahtzee();
      launchYahtzeeConfetti();
    }
  }
  setCurrentScores({});
};
  const handleLobby = async () => {
    await leaveGame(gameId);
    navigate("/");
  };

  const getPlayerTotal = (player) => {
    if (isTriple) return calculateTripleTotalScore(player.scores);
    return calculateTotalScore(player.scores, player.yahtzeeBonus || 0);
  };

  const getRowClass = (key, grid = null) => {
    const scores = isTriple ? (myScores[grid] || {}) : myScores;
    const scored = scores[key] !== undefined;
    const isClickable = isMyTurn && !scored && game.rollsLeft < 3;
    if (!isClickable) return "";
    return currentScores[key] > 0 ? "row-scorable" : "row-zero";
  };

  // Rendu cellule mode classique
  const renderClassicCell = (uid, player, key) => {
    const pScores = player.scores || {};
    const pScored = pScores[key] !== undefined;
    const isActivePlayer = uid === activeTurnUid;
    const preview = isActivePlayer && game.rollsLeft < 3 ? currentScores[key] : undefined;
    return (
      <td key={uid} style={{
        textAlign: "center", padding: "10px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        fontWeight: 800, fontSize: "16px",
        color: pScored ? "#2ed573" : preview !== undefined ? "#ffd700" : "rgba(255,255,255,0.2)",
      }}>
        {pScored ? pScores[key] : preview !== undefined ? `+${preview}` : "-"}
      </td>
    );
  };

  // Rendu cellule mode triple
  const renderTripleCell = (uid, player, key, grid) => {
    const gridScores = (player.scores || {})[grid] || {};
    const pScored = gridScores[key] !== undefined;
    const isActivePlayer = uid === activeTurnUid;
    const isMe = uid === currentUser.uid;
    const preview = isActivePlayer && game.rollsLeft < 3 ? currentScores[key] : undefined;
    const multiplier = GRID_MULTIPLIERS[grid];
    const canClick = isMe && isMyTurn && !pScored && game.rollsLeft < 3;

    return (
      <td
        key={`${uid}-${grid}`}
        onClick={() => canClick && selectCategory(key, grid)}
        style={{
          textAlign: "center", padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          borderLeft: grid === "grid1" ? "2px solid rgba(255,255,255,0.1)" : "none",
          fontWeight: 800, fontSize: "15px",
          cursor: canClick ? "pointer" : "default",
          color: pScored ? "#2ed573" : preview !== undefined ? "#ffd700" : "rgba(255,255,255,0.2)",
          background: canClick && preview !== undefined && preview > 0
            ? "rgba(46,213,115,0.06)" : "transparent",
        }}
      >
        {pScored
          ? `${pScored ? gridScores[key] * multiplier : 0}`
          : preview !== undefined ? `+${preview * multiplier}` : "-"}
      </td>
    );
  };

  const renderBonusTripleCell = (uid, player, grid) => {
  const gridScores = (player.scores || {})[grid] || {};
  const upperTotal = UPPER_CATEGORIES.reduce((sum, cat) => sum + (gridScores[cat] || 0), 0);
  const hasBonus = upperTotal >= 63;
  const multiplier = GRID_MULTIPLIERS[grid];
  const missing = (63 - upperTotal) * multiplier;

  return (
    <td key={`${uid}-${grid}-bonus`} style={{
      textAlign: "center", padding: "8px 12px",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      borderTop: "1px solid rgba(255,255,255,0.1)",
      borderLeft: grid === "grid1" ? "2px solid rgba(255,255,255,0.1)" : "none",
      fontWeight: 800,
      color: hasBonus ? "#2ed573" : "rgba(255,255,255,0.4)",
      fontSize: "13px",
    }}>
      {hasBonus ? `+${35 * multiplier}` : `(-${missing})`}
    </td>
  );
};

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: THEMES[getTheme()]?.background || "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      overflow: "hidden",
    }}>
      {newBadges.length > 0 && <BadgeNotification badges={newBadges} onClose={() => setNewBadges([])} />}

      {/* MODAL CONFIRMATION LOBBY */}
      {showLobbyConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: "linear-gradient(135deg, #1a1a3e, #2a2a5e)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "16px", padding: "30px",
              textAlign: "center", maxWidth: "380px", width: "90%",
            }}
          >
            <p style={{ fontSize: "32px", marginBottom: "12px" }}>🏠</p>
            <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "8px" }}>Quitter la partie ?</h3>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", marginBottom: "24px" }}>
              La partie sera abandonnée si tu quittes maintenant.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button onClick={() => setShowLobbyConfirm(false)} style={{ padding: "10px 24px", background: "rgba(255,255,255,0.1)", color: "white", fontSize: "15px" }}>
                Annuler
              </button>
              <button onClick={handleLobby} style={{ padding: "10px 24px", background: "linear-gradient(135deg, #c0392b, #e74c3c)", color: "white", fontSize: "15px" }}>
                Quitter
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* PANNEAU HISTORIQUE */}
<AnimatePresence>
  {showHistory && (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowHistory(false)}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 999,
        }}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        style={{
          position: "fixed", right: 0, top: 0, bottom: 0,
          width: "360px", background: "linear-gradient(135deg, #1a1a3e, #2a2a5e)",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          zIndex: 1000, display: "flex", flexDirection: "column",
          padding: "20px",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 800 }}>📜 Historique</h2>
          <button
            onClick={() => setShowHistory(false)}
            style={{ background: "rgba(255,255,255,0.1)", color: "white", padding: "6px 12px", fontSize: "16px" }}
          >
            ✕
          </button>
        </div>

        {(!game.history || game.history.length === 0) ? (
          <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: "40px" }}>
            Aucun coup joué pour l'instant...
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[...game.history].reverse().map((entry, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "12px", padding: "12px 16px",
                borderLeft: `3px solid ${entry.playerUid === currentUser.uid ? "#7c6af7" : "#2ed573"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 800, fontSize: "14px", color: entry.playerUid === currentUser.uid ? "#a89af7" : "#2ed573" }}>
                    {entry.pseudo}
                  </span>
                  {entry.grid && (
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                      Grille x{GRID_MULTIPLIERS[entry.grid]}
                    </span>
                  )}
                </div>
                {entry.dice && entry.dice.length > 0 && (
                  <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                    {entry.dice.map((d, di) => (
                      <div key={di} style={{
                        width: "24px", height: "24px", background: "white", borderRadius: "4px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "13px", fontWeight: 800, color: "#1a1a2e",
                      }}>
                        {d}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                    {CATEGORY_NAMES[entry.category]?.label || entry.category}
                  </span>
                  <span style={{ fontWeight: 900, fontSize: "16px", color: "#ffd700" }}>
                    +{entry.score} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </>
  )}
</AnimatePresence>

      {/* BARRE DU HAUT */}
      <div style={{
        background: "rgba(0,0,0,0.4)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, gap: "16px",
      }}>
<div style={{ display: "flex", gap: "12px", flexShrink: 0, alignItems: "center" }}>
          {players.map(([uid, player]) => (
            <div key={uid} style={{
              padding: "10px 22px", borderRadius: "12px",
              background: uid === game.currentTurn
                ? "linear-gradient(135deg, rgba(124,106,247,0.5), rgba(90,79,207,0.5))"
                : "rgba(255,255,255,0.07)",
              border: uid === game.currentTurn ? "2px solid rgba(124,106,247,0.8)" : "2px solid rgba(255,255,255,0.1)",
              textAlign: "center",
              boxShadow: uid === game.currentTurn ? "0 0 20px rgba(124,106,247,0.4)" : "none",
              transition: "all 0.3s ease", minWidth: "110px",
            }}>
              <div style={{ fontSize: "15px", fontWeight: 800 }}>
                {uid === game.currentTurn ? "🎯 " : ""}{player.pseudo}
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: uid === game.currentTurn ? "#a89af7" : "white" }}>
                {getPlayerTotal(player)} pts
              </div>
            </div>
          ))}
          <button
            onClick={() => setShowHistory(true)}
            style={{ padding: "10px 14px", background: "rgba(255,255,255,0.08)", color: "white", fontSize: "14px", fontWeight: 700 }}
          >
            📜 Historique
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, justifyContent: "center" }}>
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              {game.dice.map((die, i) => (
                <Die key={i} value={die} kept={game.kept[i]} onClick={() => toggleKeep(i)} isMyTurn={isMyTurn} rolling={rolling} />
              ))}
            </div>
            {!isMyTurn && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(180, 30, 30, 0.25)",
                borderRadius: "10px", pointerEvents: "none",
              }} />
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={handleRoll}
            disabled={!isMyTurn || game.rollsLeft === 0}
            style={{
              padding: "12px 24px", fontSize: "16px", fontWeight: 700,
              background: isMyTurn && game.rollsLeft > 0
                ? "linear-gradient(135deg, #7c6af7, #5a4fcf)"
                : "rgba(255,255,255,0.1)",
              color: "white", whiteSpace: "nowrap",
            }}
          >
            🎲 Relancer ({game.rollsLeft}/3)
          </motion.button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
          {game.status === "waiting" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>⏳ En attente...</span>
              <button onClick={() => navigator.clipboard.writeText(gameId)} style={{ padding: "6px 14px", background: "rgba(124,106,247,0.5)", color: "white", fontSize: "13px" }}>
                📋 Copier l'ID
              </button>
            </div>
          )}

          <button onClick={() => setShowLobbyConfirm(true)} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.08)", color: "white", fontSize: "15px", fontWeight: 700 }}>
            🏠 Lobby
          </button>
        </div>
      </div>

      {/* BANDEAU TOUR */}
      {game.status === "playing" && (
        <AnimatePresence>
          {isMyTurn ? (
            <motion.div key="myturn" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                textAlign: "center", padding: "12px",
                background: "linear-gradient(135deg, rgba(124,106,247,0.4), rgba(90,79,207,0.4))",
                borderBottom: "2px solid rgba(124,106,247,0.6)",
                fontSize: "17px", fontWeight: 800, color: "#fff", flexShrink: 0,
              }}
            >
              {game.rollsLeft > 0
                ? `🎯 C'EST TON TOUR ! Clique sur les dés à garder puis relance — ${game.rollsLeft} lancer(s) restant(s)`
                : isTriple
                  ? "✅ PLUS DE LANCERS — Clique sur une cellule dans la grille x1, x2 ou x3"
                  : "✅ PLUS DE LANCERS — Choisis une catégorie dans le tableau ci-dessous"}
            </motion.div>
          ) : (
            <motion.div key="theirturn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                textAlign: "center", padding: "14px",
                background: "rgba(255,255,255,0.04)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "18px", fontWeight: 900 }}>
                  ⏳ C'est au tour de {players.find(([uid]) => uid === game.currentTurn)?.[1]?.pseudo || "l'adversaire"}
                </span>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Patiente pendant qu'il joue...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Fin de partie */}
<AnimatePresence>
  {gameOver && winner && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 2000,
      }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.2 }}
        style={{
          textAlign: "center",
          padding: "50px 60px",
          borderRadius: "24px",
          background: winner.uid === currentUser.uid
            ? "linear-gradient(135deg, rgba(46,213,115,0.2), rgba(46,213,115,0.05))"
            : "linear-gradient(135deg, rgba(255,71,87,0.2), rgba(255,71,87,0.05))",
          border: `2px solid ${winner.uid === currentUser.uid ? "rgba(46,213,115,0.5)" : "rgba(255,71,87,0.5)"}`,
          boxShadow: winner.uid === currentUser.uid
            ? "0 0 60px rgba(46,213,115,0.2)"
            : "0 0 60px rgba(255,71,87,0.2)",
          maxWidth: "480px", width: "90%",
        }}
      >
        {/* Trophée animé */}
        <motion.div
          animate={{ rotate: [-5, 5, -5], y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          style={{ fontSize: "80px", marginBottom: "16px" }}
        >
          {winner.uid === currentUser.uid ? "🏆" : "😢"}
        </motion.div>

        {/* Résultat */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ fontSize: "28px", fontWeight: 900, marginBottom: "8px" }}
        >
          {winner.uid === currentUser.uid ? "Victoire !" : "Défaite !"}
        </motion.h2>

        {/* Nom du gagnant */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            fontSize: "20px", fontWeight: 700,
            color: "rgba(255,255,255,0.7)", marginBottom: "24px"
          }}
        >
          🎖️ {players.find(([uid]) => uid === winner.uid)?.[1]?.pseudo} remporte la partie !
        </motion.div>

        {/* Scores finaux */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "32px" }}
        >
          {players.map(([uid, player]) => (
            <div key={uid} style={{
              padding: "12px 24px", borderRadius: "12px",
              background: uid === winner.uid ? "rgba(46,213,115,0.2)" : "rgba(255,255,255,0.05)",
              border: uid === winner.uid ? "1px solid rgba(46,213,115,0.4)" : "1px solid rgba(255,255,255,0.1)",
              minWidth: "120px",
            }}>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>
                {uid === winner.uid ? "🥇 " : "🥈 "}{player.pseudo}
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: uid === winner.uid ? "#2ed573" : "white" }}>
                {getPlayerTotal(player)} pts
              </div>
            </div>
          ))}
        </motion.div>

        {/* Bouton */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/")}
          style={{
            padding: "14px 40px", fontSize: "18px", fontWeight: 800,
            background: "linear-gradient(135deg, #7c6af7, #5a4fcf)",
            color: "white", borderRadius: "12px",
          }}
        >
          🏠 Retour au lobby
        </motion.button>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

      {/* TABLEAU DE SCORE */}
      <div style={{ flex: 1, overflow: "auto", margin: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: isTriple ? "25%" : "40%" }} />
            {players.map(([uid]) =>
              isTriple
                ? GRIDS.map(g => <col key={`${uid}-${g}`} style={{ width: `${75 / (players.length * 3)}%` }} />)
                : <col key={uid} style={{ width: `${60 / players.length}%` }} />
            )}
          </colgroup>
          <thead>
            {/* Ligne noms joueurs */}
            <tr>
              <th style={{ padding: "10px 20px", background: "rgba(255,255,255,0.08)", textAlign: "left", fontSize: "13px", color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: "1px" }}>
                CATÉGORIE
              </th>
              {players.map(([uid, player]) =>
                isTriple ? (
                  <th key={uid} colSpan={3} style={{
                    padding: "10px 20px", textAlign: "center", fontSize: "16px", fontWeight: 800,
                    background: uid === game.currentTurn ? "rgba(124,106,247,0.25)" : "rgba(255,255,255,0.05)",
                    color: uid === game.currentTurn ? "#a89af7" : "rgba(255,255,255,0.8)",
                    borderBottom: uid === game.currentTurn ? "2px solid rgba(124,106,247,0.5)" : "2px solid transparent",
                    borderLeft: "2px solid rgba(255,255,255,0.1)",
                  }}>
                    {player.pseudo}
                  </th>
                ) : (
                  <th key={uid} style={{
                    padding: "12px 20px", textAlign: "center", fontSize: "17px", fontWeight: 800,
                    background: uid === game.currentTurn ? "rgba(124,106,247,0.25)" : "rgba(255,255,255,0.05)",
                    color: uid === game.currentTurn ? "#a89af7" : "rgba(255,255,255,0.8)",
                    borderBottom: uid === game.currentTurn ? "2px solid rgba(124,106,247,0.5)" : "2px solid transparent",
                  }}>
                    {player.pseudo}
                  </th>
                )
              )}
            </tr>
            {/* Ligne multiplicateurs en mode triple */}
            {isTriple && (
              <tr>
                <th style={{ padding: "4px 20px", background: "rgba(255,255,255,0.05)", fontSize: "11px", color: "rgba(255,255,255,0.3)" }} />
                {players.map(([uid]) =>
                  GRIDS.map(g => (
                    <th key={`${uid}-${g}-header`} style={{
                      padding: "4px 8px", textAlign: "center", fontSize: "12px", fontWeight: 800,
                      background: "rgba(255,255,255,0.05)",
                      color: g === "grid1" ? "rgba(255,255,255,0.6)" : g === "grid2" ? "#ffd700" : "#ff6b6b",
                      borderLeft: g === "grid1" ? "2px solid rgba(255,255,255,0.1)" : "none",
                    }}>
                      x{GRID_MULTIPLIERS[g]}
                    </th>
                  ))
                )}
              </tr>
            )}
          </thead>
          <tbody>
            <tr>
              <td colSpan={isTriple ? players.length * 3 + 1 : players.length + 1} style={{ padding: "5px 20px", background: "rgba(124,106,247,0.15)", fontSize: "12px", fontWeight: 800, letterSpacing: "1px", color: "#a89af7", textTransform: "uppercase" }}>
                🎯 Section haute
              </td>
            </tr>

            {UPPER_CATEGORIES.map((key) => {
              const cat = CATEGORY_NAMES[key];
              return (
                <tr key={key}
                  onClick={() => !isTriple && selectCategory(key)}
                  className={!isTriple ? getRowClass(key) : ""}
                  style={{ cursor: !isTriple && isMyTurn && myScores[key] === undefined ? "pointer" : "default", transition: "background 0.15s" }}
                >
                  <td style={{ padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700 }}>{cat.label}</div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{cat.desc}</div>
                  </td>
                  {isTriple
                    ? players.map(([uid, player]) => GRIDS.map(g => renderTripleCell(uid, player, key, g)))
                    : players.map(([uid, player]) => renderClassicCell(uid, player, key))
                  }
                </tr>
              );
            })}

            {/* Bonus */}
            <tr style={{ background: "rgba(255,255,255,0.02)" }}>
              <td style={{ padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ fontSize: "15px", fontWeight: 700 }}>🎁 Bonus</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                  {isTriple ? "35 pts si ≥ 63 (par grille)" : `35 pts si ≥ 63 — ${upperTotal}/63 ${bonus === 0 ? `(encore ${63 - upperTotal} pts)` : ""}`}
                </div>
              </td>
              {isTriple
                ? players.map(([uid, player]) => GRIDS.map(g => renderBonusTripleCell(uid, player, g)))
                : players.map(([uid, player]) => {
                    const { bonus: pBonus } = calculateUpperBonus(player.scores || {});
                    return (
                      <td key={uid} style={{ textAlign: "center", fontWeight: 800, fontSize: "16px", color: pBonus > 0 ? "#2ed573" : "rgba(255,255,255,0.2)", borderBottom: "1px solid rgba(255,255,255,0.1)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                        {pBonus > 0 ? "+35" : "-"}
                      </td>
                    );
                  })
              }
            </tr>
            {/* Bonus Yahtzee */}
{players.some(([, p]) => (p.scores?.yahtzeeBonus || 0) > 0) && (
  <tr style={{ background: "rgba(255,215,0,0.08)" }}>
    <td style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ fontSize: "15px", fontWeight: 700 }}>🎲 Bonus Yahtzee</div>
      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>+100 pts par Yahtzee supplémentaire</div>
    </td>
    {players.map(([uid, player]) => (
      <td key={uid} style={{ textAlign: "center", fontWeight: 800, fontSize: "15px", color: "#ffd700", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {player.scores?.yahtzeeBonus > 0 ? `+${player.scores.yahtzeeBonus}` : "-"}
      </td>
    ))}
  </tr>
)}

            <tr>
              <td colSpan={isTriple ? players.length * 3 + 1 : players.length + 1} style={{ padding: "5px 20px", background: "rgba(124,106,247,0.15)", fontSize: "12px", fontWeight: 800, letterSpacing: "1px", color: "#a89af7", textTransform: "uppercase" }}>
                🎲 Section basse
              </td>
            </tr>

            {LOWER_CATEGORIES.map((key) => {
              const cat = CATEGORY_NAMES[key];
              return (
                <tr key={key}
                  onClick={() => !isTriple && selectCategory(key)}
                  className={!isTriple ? getRowClass(key) : ""}
                  style={{ cursor: !isTriple && isMyTurn && myScores[key] === undefined ? "pointer" : "default", transition: "background 0.15s" }}
                >
                  <td style={{ padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700 }}>{cat.label}</div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{cat.desc}</div>
                  </td>
                  {isTriple
                    ? players.map(([uid, player]) => GRIDS.map(g => renderTripleCell(uid, player, key, g)))
                    : players.map(([uid, player]) => renderClassicCell(uid, player, key))
                  }
                </tr>
              );
            })}

            <tr style={{ background: "rgba(124,106,247,0.2)" }}>
              <td style={{ padding: "12px 20px", fontWeight: 800, fontSize: "16px" }}>🏆 Score total</td>
              {isTriple
                ? players.map(([uid, player]) => (
                    <td key={uid} colSpan={3} style={{ textAlign: "center", fontWeight: 900, fontSize: "22px", color: "#a89af7", borderLeft: "2px solid rgba(255,255,255,0.1)" }}>
                      {calculateTripleTotalScore(player.scores || {})}
                    </td>
                  ))
                : players.map(([uid, player]) => (
                    <td key={uid} style={{ textAlign: "center", fontWeight: 900, fontSize: "22px", color: "#a89af7" }}>
                      {calculateTotalScore(player.scores || {}, player.yahtzeeBonus || 0)}
                    </td>
                  ))
              }
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Game;