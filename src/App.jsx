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
import RankingSurvivor from "./pages/RankingSurvivor";
import CorregirPronosticos from "./pages/CorregirPronosticos";
import Historico from "./pages/Historico";
import JugadorHistorico from "./pages/JugadorHistorico";
import JugadorVsJugador from "./pages/JugadorVsJugador";
import Temporadas from "./pages/Temporadas";

import AccesoPronosticos from "./pages/AccesoPronosticos";
import Pronosticos from "./pages/Pronosticos";
import AdminPronosticosEquipos from "./pages/AdminPronosticosEquipos";
import AdminPronosticosPartidos from "./pages/AdminPronosticosPartidos";
import AdminActualizarEstadisticas from "./pages/AdminActualizarEstadisticas";
import AdminImportarLigaMX from "./pages/AdminImportarLigaMX";
import AdminPronosticos from "./pages/AdminPronosticos";
import AdminImportarSofaScore from "./pages/AdminImportarSofaScore";
import AdminImportarFormaScore from "./pages/AdminImportarFormaScore";
import AdminImportarCalendarioScore from "./pages/AdminImportarCalendarioScore";
import AdminFormaTemporadas from "./pages/AdminFormaTemporadas";
import AdminRecalcularRatings from "./pages/AdminRecalcularRatings";

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

        {/* ========================= */}
        {/* PRONÓSTICOS PRIVADOS */}
        {/* ========================= */}

        <Route
          path="/acceso-pronosticos"
          element={<AccesoPronosticos />}
        />

        <Route
          path="/pronosticos"
          element={<Pronosticos />}
        />

        <Route
          path="/admin-pronosticos-equipos"
          element={<AdminPronosticosEquipos />}
        />

        <Route
          path="/admin-pronosticos-partidos"
          element={<AdminPronosticosPartidos />}
        />

        <Route
          path="/admin-actualizar-estadisticas"
          element={<AdminActualizarEstadisticas />}
        />

        <Route
        path="/admin-pronosticos"
        element={<AdminPronosticos />}
        />

        <Route
          path="/admin-importar-ligamx"
          element={<AdminImportarLigaMX />}
        />

        <Route
  path="/admin-importar-sofascore"
  element={<AdminImportarSofaScore />}
/>

<Route
  path="/admin-importar-formascore"
  element={<AdminImportarFormaScore />}
/>

<Route
  path="/admin-importar-calendario-score"
  element={<AdminImportarCalendarioScore />}
/>
<Route
  path="/admin-forma-temporadas"
  element={<AdminFormaTemporadas />}
/>

<Route
  path="/admin-recalcular-ratings"
  element={<AdminRecalcularRatings />}
/>

      </Routes>
    </BrowserRouter>
  );
}

export default App;