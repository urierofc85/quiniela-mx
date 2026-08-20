import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminPronosticosPartidos() {
  const [equipos, setEquipos] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    cargarEquipos();
    cargarPartidos();
  }, []);

  const cargarEquipos = async () => {
    const { data } = await supabase
      .from("pronosticos_equipos")
      .select("*")
      .order("equipo");

    setEquipos(data || []);
  };

  const cargarPartidos = async () => {
    const { data } = await supabase
      .from("pronosticos_partidos")
      .select("*")
      .order("fecha_partido", { ascending: true });

    // FILTRO: Solo mostrar partidos de hoy en adelante (oculta los pasados)
    const hoyStr = new Date().toISOString().split("T")[0]; // Formato "YYYY-MM-DD"
    
    const partidosVigentes = (data || []).filter((p) => {
      // Asumimos que fecha_partido viene en formato "YYYY-MM-DD"
      return p.fecha_partido >= hoyStr;
    });

    setPartidos(partidosVigentes);
  };

  const eliminarPartido = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este partido?")) {
      return;
    }

    const { error } = await supabase
      .from("pronosticos_partidos")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
    } else {
      cargarPartidos();
    }
  };

  const generarPronosticos = async () => {
    try {
      setGenerando(true);

      const normalizar = (texto = "") =>
        texto
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();

      const { data: equiposData, error } = await supabase
        .from("pronosticos_equipos")
        .select("*");

      if (error) {
        alert(error.message);
        return;
      }

      const mapaEquipos = {};
      equiposData.forEach((equipo) => {
        mapaEquipos[normalizar(equipo.equipo)] = equipo;
      });

      const alias = {
        guadalajara: "chivas",
      };

      const obtenerEquipo = (nombre) => {
        const clave = normalizar(nombre);
        return mapaEquipos[alias[clave] || clave];
      };

      let partidosProcesados = 0;

      for (const partido of partidos) {
        const localEquipo = obtenerEquipo(partido.local);
        const visitaEquipo = obtenerEquipo(partido.visita);

        if (!localEquipo || !visitaEquipo) {
          console.log("Equipo no encontrado en base de datos:", partido.local, "vs", partido.visita);
          continue;
        }

        const scoreLocal =
          Number(localEquipo.rating_total || 0) * 0.30 +
          Number(localEquipo.rating_historico || 0) * 0.20 +
          Number(localEquipo.rating_tendencia || 0) * 0.10 +
          Number(localEquipo.rating_ofensivo || 0) * 0.10 +
          Number(localEquipo.rating_defensivo || 0) * 0.10 +
          Number(localEquipo.pct_hist_local_gana || 0) * 0.20;

        const scoreVisita =
          Number(visitaEquipo.rating_total || 0) * 0.30 +
          Number(visitaEquipo.rating_historico || 0) * 0.20 +
          Number(visitaEquipo.rating_tendencia || 0) * 0.10 +
          Number(visitaEquipo.rating_ofensivo || 0) * 0.10 +
          Number(visitaEquipo.rating_defensivo || 0) * 0.10 +
          Number(visitaEquipo.pct_hist_visita_gana || 0) * 0.20;

        const diferencia = Math.abs(scoreLocal - scoreVisita);

        let empateFactor =
          (Number(localEquipo.pct_hist_local_empata || 0) +
            Number(visitaEquipo.pct_hist_visita_empata || 0)) /
          2;

        if (diferencia < 5) {
          empateFactor *= 2;
        } else if (diferencia < 10) {
          empateFactor *= 1.5;
        } else if (diferencia < 15) {
          empateFactor *= 1.2;
        }

        const total = scoreLocal + scoreVisita + empateFactor;

        if (total <= 0) {
          continue;
        }

        const probLocal = Number(((scoreLocal / total) * 100).toFixed(2));
        const probEmpate = Number(((empateFactor / total) * 100).toFixed(2));
        const probVisita = Number(((scoreVisita / total) * 100).toFixed(2));

        let pronostico = "EMPATE";
        const maximo = Math.max(probLocal, probEmpate, probVisita);

        if (maximo === probLocal) {
          pronostico = "LOCAL";
        } else if (maximo === probVisita) {
          pronostico = "VISITA";
        }

        const { error: updateError } = await supabase
          .from("pronosticos_partidos")
          .update({
            score_local: Number(scoreLocal.toFixed(2)),
            score_visita: Number(scoreVisita.toFixed(2)),
            diferencia: Number(diferencia.toFixed(2)),
            prob_local: probLocal,
            prob_empate: probEmpate,
            prob_visita: probVisita,
            pronostico: pronostico,
          })
          .eq("id", partido.id);

        if (updateError) {
          console.error("Error actualizando partido", partido.id, updateError);
        } else {
          partidosProcesados++;
        }
      }

      // Recargar la lista para mostrar los nuevos datos inmediatamente
      await cargarPartidos();

      alert(`✅ Pronósticos generados correctamente para ${partidosProcesados} partidos.`);
    } catch (error) {
      console.error(error);
      alert("Error al generar pronósticos: " + error.message);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">⚽ Administración de Partidos y Pronósticos</h1>

      <div className="bg-white shadow rounded p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Partidos Registrados (Próximos)</h2>
          <button
            onClick={generarPronosticos}
            disabled={generando || partidos.length === 0}
            className={`px-4 py-2 rounded text-white font-semibold transition ${
              generando || partidos.length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {generando ? "⏳ Generando..." : "🎯 Generar Pronósticos"}
          </button>
        </div>

        {partidos.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border border-dashed border-gray-300">
            No hay partidos próximos registrados. Importa la jornada desde SofaScore.
          </div>
        ) : (
          <div className="space-y-3">
            {partidos.map((partido) => (
              <div
                key={partido.id}
                className="flex flex-col md:flex-row justify-between items-start md:items-center border rounded p-4 hover:bg-gray-50 transition"
              >
                <div className="mb-3 md:mb-0">
                  <div className="text-lg font-bold text-gray-800">
                    {partido.local} <span className="text-gray-400 mx-2">vs</span> {partido.visita}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    📅 {partido.fecha_partido} &nbsp;|&nbsp; 🏟️ Jornada {partido.jornada}
                  </div>
                </div>

                {/* CONDICIÓN CORREGIDA: Se muestra si existe el pronóstico, sin depender de que sea > 0 */}
                {partido.pronostico && (
                  <div className="bg-gray-100 p-3 rounded-lg text-sm min-w-[200px]">
                    <div className="flex justify-between mb-1">
                      <span>🏠 Local:</span>
                      <span className="font-semibold">{partido.prob_local}%</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>🤝 Empate:</span>
                      <span className="font-semibold">{partido.prob_empate}%</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span>✈️ Visita:</span>
                      <span className="font-semibold">{partido.prob_visita}%</span>
                    </div>
                    <div className="border-t pt-2 mt-2 font-bold text-center text-blue-700 bg-blue-50 rounded">
                      ✅ Pronóstico: {partido.pronostico}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => eliminarPartido(partido.id)}
                  className="mt-3 md:mt-0 md:ml-4 bg-red-100 text-red-600 hover:bg-red-200 px-3 py-2 rounded text-sm font-semibold transition"
                >
                  🗑️ Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}