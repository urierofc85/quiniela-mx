import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminPronosticosPartidos() {
  const [partidosProximos, setPartidosProximos] = useState([]);
  const [partidosPendientes, setPartidosPendientes] = useState([]);
  const [generando, setGenerando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [tabActiva, setTabActiva] = useState("pendientes"); // 'pendientes' o 'proximos'

  useEffect(() => {
    cargarPartidos();
  }, []);

  const cargarPartidos = async () => {
    const { data, error } = await supabase
      .from("pronosticos_partidos")
      .select("*")
      .order("fecha_partido", { ascending: true });

    if (error) {
      console.error("❌ Error cargando partidos:", error);
      return;
    }

    const hoyStr = new Date().toISOString().split("T")[0];

    // Separar en dos grupos
    const proximos = [];
    const pendientes = [];

    (data || []).forEach((p) => {
      const fechaPartido = p.fecha_partido ? String(p.fecha_partido).split("T")[0] : "";
      
      if (fechaPartido >= hoyStr) {
        proximos.push(p);
      } else {
        // Si ya pasó la fecha y NO tiene resultado real, está pendiente de validar
        if (!p.resultado_real) {
          pendientes.push(p);
        }
      }
    });

    setPartidosProximos(proximos);
    setPartidosPendientes(pendientes);
  };

  const eliminarPartido = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este partido?")) return;
    const { error } = await supabase.from("pronosticos_partidos").delete().eq("id", id);
    if (error) alert(error.message);
    else cargarPartidos();
  };

  const generarPronosticos = async () => {
    try {
      setGenerando(true);
      const normalizar = (texto = "") => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const { data: equiposData, error: errorEquipos } = await supabase.from("pronosticos_equipos").select("*");

      if (errorEquipos) {
        alert("Error cargando equipos: " + errorEquipos.message);
        return;
      }

      const mapaEquipos = {};
      equiposData.forEach((equipo) => { mapaEquipos[normalizar(equipo.equipo)] = equipo; });
      const alias = { guadalajara: "chivas", "tigres uanl": "tigres", "cruz azul": "cruzazul" };
      const obtenerEquipo = (nombre) => {
        const clave = normalizar(nombre);
        return mapaEquipos[alias[clave] || clave];
      };

      let partidosProcesados = 0;
      const promesasActualizacion = [];

      for (const partido of partidosProximos) {
        const localEquipo = obtenerEquipo(partido.local);
        const visitaEquipo = obtenerEquipo(partido.visita);

        if (!localEquipo || !visitaEquipo) continue;

        const scoreLocal =
          Number(localEquipo.rating_general || 0) * 0.25 +
          Number(localEquipo.rating_forma || 0) * 0.25 +
          Number(localEquipo.rating_ofensivo || 0) * 0.15 +
          Number(localEquipo.rating_defensivo || 0) * 0.15 +
          Number(localEquipo.rating_local || 0) * 0.10 +
          Number(localEquipo.rating_tendencia || 0) * 0.10;

        const scoreVisita =
          Number(visitaEquipo.rating_general || 0) * 0.25 +
          Number(visitaEquipo.rating_forma || 0) * 0.25 +
          Number(visitaEquipo.rating_ofensivo || 0) * 0.15 +
          Number(visitaEquipo.rating_defensivo || 0) * 0.15 +
          Number(visitaEquipo.rating_visitante || 0) * 0.10 +
          Number(visitaEquipo.rating_tendencia || 0) * 0.10;

        const diferencia = Math.abs(scoreLocal - scoreVisita);
        let empateFactor = (Number(localEquipo.pct_hist_local_empata || 0) + Number(visitaEquipo.pct_hist_visita_empata || 0)) / 2;

        if (diferencia < 5) empateFactor *= 2.0;
        else if (diferencia < 10) empateFactor *= 1.5;
        else if (diferencia < 15) empateFactor *= 1.2;

        const total = scoreLocal + scoreVisita + empateFactor;
        if (total <= 0) continue;

        const probLocal = Number(((scoreLocal / total) * 100).toFixed(2));
        const probEmpate = Number(((empateFactor / total) * 100).toFixed(2));
        const probVisita = Number(((scoreVisita / total) * 100).toFixed(2));

        let pronostico = "EMPATE";
        const maximo = Math.max(probLocal, probEmpate, probVisita);
        if (maximo === probLocal) pronostico = "LOCAL";
        else if (maximo === probVisita) pronostico = "VISITA";

        promesasActualizacion.push(
          supabase.from("pronosticos_partidos").update({
            score_local: Number(scoreLocal.toFixed(2)),
            score_visita: Number(scoreVisita.toFixed(2)),
            diferencia: Number(diferencia.toFixed(2)),
            prob_local: probLocal,
            prob_empate: probEmpate,
            prob_visita: probVisita,
            pronostico: pronostico,
          }).eq("id", partido.id)
        );
        partidosProcesados++;
      }

      await Promise.all(promesasActualizacion);
      await cargarPartidos();
      alert(`✅ Pronósticos generados para ${partidosProcesados} partidos.`);
    } catch (error) {
      console.error("💥 Error:", error);
      alert("Error al generar pronósticos: " + error.message);
    } finally {
      setGenerando(false);
    }
  };

  // 🆕 FUNCIÓN CLAVE: Validar resultado y actualizar forma de equipos
  const validarResultado = async (partido, resultadoReal, golesLocal, golesVisita) => {
    if (!window.confirm(`¿Confirmar resultado: ${partido.local} ${golesLocal} - ${golesVisita} ${partido.visita}? \nEsto actualizará las estadísticas de los equipos.`)) return;

    try {
      setValidando(true);

      const normalizar = (texto = "") => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const { data: equiposData } = await supabase.from("pronosticos_equipos").select("*");
      const mapaEquipos = {};
      equiposData.forEach((e) => { mapaEquipos[normalizar(e.equipo)] = e; });
      const alias = { guadalajara: "chivas", "tigres uanl": "tigres", "cruz azul": "cruzazul" };
      
      const localOficial = mapaEquipos[alias[normalizar(partido.local)] || normalizar(partido.local)]?.equipo;
      const visitaOficial = mapaEquipos[alias[normalizar(partido.visita)] || normalizar(partido.visita)]?.equipo;

      if (!localOficial || !visitaOficial) {
        alert("Error: No se encontraron los equipos oficiales en la base de datos.");
        return;
      }

      const acerto = partido.pronostico === resultadoReal;
      const promesas = [];

      // 1. Actualizar el partido con el resultado real y si se acertó
      promesas.push(
        supabase.from("pronosticos_partidos").update({
          resultado_real: resultadoReal,
          goles_local_real: Number(golesLocal),
          goles_visita_real: Number(golesVisita),
          acerto: acerto,
        }).eq("id", partido.id)
      );

      // 2. Función auxiliar para actualizar stats de un equipo
      const actualizarStatsEquipo = (nombreOficial, esLocal, resultado) => {
        let puntosSuma = 0, victoriasSuma = 0, empatesSuma = 0, derrotasSuma = 0;
        
        if (resultado === "LOCAL") {
          if (esLocal) { puntosSuma = 3; victoriasSuma = 1; }
          else { derrotasSuma = 1; }
        } else if (resultado === "VISITA") {
          if (esLocal) { derrotasSuma = 1; }
          else { puntosSuma = 3; victoriasSuma = 1; }
        } else { // EMPATE
          puntosSuma = 1; empatesSuma = 1;
        }

        promesas.push(
          supabase.rpc("incrementar_stats_equipo", { // 👈 Ver nota abajo sobre este RPC, o usa la alternativa de update directo
            p_equipo: nombreOficial,
            p_partidos: 1,
            p_victorias: victoriasSuma,
            p_empates: empatesSuma,
            p_derrotas: derrotasSuma,
            p_puntos: puntosSuma,
            p_puntos_ultimos5: puntosSuma // Se suma a la forma (nota: idealmente se requiere un RPC para manejar el "desplazamiento" de los últimos 5)
          })
        );
      };

      // ⚠️ ALTERNATIVA SIN RPC (Más segura si no sabes crear RPCs en Supabase):
      // Descomenta esto y comenta el bloque "actualizarStatsEquipo" de arriba si prefieres hacerlo con updates directos:
      /*
      const equipoLocalData = equiposData.find(e => e.equipo === localOficial);
      const equipoVisitaData = equiposData.find(e => e.equipo === visitaOficial);

      const calcularNuevosStats = (eq, pts, v, e, d) => ({
        partidos: (eq.partidos || 0) + 1,
        victorias: (eq.victorias || 0) + v,
        empates: (eq.empates || 0) + e,
        derrotas: (eq.derrotas || 0) + d,
        puntos: (eq.puntos || 0) + pts,
        puntos_ultimos5: Math.min(((eq.puntos_ultimos5 || 0) + pts), 15) // Tope simple de 15
      });

      if (resultadoReal === "LOCAL") {
        promesas.push(supabase.from("pronosticos_equipos").update(calcularNuevosStats(equipoLocalData, 3, 1, 0, 0)).eq("equipo", localOficial));
        promesas.push(supabase.from("pronosticos_equipos").update(calcularNuevosStats(equipoVisitaData, 0, 0, 0, 1)).eq("equipo", visitaOficial));
      } else if (resultadoReal === "VISITA") {
        promesas.push(supabase.from("pronosticos_equipos").update(calcularNuevosStats(equipoLocalData, 0, 0, 0, 1)).eq("equipo", localOficial));
        promesas.push(supabase.from("pronosticos_equipos").update(calcularNuevosStats(equipoVisitaData, 3, 1, 0, 0)).eq("equipo", visitaOficial));
      } else {
        promesas.push(supabase.from("pronosticos_equipos").update(calcularNuevosStats(equipoLocalData, 1, 0, 1, 0)).eq("equipo", localOficial));
        promesas.push(supabase.from("pronosticos_equipos").update(calcularNuevosStats(equipoVisitaData, 1, 0, 1, 0)).eq("equipo", visitaOficial));
      }
      */

      await Promise.all(promesas);
      alert(`✅ Resultado validado. ${acerto ? '🎯 ¡El sistema ACERTÓ!' : '❌ El sistema FALLÓ.'}\n\nRecuerda ir a "Recalcular Ratings" para actualizar las formas con estos nuevos datos.`);
      cargarPartidos();
    } catch (error) {
      console.error(error);
      alert("Error al validar: " + error.message);
    } finally {
      setValidando(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">⚽ Administración de Partidos y Pronósticos</h1>

      {/* Tabs de navegación */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setTabActiva("pendientes")}
          className={`pb-2 px-4 font-semibold transition ${tabActiva === "pendientes" ? "border-b-4 border-blue-600 text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
        >
          ✅ Por Validar ({partidosPendientes.length})
        </button>
        <button
          onClick={() => setTabActiva("proximos")}
          className={`pb-2 px-4 font-semibold transition ${tabActiva === "proximos" ? "border-b-4 border-blue-600 text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
        >
          🔮 Próximos Partidos ({partidosProximos.length})
        </button>
      </div>

      {/* SECCIÓN: PARTIDOS POR VALIDAR */}
      {tabActiva === "pendientes" && (
        <div className="bg-white shadow rounded p-5">
          {partidosPendientes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">🎉 No hay partidos pendientes de validar. ¡Todo al día!</div>
          ) : (
            <div className="space-y-4">
              {partidosPendientes.map((partido) => (
                <ValidarMatchCard key={partido.id} partido={partido} onValidar={validarResultado} validando={validando} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN: PRÓXIMOS PARTIDOS */}
      {tabActiva === "proximos" && (
        <div className="bg-white shadow rounded p-5">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-bold">Partidos Registrados (Próximos)</h2>
            <button
              onClick={generarPronosticos}
              disabled={generando || partidosProximos.length === 0}
              className={`px-4 py-2 rounded text-white font-semibold transition ${generando || partidosProximos.length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {generando ? "⏳ Generando..." : "🎯 Generar Pronósticos"}
            </button>
          </div>

          {partidosProximos.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border border-dashed border-gray-300">
              No hay partidos próximos registrados.
            </div>
          ) : (
            <div className="space-y-3">
              {partidosProximos.map((partido) => (
                <div key={partido.id} className="flex flex-col md:flex-row justify-between items-start md:items-center border rounded p-4 hover:bg-gray-50 transition">
                  <div className="mb-3 md:mb-0 flex-1">
                    <div className="text-lg font-bold text-gray-800">{partido.local} <span className="text-gray-400 mx-2">vs</span> {partido.visita}</div>
                    <div className="text-sm text-gray-500 mt-1">📅 {partido.fecha_partido} &nbsp;|&nbsp; 🏟️ Jornada {partido.jornada}</div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg text-sm min-w-[220px] border border-gray-200 mb-3 md:mb-0 md:mx-4">
                    {partido.pronostico ? (
                      <>
                        <div className="flex justify-between mb-1"><span>🏠 Local:</span><span className="font-semibold text-blue-700">{partido.prob_local}%</span></div>
                        <div className="flex justify-between mb-1"><span>🤝 Empate:</span><span className="font-semibold text-yellow-700">{partido.prob_empate}%</span></div>
                        <div className="flex justify-between mb-2"><span>✈️ Visita:</span><span className="font-semibold text-red-700">{partido.prob_visita}%</span></div>
                        <div className="border-t pt-2 mt-2 font-bold text-center text-white bg-blue-600 rounded">✅ {partido.pronostico}</div>
                      </>
                    ) : (
                      <div className="text-center text-gray-500 py-3">⏳ Pendiente de generar</div>
                    )}
                  </div>

                  <button onClick={() => eliminarPartido(partido.id)} className="bg-red-100 text-red-600 hover:bg-red-200 px-3 py-2 rounded text-sm font-semibold transition">🗑️ Eliminar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 🆕 Componente separado para la tarjeta de validación (mantiene el código limpio)
function ValidarMatchCard({ partido, onValidar, validando }) {
  const [resultado, setResultado] = useState("");
  const [golesLocal, setGolesLocal] = useState("");
  const [golesVisita, setGolesVisita] = useState("");

  return (
    <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <div className="text-lg font-bold text-gray-800">{partido.local} vs {partido.visita}</div>
          <div className="text-sm text-gray-600 mt-1">📅 {partido.fecha_partido} | Jornada {partido.jornada}</div>
          <div className="mt-2 inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
            🔮 Pronóstico del Sistema: {partido.pronostico} ({partido.prob_local}% / {partido.prob_empate}% / {partido.prob_visita}%)
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-end md:items-center bg-white p-3 rounded border border-yellow-300">
          <div className="flex flex-col">
            <label className="text-xs font-bold text-gray-600 mb-1">Resultado Real</label>
            <select 
              value={resultado} 
              onChange={(e) => setResultado(e.target.value)}
              className="border rounded px-2 py-1 text-sm font-semibold"
            >
              <option value="">Seleccionar...</option>
              <option value="LOCAL">🏠 Gana Local</option>
              <option value="EMPATE">🤝 Empate</option>
              <option value="VISITA">✈️ Gana Visita</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-600 mb-1">Goles Local</label>
              <input type="number" min="0" value={golesLocal} onChange={(e) => setGolesLocal(e.target.value)} className="border rounded px-2 py-1 w-16 text-center text-sm" />
            </div>
            <span className="font-bold text-gray-400 pt-4">-</span>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-600 mb-1">Goles Visita</label>
              <input type="number" min="0" value={golesVisita} onChange={(e) => setGolesVisita(e.target.value)} className="border rounded px-2 py-1 w-16 text-center text-sm" />
            </div>
          </div>

          <button
            onClick={() => onValidar(partido, resultado, golesLocal, golesVisita)}
            disabled={validando || !resultado || golesLocal === "" || golesVisita === ""}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {validando ? "Procesando..." : "✅ Validar y Actualizar"}
          </button>
        </div>
      </div>
    </div>
  );
}