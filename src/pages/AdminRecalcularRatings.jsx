import { useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminRecalcularRatings() {
  const [equipos, setEquipos] = useState([]);
  const [procesando, setProcesando] = useState(false);

  const normalizar = (texto) =>
    texto
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const recalcularRatings = async () => {
    try {
      setProcesando(true);

      const { data: equiposData, error } = await supabase
        .from("pronosticos_equipos")
        .select("*");

      const { data: historicos, error: errorHistoricos } = await supabase
        .from("pronosticos_temporadas_equipos")
        .select("*");

      if (error || errorHistoricos) {
        alert("Error al cargar datos: " + (error?.message || errorHistoricos?.message));
        return;
      }

      const resultado = equiposData.map((equipo) => {
        const partidos = Math.max(equipo.partidos || 1, 1);
        const puntosMaximos = partidos * 3;

        // 1. Ratings base (garantizados entre 0 y 100)
        const ratingGeneral = Math.min(((equipo.puntos || 0) / puntosMaximos) * 100, 100);
        const ratingOfensivo = Math.min(((equipo.goles_favor || 0) / partidos) * 33.33, 100);
        const ratingDefensivo = Math.max((1 - ((equipo.goles_contra || 0) / partidos / 3)) * 100, 0);
        const ratingForma = Math.min(((equipo.puntos_ultimos5 || 0) / 15) * 100, 100);

        // 2. CORRECCIÓN CRÍTICA: Usar partidos jugados, no victorias, para evitar división por cero o >100%
        const partidosLocal = Math.max((equipo.victorias_local || 0) + (equipo.empates_local || 0) + (equipo.derrotas_local || 0), 1);
        const partidosVisitante = Math.max((equipo.victorias_visitante || 0) + (equipo.empates_visitante || 0) + (equipo.derrotas_visitante || 0), 1);
        
        const ratingLocal = Math.min(((equipo.puntos_local || 0) / (partidosLocal * 3)) * 100, 100);
        const ratingVisitante = Math.min(((equipo.puntos_visitante || 0) / (partidosVisitante * 3)) * 100, 100);

        // 3. Rating Total (Pesos optimizados para Liga MX)
        const ratingTotal = 
          Number(ratingGeneral) * 0.25 +
          Number(ratingForma) * 0.25 +
          Number(ratingOfensivo) * 0.15 +
          Number(ratingDefensivo) * 0.15 +
          Number(ratingLocal) * 0.10 +
          Number(ratingVisitante) * 0.10;

        // 4. Rating Histórico y Tendencia
        const registrosHistoricos = historicos.filter(h => normalizar(h.equipo) === normalizar(equipo.equipo));
        let ratingHistorico = 0;

        if (registrosHistoricos.length > 0) {
          const suma = registrosHistoricos.reduce((acc, item) => {
            const pj = Math.max(item.partidos || 1, 1);
            const efectividad = ((item.puntos || 0) / (pj * 3)) * 100;
            return acc + efectividad;
          }, 0);
          ratingHistorico = suma / registrosHistoricos.length;
        }

        const ratingTendencia = Number(ratingTotal) - Number(ratingHistorico);

        return {
          ...equipo,
          rating_general: Number(ratingGeneral.toFixed(2)),
          rating_ofensivo: Number(ratingOfensivo.toFixed(2)),
          rating_defensivo: Number(ratingDefensivo.toFixed(2)),
          rating_forma: Number(ratingForma.toFixed(2)),
          rating_local: Number(ratingLocal.toFixed(2)),
          rating_visitante: Number(ratingVisitante.toFixed(2)),
          rating_total: Number(ratingTotal.toFixed(2)),
          rating_historico: Number(ratingHistorico.toFixed(2)),
          rating_tendencia: Number(ratingTendencia.toFixed(2)),
        };
      });

      // 5. OPTIMIZACIÓN: Actualización en paralelo (mucho más rápido)
      const promesasDeActualizacion = resultado.map(equipo => 
        supabase.from("pronosticos_equipos").update({
          rating_general: equipo.rating_general,
          rating_ofensivo: equipo.rating_ofensivo,
          rating_defensivo: equipo.rating_defensivo,
          rating_forma: equipo.rating_forma,
          rating_local: equipo.rating_local,
          rating_visitante: equipo.rating_visitante,
          rating_total: equipo.rating_total,
          rating_historico: equipo.rating_historico, // <-- AHORA SÍ SE GUARDA
          rating_tendencia: equipo.rating_tendencia,  // <-- AHORA SÍ SE GUARDA
        }).eq("equipo", equipo.equipo)
      );

      await Promise.all(promesasDeActualizacion);

      setEquipos(resultado.sort((a, b) => b.rating_total - a.rating_total));
      alert("✅ Ratings recalculados y guardados correctamente");
    } catch (error) {
      console.error(error);
      alert("Error crítico: " + error.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">⚙️ Recalcular Ratings</h1>
      <button
        onClick={recalcularRatings}
        disabled={procesando}
        className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 disabled:bg-gray-400"
      >
        {procesando ? "Procesando..." : "⚙️ Recalcular"}
      </button>

      {equipos.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded shadow overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Equipo</th>
                <th className="border p-2">General</th>
                <th className="border p-2">Forma</th>
                <th className="border p-2">Ofensivo</th>
                <th className="border p-2">Defensivo</th>
                <th className="border p-2">Local</th>
                <th className="border p-2">Visitante</th>
                <th className="border p-2 font-bold">Total</th>
                <th className="border p-2">Histórico</th>
                <th className="border p-2">Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {equipos.map((equipo) => (
                <tr key={equipo.equipo} className="hover:bg-gray-50">
                  <td className="border p-2 font-medium">{equipo.equipo}</td>
                  <td className="border p-2 text-center">{equipo.rating_general}</td>
                  <td className="border p-2 text-center">{equipo.rating_forma}</td>
                  <td className="border p-2 text-center">{equipo.rating_ofensivo}</td>
                  <td className="border p-2 text-center">{equipo.rating_defensivo}</td>
                  <td className="border p-2 text-center">{equipo.rating_local}</td>
                  <td className="border p-2 text-center">{equipo.rating_visitante}</td>
                  <td className="border p-2 text-center font-bold text-blue-700">{equipo.rating_total}</td>
                  <td className="border p-2 text-center text-gray-600">{equipo.rating_historico}</td>
                  <td className={`border p-2 text-center font-bold ${equipo.rating_tendencia > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {equipo.rating_tendencia > 0 ? '+' : ''}{equipo.rating_tendencia}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}