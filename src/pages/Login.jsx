import { useState } from "react";
import { login } from "../utils/auth";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(pseudo, password);
      navigate("/");
    } catch {
      setError("Pseudo ou mot de passe incorrect");
    }
  };

  return (
    <div style={{ color: "white", textAlign: "center", marginTop: "100px" }}>
      <h1>🎲 Yahtzee</h1>
      <h2>Connexion</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Pseudo"
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
        <button type="submit">Se connecter</button>
      </form>
      <p>Pas encore de compte ? <Link to="/register">S'inscrire</Link></p>
    </div>
  );
};

export default Login;