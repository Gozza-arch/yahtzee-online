import { useState } from "react";
import { register } from "../utils/auth";
import { useNavigate, Link } from "react-router-dom";

const Register = () => {
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await register(pseudo, password);
      navigate("/");
    } catch {
      setError("Erreur lors de l'inscription. Pseudo déjà pris ?");
    }
  };

  return (
    <div style={{ color: "white", textAlign: "center", marginTop: "100px" }}>
      <h1>🎲 Yahtzee</h1>
      <h2>Inscription</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleRegister}>
        <input
          type="text"
          placeholder="Choisis un pseudo"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          style={{ display: "block", margin: "10px auto", padding: "8px" }}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: "block", margin: "10px auto", padding: "8px" }}
        />
        <button type="submit">Créer mon compte</button>
      </form>
      <p>Déjà un compte ? <Link to="/login">Se connecter</Link></p>
    </div>
  );
};

export default Register;