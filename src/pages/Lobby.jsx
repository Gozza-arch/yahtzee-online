import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createGame, joinGame } from "../utils/gameManager";
import { logout } from "../utils/auth";
import { BADGES } from "../utils/badges";

const Lobby = () => {
  const { currentUser, playerProfile } = useAuth();
  const navigate = useNavigate();
  const [gameId, setGameId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const id = await createGame(currentUser.uid, playerProfile.pseudo);
      navigate(`/game/${id}`);
    } catch {
      setError("Erreur lors de la création de la partie");
    }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!gameId.trim()) return;
    setLoading(true);
    try {
      await joinGame(gameId.trim(), currentUser.uid, playerProfile.pseudo);
      navigate(`/game/${gameId.trim()}`);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const playerBadges = (playerProfile?.badges || []).map((id) => BADGES[id]).filter(Boolean);

  return (
    <div style={{ color: "white", textAlign: "center", marginTop: "80px" }}>
      <h1>🎲 Yahtzee</h1>
      <h2>Bienvenue {playerProfile?.pseudo} !</h2>
      <p style={{ color: "#aaa" }}>
        Victoires : {playerProfile?.victories || 0} 🏆 |
        Parties : {playerProfile?.totalGames || 0} 🎮
      </p>

      {/* Badges */}
      {playerBadges.length > 0 && (
        <div style={{ margin: "10px auto", maxWidth: "400px" }}>
          <p style={{ color: "#aaa", fontSize: "14px" }}>Mes badges :</p>
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
            {playerBadges.map((badge) => (
              <div
                key={badge.id}
                title={badge.description}
                style={{
                  background: "#2d3a5a", border: "1px solid gold",
                  borderRadius: "8px", padding: "6px 12px", fontSize: "14px"
                }}
              >
                {badge.icon} {badge.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ margin: "40px 0" }}>
        <button
          onClick={handleCreate}
          disabled={loading}
          style={{
            padding: "12px 30px", fontSize: "16px",
            cursor: "pointer", display: "block",
            margin: "0 auto 20px", width: "200px"
          }}
        >
          🎮 Créer une partie
        </button>

        <p>— ou —</p>

        <input
          type="text"
          placeholder="ID de la partie"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          style={{ padding: "8px", marginRight: "10px", fontSize: "16px" }}
        />
        <button
          onClick={handleJoin}
          disabled={loading}
          style={{ padding: "8px 20px", fontSize: "16px", cursor: "pointer" }}
        >
          Rejoindre
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
        <button
          onClick={() => navigate("/leaderboard")}
          style={{ padding: "8px 20px", cursor: "pointer" }}
        >
          🏆 Classement
        </button>
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 20px", cursor: "pointer",
            background: "#c0392b", color: "white",
            border: "none", borderRadius: "4px"
          }}
        >
          🚪 Déconnexion
        </button>
      </div>
    </div>
  );
};

export default Lobby;