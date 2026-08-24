import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminPronosticosPartidos() {
  const [partidosProximos, setPartidosProximos] = useState([]);
  const [partidosPendientes, setPartidosPendientes] = useState([]);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [tabActiva, setTabActiva] = useState("pendientes");
  
  // Estado para almacenar los inputs de cada partido pendiente: { [id]: { resultado, golesLocal, golesVisita } }
  const [inputsResultados, setInputsResultados] = useState({});

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
    const proximos = [];
    const pendientes = [];
    const nuevosInputs = {};

    (data || []).forEach((p) => {
      const fechaPartido = p.fecha_partido ? String(p.fecha_partido).split("T")[0] : "";
      if (fechaPartido >= hoyStr) {
        proximos.push(p);
      } else {
        if (!p.resultado_real) {
          pendientes.push(p);
          // Inicializar estado vacío para este partido
          nuevosInputs[p.id] = { resultado: "", golesLocal: "", golesVisita: "" };
        }
      }
    });

    setPartidosProximos(proximos);
    setPartidosPendientes(pendientes);
    setInputsResultados(nuevosInputs);
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

        const scoreLocal = Number(localEquipo.rating_general || 0) * 0.25 + Number(localEquipo.rating_forma || 0) * 0.25 + Number(localEquipo.rating_ofensivo || 0) * 0.15 + Number(localEquipo.rating_defensivo || 0) * 0.15 + Number(localEquipo.rating_local || 0) * 0.10 + Number(localEquipo.rating_tendencia || 0) * 0.10;
        const scoreVisita = Number(visitaEquipo.rating_general || 0) * 0.25 + Number(visitaEquipo.rating_forma || 0) * 0.25 + Number(visitaEquipo.rating_ofensivo || 0) * 0.15 + Number(visitaEquipo.rating_defensivo || 0) * 0.15 + Number(visitaEquipo.rating_visitante || 0) * 0.10 + Number(visitaEquipo.rating_tendencia || 0) * 0.10;

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
            score_local: Number(scoreLocal.toFixed(2)), score_visita: Number(scoreVisita.toFixed(2)),
            diferencia: Number(diferencia.toFixed(2)), prob_local: probLocal, prob_empate: probEmpate,
            prob_visita: probVisita, pronostico: pronostico,
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

  // 🆕 Manejador de cambios en los inputs de la tabla
  const handleInputChange = (partidoId, campo, valor) => {
    setInputsResultados(prev => ({
      ...prev,
      [partidoId]: { ...prev[partidoId], [campo]: valor }
    }));
  };

  // 🆕 FUNCIÓN CLAVE: Guardar y actualizar todo en un solo paso
  const guardarYActualizarTodo = async () => {
    // 1. Validar que todos los campos estén llenos
    const camposIncompletos = partidosPendientes.some(p => {
      const input = inputsResultados[p.id];
      return !input.resultado || input.golesLocal === "" || input.golesVisita === "";
    });

    if (camposIncompletos) {
      alert("⚠️ Por favor, completa el Resultado Real y los Goles de TODOS los partidos pendientes antes de guardar.");
      return;
    }

    if (!window.confirm(`¿Estás seguro de guardar los resultados de ${partidosPendientes.length} partidos? Esto actualizará las estadísticas de los equipos.`)) {
      return;
    }

    try {
      setGuardando(true);

      // 2. Obtener datos actuales de los equipos para calcular las nuevas estadísticas
      const { data: equiposData } = await supabase.from("pronosticos_equipos").select("*");
      const mapaEquipos = new Map(equiposData.map(e => [e.equipo.toLowerCase(), e]));
      const alias = { guadalajara: "chivas", "tigres uanl": "tigres", "cruz azul": "cruzazul" };

      const promesasPartidos = [];
      const cambiosEquipos = {}; // Acumulador de cambios: { "nombre_equipo": { partidos: +1, puntos: +3, ... } }

      const normalizar = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

      // 3. Procesar cada partido pendiente
      for (const partido of partidosPendientes) {
        const input = inputsResultados[partido.id];
        const resultadoReal = input.resultado;
        const golesLocal = Number(input.golesLocal);
        const golesVisita = Number(input.golesVisita);
        const acerto = partido.pronostico === resultadoReal;

        // A. Preparar update del partido (Esto garantiza UPDATE, no INSERT duplicado)
        promesasPartidos.push(
          supabase.from("pronosticos_partidos").update({
            resultado_real: resultadoReal,
            goles_local_real: golesLocal,
            goles_visita_real: golesVisita,
            acerto: acerto,
          }).eq("id", partido.id)
        );

        // B. Calcular cambios para el equipo Local
        const nombreLocal = mapaEquipos.get(alias[normalizar(partido.local)] || normalizar(partido.local))?.equipo || partido.local;
        if (!cambiosEquipos[nombreLocal]) cambiosEquipos[nombreLocal] = { partidos: 0, victorias: 0, empates: 0, derrotas: 0, puntos: 0, puntos_ultimos5: 0, goles_favor: 0, goles_contra: 0 };
        
        cambiosEquipos[nombreLocal].partidos += 1;
        cambiosEquipos[nombreLocal].goles_favor += golesLocal;
        cambiosEquipos[nombreLocal].goles_contra += golesVisita;

        if (resultadoReal === "LOCAL") {
          cambiosEquipos[nombreLocal].victorias += 1;
          cambiosEquipos[nombreLocal].puntos += 3;
          cambiosEquipos[nombreLocal].puntos_ultimos5 += 3;
        } else if (resultadoReal === "EMPATE") {
          cambiosEquipos[nombreLocal].empates += 1;
          cambiosEquipos[nombreLocal].puntos += 1;
          cambiosEquipos[nombreLocal].puntos_ultimos5 += 1;
        } else {
          cambiosEquipos[nombreLocal].derrotas += 1;
        }

        // C. Calcular cambios para el equipo Visita
        const nombreVisita = mapaEquipos.get(alias[normalizar(partido.visita)] || normalizar(partido.visita))?.equipo || partido.visita;
        if (!cambiosEquipos[nombreVisita]) cambiosEquipos[nombreVisita] = { partidos: 0, victorias: 0, empates: 0, derrotas: 0, puntos: 0, puntos_ultimos5: 0, goles_favor: 0, goles_contra: 0 };
        
        cambiosEquipos[nombreVisita].partidos += 1;
        cambiosEquipos[nombreVisita].goles_favor += golesVisita;
        cambiosEquipos[nombreVisita].goles_contra += golesLocal;

        if (resultadoReal === "VISITA") {
          cambiosEquipos[nombreVisita].victorias += 1;
          cambiosEquipos[nombreVisita].puntos += 3;
          cambiosEquipos[nombreVisita].puntos_ultimos5 += 3;
        } else if (resultadoReal === "EMPATE") {
          cambiosEquipos[nombreVisita].empates += 1;
          cambiosEquipos[nombreVisita].puntos += 1;
          cambiosEquipos[nombreVisita].puntos_ultimos5 += 1;
        } else {
          cambiosEquipos[nombreVisita].derrotas += 1;
        }
      }

      // 4. Preparar updates de los equipos con los cambios acumulados
      const promesasEquipos = [];
      for (const [nombreEquipo, cambios] of Object.entries(cambiosEquipos)) {
        const equipoActual = equiposData.find(e => e.equipo === nombreEquipo);
        if (!equipoActual) continue;

        promesasEquipos.push(
          supabase.from("pronosticos_equipos").update({
            partidos: (equipoActual.partidos || 0) + cambios.partidos,
            victorias: (equipoActual.victorias || 0) + cambios.victorias,
            empates: (equipoActual.empates || 0) + cambios.empates,
            derrotas: (equipoActual.derrotas || 0) + cambios.derrotas,
            puntos: (equipoActual.puntos || 0) + cambios.puntos,
            puntos_ultimos5: Math.min((equipoActual.puntos_ultimos5 || 0) + cambios.puntos_ultimos5, 15), // Tope de 15 puntos (5 victorias)
            goles_favor: (equipoActual.goles_favor || 0) + cambios.goles_favor,
            goles_contra: (equipoActual.goles_contra || 0) + cambios.goles_contra,
            diferencia_goles: ((equipoActual.goles_favor || 0) + cambios.goles_favor) - ((equipoActual.goles_contra || 0) + cambios.goles_contra),
            ultima_actualizacion: new Date().toISOString()
          }).eq("equipo", nombreEquipo)
        );
      }

      // 5. Ejecutar TODO en paralelo
      await Promise.all([...promesasPartidos, ...promesasEquipos]);

      const aciertos = partidosPendientes.filter(p => inputsResultados[p.id].resultado === p.pronostico).length;
      alert(`✅ ¡Guardado exitoso!\n\n📊 Partidos procesados: ${partidosPendientes.length}\n🎯 Aciertos del sistema: ${aciertos}\n❌ Fallos del sistema: ${partidosPendientes.length - aciertos}\n\n💡 Recuerda ir a "Recalcular Ratings" para que las nuevas formas surtan efecto en los próximos pronósticos.`);
      
      // Limpiar y recargar
      setInputsResultados({});
      cargarPartidos();
    } catch (error) {
      console.error("💥 Error al guardar:", error);
      alert("Error crítico al guardar: " + error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
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

      {/* SECCIÓN: PARTIDOS POR VALIDAR (VISTA MASIVA) */}
      {tabActiva === "pendientes" && (
        <div className="bg-white shadow rounded p-6">
          {partidosPendientes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-lg font-semibold">No hay partidos pendientes de validar.</p>
              <p className="text-sm">¡Tu base de datos está completamente al día!</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 border">Fecha / Jornada</th>
                      <th className="px-4 py-3 border">Partido</th>
                      <th className="px-4 py-3 border text-center">Pronóstico Sistema</th>
                      <th className="px-4 py-3 border text-center">Resultado Real</th>
                      <th className="px-4 py-3 border text-center w-24">Goles Local</th>
                      <th className="px-4 py-3 border text-center w-24">Goles Visita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partidosPendientes.map((partido) => {
                      const input = inputsResultados[partido.id] || {};
                      return (
                        <tr key={partido.id} className="bg-white border-b hover:bg-gray-50">
                          <td className="px-4 py-3 border">
                            <div className="font-medium">{partido.fecha_partido?.split('T')[0]}</div>
                            <div className="text-xs text-gray-500">Jornada {partido.jornada}</div>
                          </td>
                          <td className="px-4 py-3 border font-semibold text-gray-800">
                            {partido.local} <span className="text-gray-400 mx-1">vs</span> {partido.visita}
                          </td>
                          <td className="px-4 py-3 border text-center">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                              partido.pronostico === 'LOCAL' ? 'bg-blue-100 text-blue-800' :
                              partido.pronostico === 'EMPATE' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {partido.pronostico}
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {partido.prob_local}% / {partido.prob_empate}% / {partido.prob_visita}%
                            </div>
                          </td>
                          <td className="px-4 py-3 border text-center">
                            <select
                              value={input.resultado || ""}
                              onChange={(e) => handleInputChange(partido.id, "resultado", e.target.value)}
                              className="block w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Seleccionar...</option>
                              <option value="LOCAL">🏠 Gana Local</option>
                              <option value="EMPATE">🤝 Empate</option>
                              <option value="VISITA">✈️ Gana Visita</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 border text-center">
                            <input
                              type="number"
                              min="0"
                              value={input.golesLocal || ""}
                              onChange={(e) => handleInputChange(partido.id, "golesLocal", e.target.value)}
                              className="block w-16 mx-auto px-2 py-1.5 text-sm text-center border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-3 border text-center">
                            <input
                              type="number"
                              min="0"
                              value={input.golesVisita || ""}
                              onChange={(e) => handleInputChange(partido.id, "golesVisita", e.target.value)}
                              className="block w-16 mx-auto px-2 py-1.5 text-sm text-center border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    if(window.confirm("¿Limpiar todos los campos ingresados?")) {
                      const vacios = {};
                      partidosPendientes.forEach(p => vacios[p.id] = { resultado: "", golesLocal: "", golesVisita: "" });
                      setInputsResultados(vacios);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Limpiar Campos
                </button>
                <button
                  onClick={guardarYActualizarTodo}
                  disabled={guardando}
                  className="px-6 py-2 text-sm font-bold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                >
                  {guardando ? (
                    <>⏳ Procesando...</>
                  ) : (
                    <>💾 Guardar y Actualizar Todo ({partidosPendientes.length})</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* SECCIÓN: PRÓXIMOS PARTIDOS (Sin cambios mayores, solo limpieza) */}
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