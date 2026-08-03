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
import Survivor from "./pages/Survivor";
import AdminSurvivor from "./pages/AdminSurvivor";
import RankingSurvivor from "./pages/RankingSurvivor"; // 👈 1. Importar el componente
import CorregirPronosticos from "./pages/CorregirPronosticos";
import Historico from "./pages/Historico";
import JugadorHistorico from "./pages/JugadorHistorico";
import JugadorVsJugador from "./pages/JugadorVsJugador";
import Temporadas from "./pages/Temporadas";

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

        <Route
          path="/survivor"
          element={<Survivor />}
        />

        <Route
          path="/admin-survivor"
          element={<AdminSurvivor />}
        />

        {/* 👇 2. Agregar la ruta para RankingSurvivor */}
        <Route
          path="/ranking-survivor"
          element={<RankingSurvivor />}
        />

        <Route
        path="/corregir-pronosticos"
        element={<CorregirPronosticos />}
      />
      <Route
      path="/historico"
      element={<Historico />}
       />

      <Route
        path="/historico/:id"
        element={<JugadorHistorico />}
      />

      <Route
  path="/comparador"
  element={<JugadorVsJugador />}
/>

<Route
  path="/temporadas"
  element={<Temporadas />}
/>

      </Routes>
    </BrowserRouter>
  );
}

export default App;