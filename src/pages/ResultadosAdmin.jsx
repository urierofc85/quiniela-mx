import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function ResultadosAdmin() {
  const [partidos, setPartidos] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [jornadasPendientes, setJornadasPendientes] = useState([]);

  useEffect(() => {
    cargarJornadas();
  }, []);

  const cargarJornadas = async () => {
    const { data, error } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const jornadasData = data || [];
    setJornadas(jornadasData);
    await calcularJornadasPendientes(jornadasData);

    const activa = jornadasData.find((jornada) => jornada.activa);
    if (activa) {
      setJornadaSeleccionada(activa.id);
      await cargarPartidos(activa.id);
    }
  };

  const calcularJornadasPendientes = async (jornadasData) => {
    try {
      const { data: todosPartidos, error } = await supabase
        .from("partidos")
        .select("id, jornada_id, resultado");

      if (error) {
        console.error("Error calculando jornadas pendientes:", error);
        return;
      }

      const pendientesPorJornada = {};
      const totalesPorJornada = {};

      todosPartidos.forEach((partido) => {
        const jId = partido.jornada_id;
        totalesPorJornada[jId] = (totalesPorJornada[jId] || 0) + 1;
        
        if (!partido.resultado || partido.resultado === "") {
          pendientesPorJornada[jId] = (pendientesPorJornada[jId] || 0) + 1;
        }
      });

      const pendientes = jornadasData
        .map((jornada) => {
          const pendientes = pendientesPorJornada[jornada.id] || 0;
          const total = totalesPorJornada[jornada.id] || 0;
          return {
            ...jornada,
            partidosPendientes: pendientes,
            partidosTotal: total,
          };
        })
        .filter((j) => j.partidosPendientes > 0)
        .sort((a, b) => a.id - b.id);

      setJornadasPendientes(pendientes);
    } catch (error) {
      console.error("Error calculando jornadas pendientes:", error);
    }
  };

  const cargarPartidos = async (jornadaId) => {
    if (!jornadaId) return;

    // ✅ Agregamos 'pospuesto' y 'reactivado' a la consulta
    const { data, error } = await supabase
      .from("partidos")
      .select("id, jornada_id, local, visitante, resultado, pospuesto, reactivado")
      .eq("jornada_id", jornadaId)
      .order("id");

    if (error) {
      console.error(error);
      return;
    }

    setPartidos(data || []);
  };

  const actualizarResultadoLocal = (id, resultado) => {
    setPartidos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, resultado } : p))
    );
  };

  // ✅ NUEVA FUNCIÓN: Cambiar estado de pospuesto
  const togglePospuesto = async (partido) => {
    const nuevoEstado = !partido.pospuesto;
    const updates = { pospuesto: nuevoEstado };
    
    // Si se marca como pospuesto, quitamos lo de reactivado
    if (nuevoEstado) updates.reactivado = false;

    const { error } = await supabase
      .from("partidos")
      .update(updates)
      .eq("id", partido.id);

    if (error) {
      alert("Error al actualizar: " + error.message);
    } else {
      await cargarPartidos(partido.jornada_id);
    }
  };

  // ✅ NUEVA FUNCIÓN: Cambiar estado de reactivado
  const toggleReactivado = async (partido) => {
    const nuevoEstado = !partido.reactivado;
    const updates = { reactivado: nuevoEstado };
    
    // Si se reactiva, automáticamente se quita lo de "pospuesto"
    if (nuevoEstado) updates.pospuesto = false;

    const { error } = await supabase
      .from("partidos")
      .update(updates)
      .eq("id", partido.id);

    if (error) {
      alert("Error al actualizar: " + error.message);
    } else {
      await cargarPartidos(partido.jornada_id);
      alert(nuevoEstado 
        ? "✅ Partido reactivado. Los usuarios ahora pueden modificar su pronóstico." 
        : "↩️ Partido desmarcado y vuelto a estado normal."
      );
    }
  };

  const guardarResultados = async () => {
    setGuardando(true);

    try {
      for (const partido of partidos) {
        const { error } = await supabase
          .from("partidos")
          .update({ resultado: partido.resultado })
          .eq("id", partido.id);

        if (error) throw error;
      }

      alert("Resultados guardados correctamente");
      await calcularJornadasPendientes(jornadas);
      await cargarPartidos(jornadaSeleccionada); // Recargar para actualizar estados visuales
    } catch (error) {
      alert(error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Captura de Resultados y Estados</h1>

        <div className="flex gap-3">
          <select
            value={jornadaSeleccionada}
            onChange={(e) => {
              const jornadaId = e.target.value;
              setJornadaSeleccionada(jornadaId);
              cargarPartidos(jornadaId);
            }}
            className="border px-3 py-2 rounded"
          >
            {jornadas.map((jornada) => {
              const pendiente = jornadasPendientes.find((jp) => jp.id === jornada.id);
              const numPendientes = pendiente?.partidosPendientes || 0;

              return (
                <option key={jornada.id} value={jornada.id}>
                  {jornada.nombre}
                  {jornada.activa ? " (Activa)" : ""}
                  {numPendientes > 0 ? ` ⚠️ ${numPendientes} pendiente(s)` : " ✅"}
                </option>
              );
            })}
          </select>

          <button
            onClick={guardarResultados}
            disabled={guardando}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {guardando ? "Guardando..." : "Guardar Resultados"}
          </button>
        </div>
      </div>

      {jornadasPendientes.length > 0 ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded shadow-sm">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <h3 className="font-bold text-yellow-800 mb-2">
                Jornadas con resultados pendientes de capturar:
              </h3>
              <div className="flex flex-wrap gap-2">
                {jornadasPendientes.map((jp) => (
                  <button
                    key={jp.id}
                    onClick={() => {
                      setJornadaSeleccionada(jp.id);
                      cargarPartidos(jp.id);
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                      jp.id === jornadaSeleccionada
                        ? "bg-yellow-600 text-white"
                        : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300"
                    }`}
                  >
                    <span>{jp.nombre}</span>
                    <span className="bg-white text-yellow-800 px-2 py-0.5 rounded-full text-xs font-bold">
                      {jp.partidosPendientes}/{jp.partidosTotal}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                💡 Haz clic en una jornada para ir directamente a capturar sus resultados.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6 rounded shadow-sm">
          <div className="flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div>
              <h3 className="font-bold text-green-800">
                ¡Todas las jornadas tienen sus resultados capturados!
              </h3>
              <p className="text-sm text-green-700">No hay resultados pendientes.</p>
            </div>
          </div>
        </div>
      )}

      {partidos.length === 0 ? (
        <div className="text-center text-gray-500 mt-10">
          No existen partidos para esta jornada.
        </div>
      ) : (
        partidos.map((partido) => {
          const esPospuesto = partido.pospuesto && !partido.reactivado;
          const esReactivado = partido.reactivado;

          return (
            <div
              key={partido.id}
              className={`border rounded p-4 mb-4 transition-all ${
                esPospuesto 
                  ? "bg-orange-50 border-orange-300" 
                  : esReactivado 
                    ? "bg-green-50 border-green-400 border-2" 
                    : partido.resultado 
                      ? "bg-green-50 border-green-200" 
                      : "bg-white"
              }`}
            >
              <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold text-lg">
                    {partido.local} vs {partido.visitante}
                  </h3>
                  <div className="flex gap-2 mt-1">
                    {esPospuesto && (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-bold">
                        ⏸️ POSPUESTO
                      </span>
                    )}
                    {esReactivado && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold animate-pulse">
                        ✅ REACTIVADO PARA EDICIÓN
                      </span>
                    )}
                  </div>
                </div>

                {/* ✅ BOTONES DE GESTIÓN DE ESTADO DEL PARTIDO */}
                <div className="flex gap-2">
                  <button
                    onClick={() => togglePospuesto(partido)}
                    className={`text-xs px-3 py-1.5 rounded border font-semibold transition ${
                      esPospuesto
                        ? "bg-gray-200 text-gray-700 border-gray-300"
                        : "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                    }`}
                  >
                    {esPospuesto ? "Quitar Pospuesto" : "Marcar Pospuesto"}
                  </button>
                  
                  <button
                    onClick={() => toggleReactivado(partido)}
                    className={`text-xs px-3 py-1.5 rounded border font-semibold transition ${
                      esReactivado
                        ? "bg-gray-200 text-gray-700 border-gray-300"
                        : "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                    }`}
                  >
                    {esReactivado ? "Desmarcar" : "Reactivar"}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <label className="font-medium text-gray-700">Resultado Real:</label>
                <select
                  value={partido.resultado || ""}
                  className="border p-2 rounded w-48"
                  onChange={(e) => actualizarResultadoLocal(partido.id, e.target.value)}
                >
                  <option value="">Seleccionar resultado</option>
                  <option value="L">Gana Local (L)</option>
                  <option value="E">Empate (E)</option>
                  <option value="V">Gana Visitante (V)</option>
                </select>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}