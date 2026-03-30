import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getLeaderboard } from "../utils/ranking";

const Leaderboard = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const data = await getLeaderboard();
      setPlayers(data);
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div style={{ color: "white", textAlign: "center", padding: "20px" }}>
      <h1>🏆 Classement</h1>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <div style={{ display: "inline-block", textAlign: "left", minWidth: "400px" }}>
          {/* En-tête */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            padding: "8px 16px", color: "#aaa", fontSize: "14px"
          }}>
            <span>Rang</span>
            <span>Joueur</span>
            <span>Victoires</span>
            <span>Parties</span>
          </div>

          {/* Liste des joueurs */}
          {players.map((player, index) => (
            <div
              key={player.id}
              style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: "20px",
                padding: "10px 16px", margin: "4px 0",
                background: index < 3 ? "#2d3a5a" : "#1a1a2e",
                borderRadius: "8px",
                border: index === 0 ? "1px solid gold" :
                        index === 1 ? "1px solid silver" :
                        index === 2 ? "1px solid #cd7f32" : "none",
              }}
            >
              <span style={{ fontSize: "20px", minWidth: "30px" }}>
                {medals[index] || `#${index + 1}`}
              </span>
              <span style={{ flex: 1, marginLeft: "10px" }}>{player.pseudo}</span>
              <span style={{ color: "#4caf50", minWidth: "60px", textAlign: "center" }}>
                {player.victories} 🏆
              </span>
              <span style={{ color: "#aaa", minWidth: "60px", textAlign: "center" }}>
                {player.totalGames} 🎮
              </span>
            </div>
          ))}

          {players.length === 0 && (
            <p style={{ textAlign: "center", color: "#aaa" }}>
              Aucun joueur pour l'instant. Sois le premier ! 🎲
            </p>
          )}
        </div>
      )}

      <button
        onClick={() => navigate("/")}
        style={{ marginTop: "30px", padding: "10px 30px", cursor: "pointer", fontSize: "16px" }}
      >
        🏠 Retour au lobby
      </button>
    </div>
  );
};

export default Leaderboard;