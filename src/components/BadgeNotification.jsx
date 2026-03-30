import { useEffect, useState } from "react";

const BadgeNotification = ({ badges, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!visible || badges.length === 0) return null;

  return (
    <div style={{
      position: "fixed", top: "20px", right: "20px",
      zIndex: 1000, display: "flex", flexDirection: "column", gap: "10px"
    }}>
      {badges.map((badge) => (
        <div
          key={badge.id}
          style={{
            background: "#2d3a5a",
            border: "2px solid gold",
            borderRadius: "12px",
            padding: "15px 20px",
            color: "white",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            animation: "slideIn 0.3s ease",
            minWidth: "250px",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#aaa" }}>🎖️ Nouveau badge débloqué !</p>
          <p style={{ margin: "5px 0 0", fontSize: "18px", fontWeight: "bold" }}>
            {badge.icon} {badge.label}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#ccc" }}>{badge.description}</p>
        </div>
      ))}
    </div>
  );
};

export default BadgeNotification;