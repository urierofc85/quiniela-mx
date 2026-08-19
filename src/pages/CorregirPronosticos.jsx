import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function CorregirPronosticos() {
  const [usuarios, setUsuarios] = useState([]);
  const [jornadas, setJornadas] = useState([]);

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");

  const [pronosticos, setPronosticos] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const [survivorId, setSurvivorId] = useState(null);
  const [equipoSurvivor, setEquipoSurvivor] = useState("");
  const [equiposDisponibles, setEquiposDisponibles] = useState([]);

  useEffect(() => {
    cargarUsuarios();
    cargarJornadas();
  }, []);

  const cargarUsuarios = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("nombre_usuario");

    if (error) {
      console.error(error);
      return;
    }

    setUsuarios(data || []);
  };

  const cargarJornadas = async () => {
    const { data, error } = await supabase
      .from("jornadas")
      .select("*")
      .order("id");

    if (error) {
      console.error(error);
      return;
    }

    setJornadas(data || []);
  };

  const cargarPronosticos = async (usuarioId, jornadaId) => {
    try {
      if (!usuarioId || !jornadaId) return;

      console.log("🔄 Cargando pronósticos para usuario:", usuarioId, "jornada:", jornadaId);

      const { data: partidos, error: errorPartidos } = await supabase
        .from("partidos")
        .select("*")
        .eq("jornada_id", jornadaId)
        .order("id");

      if (errorPartidos) throw errorPartidos;

      const { data: quinielas, error: errorQuinielas } = await supabase
        .from("quinielas")
        .select("*")
        .eq("usuario_id", usuarioId)
        .eq("jornada_id", jornadaId);

      if (errorQuinielas) throw errorQuinielas;

      console.log("📊 Quinielas encontradas:", quinielas?.length || 0);

      const { data: survivorRows, error: survivorError } = await supabase
        .from("survivor")
        .select("*")
        .eq("usuario_id", usuarioId)
        .eq("jornada_id", jornadaId);

      if (survivorError) throw survivorError;

      const survivorData = survivorRows && survivorRows.length > 0 ? survivorRows[0] : null;

      const equipos = [];
      partidos.forEach((p) => {
        if (p.local && !equipos.includes(p.local)) equipos.push(p.local);
        if (p.visitante && !equipos.includes(p.visitante)) equipos.push(p.visitante);
      });

      setEquiposDisponibles(equipos.sort());

      if (survivorData) {
        setSurvivorId(survivorData.id);
        setEquipoSurvivor(survivorData.equipo);
      } else {
        setSurvivorId(null);
        setEquipoSurvivor("");
      }

      const resultado = partidos.map((partido) => {
        const quiniela = quinielas?.find(
          (q) => Number(q.partido_id) === Number(partido.id)
        );

        return {
          id: quiniela?.id || null,
          partido_id: partido.id,
          local: partido.local,
          visitante: partido.visitante,
          pronostico: quiniela?.pronostico || "",
        };
      });

      console.log("✅ Pronósticos cargados:", resultado.length);
      setPronosticos(resultado);
    } catch (error) {
      console.error(" Error cargando pronósticos:", error);
      alert(error.message);
    }
  };

  const actualizarPronostico = (partidoId, nuevoValor) => {
    setPronosticos((prev) =>
      prev.map((item) =>
        item.partido_id === partidoId
          ? { ...item, pronostico: nuevoValor }
          : item
      )
    );
  };

  const guardarCambios = async () => {
    try {
      setGuardando(true);
      console.log("💾 Iniciando guardado...");

      const usuarioObj = usuarios.find(
        (u) => String(u.id) === String(usuarioSeleccionado)
      );

      let cambiosRealizados = 0;
      let eliminacionesRealizadas = 0;

      // ==========================================
      // 1. PROCESAR QUINIELA
      // ==========================================
      for (const item of pronosticos) {
        if (item.id) {
          // Si ya existía en la base de datos
          const pronósticoLimpio = (item.pronostico || "").trim();
          
          if (!pronósticoLimpio) {
            // Si se cambió a vacío, LO BORRAMOS
            console.log("🗑️ Eliminando quiniela ID:", item.id, "Partido:", item.partido_id);
            const { error } = await supabase
              .from("quinielas")
              .delete()
              .eq("id", item.id);
            
            if (error) {
              console.error(" Error al eliminar:", error);
              throw error;
            }
            eliminacionesRealizadas++;
          } else {
            // Si tiene un valor, lo actualizamos
            console.log("✏️ Actualizando quiniela ID:", item.id, "a:", pronósticoLimpio);
            const { error } = await supabase
              .from("quinielas")
              .update({ pronostico: pronósticoLimpio })
              .eq("id", item.id);
            
            if (error) throw error;
            cambiosRealizados++;
          }
        } else if (item.pronostico && item.pronostico.trim()) {
          // Si no existía pero ahora se le asignó un valor, lo insertamos
          console.log("➕ Insertando nueva quiniela para partido:", item.partido_id);
          const { error } = await supabase
            .from("quinielas")
            .insert({
              usuario_id: usuarioSeleccionado,
              usuario: usuarioObj?.email || "",
              jornada_id: Number(jornadaSeleccionada),
              partido_id: item.partido_id,
              pronostico: item.pronostico.trim(),
            });
          
          if (error) throw error;
          cambiosRealizados++;
        }
      }

      // ==========================================
      // 2. PROCESAR SURVIVOR
      // ==========================================
      if (survivorId) {
        const equipoLimpio = (equipoSurvivor || "").trim();
        
        if (!equipoLimpio) {
          // Si se cambió a vacío, borramos el survivor
          console.log("🗑️ Eliminando survivor ID:", survivorId);
          const { error } = await supabase
            .from("survivor")
            .delete()
            .eq("id", survivorId);
          
          if (error) throw error;
          eliminacionesRealizadas++;
        } else {
          // Si tiene valor, actualizamos
          console.log("✏️ Actualizando survivor ID:", survivorId, "a:", equipoLimpio);
          const { error } = await supabase
            .from("survivor")
            .update({ equipo: equipoLimpio })
            .eq("id", survivorId);
          
          if (error) throw error;
          cambiosRealizados++;
        }
      } else if (equipoSurvivor && equipoSurvivor.trim()) {
        // Si no existía pero ahora se le asignó un valor, lo insertamos
        console.log("➕ Insertando nuevo survivor:", equipoSurvivor);
        const { error } = await supabase
          .from("survivor")
          .insert({
            usuario_id: usuarioSeleccionado,
            usuario: usuarioObj?.email || "",
            jornada_id: Number(jornadaSeleccionada),
            equipo: equipoSurvivor.trim(),
          });
        
        if (error) throw error;
        cambiosRealizados++;
      }

      console.log("✅ Guardado completado. Cambios:", cambiosRealizados, "Eliminaciones:", eliminacionesRealizadas);

      // Forzar recarga completa
      await new Promise(resolve => setTimeout(resolve, 300));
      await cargarPronosticos(usuarioSeleccionado, jornadaSeleccionada);
      
      alert(`Guardado correctamente.\nCambios: ${cambiosRealizados}\nEliminaciones: ${eliminacionesRealizadas}`);
      
    } catch (error) {
      console.error("❌ Error al guardar:", error);
      alert("Error al guardar: " + error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Corrección de Pronósticos</h1>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <select
          className="border p-2 rounded w-full"
          value={usuarioSeleccionado}
          onChange={(e) => {
            const usuario = e.target.value;
            setUsuarioSeleccionado(usuario);
            if (jornadaSeleccionada) {
              cargarPronosticos(usuario, jornadaSeleccionada);
            }
          }}
        >
          <option value="">Selecciona un usuario</option>
          {usuarios.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.nombre_usuario || usuario.nombre || usuario.nombre_completo || usuario.email}
            </option>
          ))}
        </select>

        <select
          className="border p-2 rounded w-full"
          value={jornadaSeleccionada}
          onChange={(e) => {
            const jornada = e.target.value;
            setJornadaSeleccionada(jornada);
            if (usuarioSeleccionado) {
              cargarPronosticos(usuarioSeleccionado, jornada);
            }
          }}
        >
          <option value="">Selecciona una jornada</option>
          {jornadas.map((jornada) => (
            <option key={jornada.id} value={jornada.id}>
              {jornada.nombre}
            </option>
          ))}
        </select>
      </div>

      {usuarioSeleccionado && jornadaSeleccionada && pronosticos.every((p) => !p.id) && (
        <div className="bg-yellow-100 border border-yellow-300 rounded p-4 mb-4 text-yellow-800">
          Este usuario no tiene quiniela registrada para esta jornada. Puedes capturarla manualmente o dejarla vacía si solo juega Survivor.
        </div>
      )}

      {pronosticos.length > 0 && (
        <>
          <table className="w-full border-collapse border mb-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Local</th>
                <th className="border p-2 text-left">Visitante</th>
                <th className="border p-2 text-center">Pronóstico</th>
              </tr>
            </thead>
            <tbody>
              {pronosticos.map((partido) => (
                <tr key={partido.partido_id}>
                  <td className="border p-2">{partido.local}</td>
                  <td className="border p-2">{partido.visitante}</td>
                  <td className="border p-2 text-center">
                    <select
                      className="border rounded p-2 w-full max-w-xs"
                      value={partido.pronostico}
                      onChange={(e) =>
                        actualizarPronostico(partido.partido_id, e.target.value)
                      }
                    >
                      <option value="">-- Seleccionar (Borrar) --</option>
                      <option value="L">Gana Local (L)</option>
                      <option value="E">Empate (E)</option>
                      <option value="V">Gana Visitante (V)</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 border rounded p-4 bg-gray-50">
            <h2 className="text-xl font-bold mb-3">Survivor</h2>
            <div className="mb-3 text-green-700 font-semibold">
              Survivor actual: {equipoSurvivor || "Sin selección"}
            </div>
            <select
              className="border p-2 rounded w-full max-w-xs"
              value={equipoSurvivor}
              onChange={(e) => setEquipoSurvivor(e.target.value)}
            >
              <option value="">-- Seleccionar (Borrar) --</option>
              {equiposDisponibles.map((equipo) => (
                <option key={equipo} value={equipo}>
                  {equipo}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={guardarCambios}
            disabled={guardando}
            className="mt-6 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-semibold transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {guardando ? "Guardando..." : "Guardar Cambios"}
          </button>
        </>
      )}
    </div>
  );
}