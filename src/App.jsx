import { BrowserRouter, Routes, Route } from "react-router-dom";

// Importa el guardia de seguridad
import AdminRoute from "./AdminRoute"; 

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
import AdminRecalcularPorcentajes from "./pages/AdminRecalcularPorcentajes";
import AdminImportarTransfermarkt from "./pages/AdminImportarTransfermarkt";
import AdminDatosExtra from "./pages/AdminDatosExtra";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ========================================== */}
        {/* RUTAS PÚBLICAS / DE USUARIO (Sin protección) */}
        {/* ========================================== */}
        <Route path="/" element={<Login />} />
        <Route path="/quiniela" element={<Quiniela />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/posiciones" element={<Posiciones />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/survivor" element={<Survivor />} />
        <Route path="/ranking-survivor" element={<RankingSurvivor />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/historico/:id" element={<JugadorHistorico />} />
        <Route path="/comparador" element={<JugadorVsJugador />} />
        <Route path="/acceso-pronosticos" element={<AccesoPronosticos />} />
        <Route path="/pronosticos" element={<Pronosticos />} />

        {/* ========================================== */}
        {/* RUTAS DE ADMINISTRADOR (Protegidas) */}
        {/* ========================================== */}
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/partidos" element={<AdminRoute><Partidos /></AdminRoute>} />
        <Route path="/admin/resultados" element={<AdminRoute><ResultadosAdmin /></AdminRoute>} />
        <Route path="/participantes" element={<AdminRoute><Participantes /></AdminRoute>} />
        <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/admin-survivor" element={<AdminRoute><AdminSurvivor /></AdminRoute>} />
        <Route path="/corregir-pronosticos" element={<AdminRoute><CorregirPronosticos /></AdminRoute>} />
        <Route path="/temporadas" element={<AdminRoute><Temporadas /></AdminRoute>} />

        {/* Rutas de administración de pronósticos (Todas protegidas) */}
        <Route path="/admin-pronosticos-equipos" element={<AdminRoute><AdminPronosticosEquipos /></AdminRoute>} />
        <Route path="/admin-pronosticos-partidos" element={<AdminRoute><AdminPronosticosPartidos /></AdminRoute>} />
        <Route path="/admin-actualizar-estadisticas" element={<AdminRoute><AdminActualizarEstadisticas /></AdminRoute>} />
        <Route path="/admin-pronosticos" element={<AdminRoute><AdminPronosticos /></AdminRoute>} />
        <Route path="/admin-importar-ligamx" element={<AdminRoute><AdminImportarLigaMX /></AdminRoute>} />
        <Route path="/admin-importar-sofascore" element={<AdminRoute><AdminImportarSofaScore /></AdminRoute>} />
        <Route path="/admin-importar-formascore" element={<AdminRoute><AdminImportarFormaScore /></AdminRoute>} />
        <Route path="/admin-importar-calendario-score" element={<AdminRoute><AdminImportarCalendarioScore /></AdminRoute>} />
        <Route path="/admin-forma-temporadas" element={<AdminRoute><AdminFormaTemporadas /></AdminRoute>} />
        <Route path="/admin-recalcular-ratings" element={<AdminRoute><AdminRecalcularRatings /></AdminRoute>} />
        <Route path="/admin-recalcular-porcentajes" element={<AdminRoute><AdminRecalcularPorcentajes /></AdminRoute>} />
        <Route path="/admin-importar-transfermarkt" element={<AdminImportarTransfermarkt />} 
        <Route path="/admin-datos-extra" element={<AdminDatosExtra />} />
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;