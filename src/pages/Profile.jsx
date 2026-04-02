import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { THEMES, AVATARS, getTheme, setTheme, getAvatar, setAvatar } from "../utils/themes";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "framer-motion";

const Profile = () => {
  const { playerProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const [selectedTheme, setSelectedTheme] = useState(getTheme());
  const [selectedAvatar, setSelectedAvatar] = useState(getAvatar());
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setTheme(selectedTheme);
    setAvatar(selectedAvatar);
    const theme = THEMES[selectedTheme] || THEMES.default;
    document.body.style.background = theme.background;
    document.documentElement.style.setProperty("--accent", theme.accent);
    if (currentUser) {
      try {
        await updateDoc(doc(db, "players", currentUser.uid), {
          avatar: selectedAvatar,
        });
      } catch (e) {
        console.error("Erreur sauvegarde profil:", e);
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", padding: "40px 20px", maxWidth: "600px", margin: "0 auto" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

        <h1 style={{ textAlign: "center", fontSize: "32px", fontWeight: 900, marginBottom: "4px" }}>
          🎨 Mon Profil
        </h1>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", marginBottom: "32px" }}>
          {playerProfile?.pseudo}
        </p>

        {/* Avatar */}
        <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "16px" }}>Choisis ton avatar</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "32px" }}>
          {AVATARS.map((avatar) => (
            <motion.div
              key={avatar.id}
              onClick={() => setSelectedAvatar(avatar.id)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              style={{
                width: "56px", height: "56px", fontSize: "28px",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "12px", cursor: "pointer",
                background: selectedAvatar === avatar.id ? "rgba(124,106,247,0.3)" : "rgba(255,255,255,0.05)",
                border: selectedAvatar === avatar.id ? "2px solid rgba(124,106,247,0.8)" : "2px solid rgba(255,255,255,0.1)",
                boxShadow: selectedAvatar === avatar.id ? "0 0 16px rgba(124,106,247,0.4)" : "none",
              }}
              title={avatar.label}
            >
              {avatar.id}
            </motion.div>
          ))}
        </div>

        {/* Thèmes */}
        <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "16px" }}>Choisis ton thème</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
          {Object.values(THEMES).map((theme) => (
            <motion.div
              key={theme.id}
              onClick={() => setSelectedTheme(theme.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: "flex", alignItems: "center", gap: "16px",
                padding: "14px 20px", borderRadius: "14px", cursor: "pointer",
                background: selectedTheme === theme.id ? "rgba(124,106,247,0.2)" : "rgba(255,255,255,0.05)",
                border: selectedTheme === theme.id ? "2px solid rgba(124,106,247,0.8)" : "2px solid rgba(255,255,255,0.1)",
              }}
            >
              {/* Aperçu du thème */}
              <div style={{
                width: "48px", height: "48px", borderRadius: "10px",
                background: theme.background, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "22px",
              }}>
                {theme.preview}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: "16px" }}>{theme.label}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                  Couleur d'accent :
                  <span style={{ color: theme.accent, fontWeight: 700, marginLeft: "6px" }}>■ {theme.accent}</span>
                </div>
              </div>
              {selectedTheme === theme.id && (
                <span style={{ fontSize: "20px" }}>✅</span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Bouton sauvegarder */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          style={{
            width: "100%", padding: "14px", fontSize: "17px", fontWeight: 800,
            background: saved ? "linear-gradient(135deg, #2ed573, #1abc9c)" : "linear-gradient(135deg, #7c6af7, #5a4fcf)",
            color: "white", marginBottom: "12px",
          }}
        >
          {saved ? "✅ Sauvegardé !" : "💾 Sauvegarder"}
        </motion.button>

        <button
          onClick={() => navigate("/")}
          style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.08)", color: "white", fontSize: "15px" }}
        >
          🏠 Retour au lobby
        </button>
      </motion.div>
    </div>
  );
};

export default Profile;