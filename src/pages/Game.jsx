import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { rollDice, calculateScores, CATEGORY_NAMES, UPPER_CATEGORIES, LOWER_CATEGORIES, calculateUpperBonus, calculateTotalScore } from "../utils/yahtzee";
import { listenToGame, updateDice, saveScore, updatePlayerStats, leaveGame } from "../utils/gameManager";
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
  const [playerOrder, setPlayerOrder] = useState(null);
  const [showLobbyConfirm, setShowLobbyConfirm] = useState(false);

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
      if (!playerOrder && gameData.players) {
        setPlayerOrder(Object.keys(gameData.players));
      }
      if (gameData.status === "abandoned") {
        navigate("/");
        return;
      }
      setGame(gameData);
      if (gameData.rollsLeft < 3) setCurrentScores(calculateScores(gameData.dice));
      else setCurrentScores({});
      if (gameData.status === "playing") checkGameOver(gameData);
    });
    return unsubscribe;
  }, [gameId, checkGameOver, playerOrder, navigate]);

  if (!game) return (
    <div style={{ color: "white", textAlign: "center", marginTop: "100px", fontSize: "20px" }}>
      🎲 Chargement...
    </div>
  );

  const isMyTurn = game.currentTurn === currentUser.uid;
  const myScores = game.players[currentUser.uid]?.scores || {};
  const activeTurnUid = game.currentTurn;
  const orderedPlayers = playerOrder || Object.keys(game.players);
  const players = orderedPlayers.map(uid => [uid, game.players[uid]]).filter(([, p]) => p);
  const { upperTotal, bonus } = calculateUpperBonus(myScores);

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

  const handleLobby = async () => {
    await leaveGame(gameId);
    navigate("/");
  };

  const renderCell = (uid, player, key) => {
    const pScores = player.scores || {};
    const pScored = pScores[key] !== undefined;
    const isActivePlayer = uid === activeTurnUid;
    const preview = isActivePlayer && game.rollsLeft < 3 ? currentScores[key] : undefined;
    return (
      <td key={uid} style={{
        textAlign: "center",
        padding: "10px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        fontWeight: 800,
        fontSize: "16px",
        color: pScored ? "#2ed573" : preview !== undefined ? "#ffd700" : "rgba(255,255,255,0.2)",
      }}>
        {pScored ? pScores[key] : preview !== undefined ? `+${preview}` : "-"}
      </td>
    );
  };

  const getRowClass = (key) => {
    const myScored = myScores[key] !== undefined;
    const isClickable = isMyTurn && !myScored && game.rollsLeft < 3;
    if (!isClickable) return "";
    return currentScores[key] > 0 ? "row-scorable" : "row-zero";
  };

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      overflow: "hidden",
    }}>
      {newBadges.length > 0 && <BadgeNotification badges={newBadges} onClose={() => setNewBadges([])} />}

      {/* MODAL CONFIRMATION LOBBY */}
      {showLobbyConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
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
              <button
                onClick={() => setShowLobbyConfirm(false)}
                style={{ padding: "10px 24px", background: "rgba(255,255,255,0.1)", color: "white", fontSize: "15px" }}
              >
                Annuler
              </button>
              <button
                onClick={handleLobby}
                style={{ padding: "10px 24px", background: "linear-gradient(135deg, #c0392b, #e74c3c)", color: "white", fontSize: "15px" }}
              >
                Quitter
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* BARRE DU HAUT */}
      <div style={{
        background: "rgba(0,0,0,0.4)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, gap: "16px",
      }}>
        {/* Infos joueurs */}
        <div style={{ display: "flex", gap: "12px", flexShrink: 0 }}>
          {players.map(([uid, player]) => (
            <div key={uid} style={{
              padding: "10px 22px", borderRadius: "12px",
              background: uid === game.currentTurn
                ? "linear-gradient(135deg, rgba(124,106,247,0.5), rgba(90,79,207,0.5))"
                : "rgba(255,255,255,0.07)",
              border: uid === game.currentTurn
                ? "2px solid rgba(124,106,247,0.8)"
                : "2px solid rgba(255,255,255,0.1)",
              textAlign: "center",
              boxShadow: uid === game.currentTurn ? "0 0 20px rgba(124,106,247,0.4)" : "none",
              transition: "all 0.3s ease",
              minWidth: "110px",
            }}>
              <div style={{ fontSize: "15px", fontWeight: 800 }}>
                {uid === game.currentTurn ? "🎯 " : ""}{player.pseudo}
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: uid === game.currentTurn ? "#a89af7" : "white" }}>
                {calculateTotalScore(player.scores)} pts
              </div>
            </div>
          ))}
        </div>

        {/* Dés + bouton */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, justifyContent: "center" }}>
          <div style={{ position: "relative" }}>
  <div style={{ display: "flex", gap: "10px", filter: "none", transition: "filter 0.3s" }}>
    {game.dice.map((die, i) => (
      <Die key={i} value={die} kept={game.kept[i]} onClick={() => toggleKeep(i)} isMyTurn={isMyTurn} rolling={rolling} />
    ))}
  </div>
  {!isMyTurn && (
  <div style={{
    position: "absolute", inset: 0,
    background: "rgba(180, 30, 30, 0.25)",
    borderRadius: "10px",
    pointerEvents: "none",
  }} />
)}
      
    </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
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

        {/* Droite */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
          {game.status === "waiting" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>⏳ En attente...</span>
              <button
                onClick={() => navigator.clipboard.writeText(gameId)}
                style={{ padding: "6px 14px", background: "rgba(124,106,247,0.5)", color: "white", fontSize: "13px" }}
              >
                📋 Copier l'ID
              </button>
            </div>
          )}
          <button
            onClick={() => setShowLobbyConfirm(true)}
            style={{ padding: "10px 20px", background: "rgba(255,255,255,0.08)", color: "white", fontSize: "15px", fontWeight: 700 }}
          >
            🏠 Lobby
          </button>
        </div>
      </div>

      {/* BANDEAU TOUR */}
      {game.status === "playing" && (
        <AnimatePresence>
          {isMyTurn ? (
            <motion.div
              key="myturn"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                textAlign: "center", padding: "12px",
                background: "linear-gradient(135deg, rgba(124,106,247,0.4), rgba(90,79,207,0.4))",
                borderBottom: "2px solid rgba(124,106,247,0.6)",
                fontSize: "17px", fontWeight: 800, color: "#fff",
                flexShrink: 0, letterSpacing: "0.5px",
              }}
            >
              {game.rollsLeft > 0
                ? `🎯 C'EST TON TOUR ! Clique sur les dés à garder puis relance — ${game.rollsLeft} lancer(s) restant(s)`
                : "✅ PLUS DE LANCERS — Choisis une catégorie dans le tableau ci-dessous"}
            </motion.div>
          ) : (
            <motion.div
              key="theirturn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                textAlign: "center", padding: "14px",
                background: "rgba(255,255,255,0.04)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                fontSize: "14px", color: "rgba(255,255,255,0.5)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
  <span style={{ fontSize: "18px", fontWeight: 900 }}>
    ⏳ C'est au tour de {players.find(([uid]) => uid === game.currentTurn)?.[1]?.pseudo || "l'adversaire"}
  </span>
  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
    Patiente pendant qu'il joue...
  </span>
</div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Fin de partie */}
      <AnimatePresence>
        {gameOver && winner && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              textAlign: "center", padding: "14px",
              background: winner.uid === currentUser.uid ? "rgba(46,213,115,0.2)" : "rgba(255,71,87,0.2)",
              borderBottom: `1px solid ${winner.uid === currentUser.uid ? "rgba(46,213,115,0.4)" : "rgba(255,71,87,0.4)"}`,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "22px", fontWeight: 900 }}>
              {winner.uid === currentUser.uid ? "🏆 Tu as gagné !" : "😢 Tu as perdu !"}
            </span>
            <button onClick={() => navigate("/")} style={{ marginLeft: "16px", padding: "8px 20px", background: "rgba(255,255,255,0.15)", color: "white", fontSize: "15px" }}>
              🏠 Retour au lobby
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TABLEAU DE SCORE */}
      <div style={{ flex: 1, overflow: "auto", margin: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "40%" }} />
            {players.map(([uid]) => (
              <col key={uid} style={{ width: `${60 / players.length}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding: "10px 20px", background: "rgba(255,255,255,0.08)", textAlign: "left", fontSize: "13px", color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: "1px" }}>
                CATÉGORIE
              </th>
              {players.map(([uid, player]) => (
                <th key={uid} style={{
                  padding: "12px 20px", textAlign: "center", fontSize: "17px", fontWeight: 800,
                  background: uid === game.currentTurn ? "rgba(124,106,247,0.25)" : "rgba(255,255,255,0.05)",
                  color: uid === game.currentTurn ? "#a89af7" : "rgba(255,255,255,0.8)",
                  borderBottom: uid === game.currentTurn ? "2px solid rgba(124,106,247,0.5)" : "2px solid transparent",
                }}>
                  {player.pseudo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={players.length + 1} style={{ padding: "5px 20px", background: "rgba(124,106,247,0.15)", fontSize: "12px", fontWeight: 800, letterSpacing: "1px", color: "#a89af7", textTransform: "uppercase" }}>
                🎯 Section haute
              </td>
            </tr>

            {UPPER_CATEGORIES.map((key) => {
              const cat = CATEGORY_NAMES[key];
              const myScored = myScores[key] !== undefined;
              const isClickable = isMyTurn && !myScored && game.rollsLeft < 3;
              return (
                <tr key={key} onClick={() => selectCategory(key)} className={getRowClass(key)}
                  style={{ cursor: isClickable ? "pointer" : "default", transition: "background 0.15s" }}>
                  <td style={{ padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700 }}>{cat.label}</div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{cat.desc}</div>
                  </td>
                  {players.map(([uid, player]) => renderCell(uid, player, key))}
                </tr>
              );
            })}

            <tr style={{ background: bonus > 0 ? "rgba(46,213,115,0.1)" : "rgba(255,255,255,0.02)" }}>
              <td style={{ padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ fontSize: "15px", fontWeight: 700 }}>🎁 Bonus</div>
                <div style={{ fontSize: "12px", color: bonus > 0 ? "#2ed573" : "rgba(255,255,255,0.35)" }}>
                  35 pts si ≥ 63 — {upperTotal}/63 {bonus === 0 && `(encore ${63 - upperTotal} pts)`}
                </div>
              </td>
              {players.map(([uid, player]) => {
                const { bonus: pBonus } = calculateUpperBonus(player.scores || {});
                return (
                  <td key={uid} style={{ textAlign: "center", fontWeight: 800, fontSize: "16px", color: pBonus > 0 ? "#2ed573" : "rgba(255,255,255,0.2)", borderBottom: "1px solid rgba(255,255,255,0.1)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    {pBonus > 0 ? "+35" : "-"}
                  </td>
                );
              })}
            </tr>

            <tr>
              <td colSpan={players.length + 1} style={{ padding: "5px 20px", background: "rgba(124,106,247,0.15)", fontSize: "12px", fontWeight: 800, letterSpacing: "1px", color: "#a89af7", textTransform: "uppercase" }}>
                🎲 Section basse
              </td>
            </tr>

            {LOWER_CATEGORIES.map((key) => {
              const cat = CATEGORY_NAMES[key];
              const myScored = myScores[key] !== undefined;
              const isClickable = isMyTurn && !myScored && game.rollsLeft < 3;
              return (
                <tr key={key} onClick={() => selectCategory(key)} className={getRowClass(key)}
                  style={{ cursor: isClickable ? "pointer" : "default", transition: "background 0.15s" }}>
                  <td style={{ padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700 }}>{cat.label}</div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{cat.desc}</div>
                  </td>
                  {players.map(([uid, player]) => renderCell(uid, player, key))}
                </tr>
              );
            })}

            <tr style={{ background: "rgba(124,106,247,0.2)" }}>
              <td style={{ padding: "12px 20px", fontWeight: 800, fontSize: "16px" }}>🏆 Score total</td>
              {players.map(([uid, player]) => (
                <td key={uid} style={{ textAlign: "center", fontWeight: 900, fontSize: "22px", color: "#a89af7" }}>
                  {calculateTotalScore(player.scores || {})}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Game;