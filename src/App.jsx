
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Login from "./Login";
import Admin from "./Admin";
import Partidos from "./Partidos";

import Quiniela from "./pages/Quiniela";
import AdminDashboard from "./pages/AdminDashboard";

import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import ResultadosAdmin from "./pages/ResultadosAdmin";
import Posiciones from "./pages/Posiciones";
import Perfil from "./pages/Perfil";

import Participantes from "./pages/Participantes";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/admin"
          element={<Admin />}
        />

        <Route
          path="/admin/dashboard"
          element={<AdminDashboard />}
        />

        <Route
          path="/partidos"
          element={<Partidos />}
        />

        <Route
          path="/quiniela"
          element={<Quiniela />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        <Route
          path="/admin/resultados"
          element={<ResultadosAdmin />}
        />

        <Route
          path="/posiciones"
          element={<Posiciones />}
        />

        <Route
          path="/perfil"
          element={<Perfil />}
        />

        <Route
          path="/participantes"
          element={<Participantes />}
        />

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
