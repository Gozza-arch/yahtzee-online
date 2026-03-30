import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";

const Home = () => {
  const { playerProfile } = useAuth();
  return (
    <div style={{ color: "white", textAlign: "center", marginTop: "100px" }}>
      <h1>🎲 Bienvenue {playerProfile?.pseudo} !</h1>
      <p>Le jeu arrive bientôt...</p>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;