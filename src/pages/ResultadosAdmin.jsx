import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function ResultadosAdmin() {
  const [partidos, setPartidos] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [jornadasPendientes, setJornadasPendientes] = useState([]);

  // 🆕 Estados para el modal de reasignación de jornada
  const [modalReasignar, setModalReasignar] = useState(false);
  const [partidoReasignar, setPartidoReasignar] = useState(null);
  const [nuevaJornadaId, setNuevaJornadaId] = useState("");

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

      if (error) return;

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
        .map((jornada) => ({
          ...jornada,
          partidosPendientes: pendientesPorJornada[jornada.id] || 0,
          partidosTotal: totalesPorJornada[jornada.id] || 0,
        }))
        .filter((j) => j.partidosPendientes > 0)
        .sort((a, b) => a.id - b.id);

      setJornadasPendientes(pendientes);
    } catch (error) {
      console.error("Error calculando jornadas pendientes:", error);
    }
  };

  const cargarPartidos = async (jornadaId) => {
    if (!jornadaId) return;

    // ✅ Agregamos 'jornada_original' para saber de dónde vino el partido
    const { data, error } = await supabase
      .from("partidos")
      .select("id, jornada_id, jornada_original, local, visitante, resultado, pospuesto, reactivado")
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

  const togglePospuesto = async (partido) => {
    const nuevoEstado = !partido.pospuesto;
    const updates = { 
      pospuesto: nuevoEstado, 
      reactivado: false,
      // Si se marca como pospuesto, guardamos su jornada original si no la tiene
      jornada_original: partido.jornada_original || partido.jornada_id 
    };

    const { error } = await supabase.from("partidos").update(updates).eq("id", partido.id);
    if (error) alert("Error: " + error.message);
    else await cargarPartidos(partido.jornada_id);
  };

  // 🆕 Abrir modal para elegir la nueva jornada
  const solicitarReasignacion = (partido) => {
    setPartidoReasignar(partido);
    const jornadaActiva = jornadas.find((j) => j.activa);
    setNuevaJornadaId(jornadaActiva ? jornadaActiva.id : "");
    setModalReasignar(true);
  };

  // 🆕 Confirmar el movimiento del partido a la nueva jornada
  const confirmarReasignacion = async () => {
    if (!nuevaJornadaId) {
      alert("Debes seleccionar una jornada.");
      return;
    }

    const { error } = await supabase
      .from("partidos")
      .update({
        jornada_id: Number(nuevaJornadaId), // 🚀 CAMBIO CLAVE: Se mueve a la nueva jornada
        reactivado: true,
        pospuesto: false,
        jornada_original: partidoReasignar.jornada_original || partidoReasignar.jornada_id
      })
      .eq("id", partidoReasignar.id);

    if (error) {
      alert("Error al actualizar: " + error.message);
    } else {
      alert(`✅ Partido movido a la Jornada ${nuevaJornadaId}. Los usuarios podrán editarlo hasta el cierre de esta jornada.`);
      setModalReasignar(false);
      // Recargamos la jornada donde estaba originalmente para que desaparezca de esta vista
      await cargarPartidos(partidoReasignar.jornada_id); 
      await calcularJornadasPendientes(jornadas);
    }
  };

  // 🆕 Revertir el cambio (devolverlo a su jornada original y marcarlo como pospuesto)
  const cancelarReasignacion = async (partido) => {
    if (!window.confirm("¿Devolver este partido a su jornada original y marcarlo como pospuesto?")) return;
    
    const jornadaOriginal = partido.jornada_original || partido.jornada_id;

    const { error } = await supabase
      .from("partidos")
      .update({
        jornada_id: jornadaOriginal,
        reactivado: false,
        pospuesto: true
      })
      .eq("id", partido.id);

    if (error) alert("Error: " + error.message);
    else {
      await cargarPartidos(partido.jornada_id);
      await calcularJornadasPendientes(jornadas);
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
      await cargarPartidos(jornadaSeleccionada);
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
              setJornadaSeleccionada(e.target.value);
              cargarPartidos(e.target.value);
            }}
            className="border px-3 py-2 rounded"
          >
            {jornadas.map((jornada) => {
              const pendiente = jornadasPendientes.find((jp) => jp.id === jornada.id);
              return (
                <option key={jornada.id} value={jornada.id}>
                  {jornada.nombre} {jornada.activa ? " (Activa)" : ""}
                  {pendiente?.partidosPendientes > 0 ? ` ⚠️ ${pendiente.partidosPendientes} pendiente(s)` : " ✅"}
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
              <h3 className="font-bold text-yellow-800 mb-2">Jornadas con resultados pendientes:</h3>
              <div className="flex flex-wrap gap-2">
                {jornadasPendientes.map((jp) => (
                  <button
                    key={jp.id}
                    onClick={() => { setJornadaSeleccionada(jp.id); cargarPartidos(jp.id); }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                      jp.id === jornadaSeleccionada ? "bg-yellow-600 text-white" : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300"
                    }`}
                  >
                    <span>{jp.nombre}</span>
                    <span className="bg-white text-yellow-800 px-2 py-0.5 rounded-full text-xs font-bold">
                      {jp.partidosPendientes}/{jp.partidosTotal}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6 rounded shadow-sm">
          <div className="flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div>
              <h3 className="font-bold text-green-800">¡Todas las jornadas tienen sus resultados capturados!</h3>
            </div>
          </div>
        </div>
      )}

      {partidos.length === 0 ? (
        <div className="text-center text-gray-500 mt-10">No existen partidos para esta jornada.</div>
      ) : (
        partidos.map((partido) => {
          const esPospuesto = partido.pospuesto && !partido.reactivado;
          const esReactivado = partido.reactivado;
          const tieneResultado = !!partido.resultado;

          return (
            <div
              key={partido.id}
              className={`border rounded p-4 mb-4 transition-all ${
                esPospuesto ? "bg-orange-50 border-orange-300" 
                : esReactivado ? "bg-green-50 border-green-400 border-2" 
                : tieneResultado ? "bg-blue-50 border-blue-200" 
                : "bg-white"
              }`}
            >
              <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold text-lg">{partido.local} vs {partido.visitante}</h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {esPospuesto && (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-bold">⏸️ POSPUESTO</span>
                    )}
                    {esReactivado && !tieneResultado && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold animate-pulse">
                        ✅ REACTIVADO (Movido a J{partido.jornada_id})
                      </span>
                    )}
                    {tieneResultado && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">🔒 RESULTADO CAPTURADO</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => togglePospuesto(partido)}
                    disabled={tieneResultado}
                    className={`text-xs px-3 py-1.5 rounded border font-semibold transition ${
                      tieneResultado ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      : esPospuesto ? "bg-gray-200 text-gray-700 border-gray-300"
                      : "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                    }`}
                  >
                    {esPospuesto ? "Quitar Pospuesto" : "Marcar Pospuesto"}
                  </button>
                  
                  {esReactivado ? (
                    <button
                      onClick={() => cancelarReasignacion(partido)}
                      disabled={tieneResultado}
                      className="text-xs px-3 py-1.5 rounded border font-semibold transition bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300"
                    >
                      Devolver a J. Original
                    </button>
                  ) : (
                    <button
                      onClick={() => solicitarReasignacion(partido)}
                      disabled={tieneResultado}
                      className={`text-xs px-3 py-1.5 rounded border font-semibold transition ${
                        tieneResultado ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                      }`}
                    >
                      Reactivar y Mover
                    </button>
                  )}
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

      {/* 🆕 MODAL PARA REASIGNAR JORNADA */}
      {modalReasignar && partidoReasignar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-2 text-gray-800">
              Reasignar Partido
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{partidoReasignar.local} vs {partidoReasignar.visitante}</strong>
              <br />
              Selecciona la jornada activa a la que se moverá este partido. Los usuarios podrán editar su pronóstico hasta el cierre de esa jornada.
            </p>
            
            <label className="block text-sm font-medium text-gray-700 mb-1">Mover a la Jornada:</label>
            <select
              value={nuevaJornadaId}
              onChange={(e) => setNuevaJornadaId(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 mb-6 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Selecciona una jornada...</option>
              {jornadas.filter(j => j.activa).map(j => (
                <option key={j.id} value={j.id}>{j.nombre} (Activa)</option>
              ))}
            </select>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setModalReasignar(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarReasignacion}
                className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 transition font-semibold"
              >
                Confirmar Movimiento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}