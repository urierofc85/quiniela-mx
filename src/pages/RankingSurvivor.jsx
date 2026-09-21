import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { obtenerHoraMexico } from "../services/horario";

export default function RankingSurvivor() {
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("general");
  const [ranking, setRanking] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [horaMexico, setHoraMexico] = useState(null);

  const [rawSurvivor, setRawSurvivor] = useState([]);
  const [rawPerfiles, setRawPerfiles] = useState([]);
  const [rawPartidos, setRawPartidos] = useState([]);

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    if (rawPerfiles.length > 0 && jornadas.length > 0 && horaMexico) {
      calcularRanking();
    }
  }, [jornadaSeleccionada, rawSurvivor, rawPerfiles, rawPartidos, jornadas, horaMexico]);

  const cargarDatosIniciales = async () => {
    setCargando(true);
    try {
      const hora = await obtenerHoraMexico();
      setHoraMexico(hora);
    } catch (error) {
      console.error("Error obteniendo hora CDMX:", error);
    }

    const [jornadasData, perfilesData, partidosData, survivorData] = await Promise.all([
      obtenerJornadas(), obtenerPerfiles(), obtenerPartidos(), obtenerSurvivor(),
    ]);

    setJornadas(jornadasData);
    setRawPerfiles(perfilesData);
    setRawPartidos(partidosData);
    setRawSurvivor(survivorData);
    setCargando(false);
  };

  const obtenerJornadas = async () => {
    const { data } = await supabase.from("jornadas").select("*").order("id");
    return data || [];
  };

  const obtenerPerfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, nombre, nombre_usuario, nombre_completo, email, rol");
    return data || [];
  };

  const obtenerPartidos = async () => {
    const { data } = await supabase.from("partidos").select("*");
    return data || [];
  };

  const obtenerSurvivor = async () => {
    const { data } = await supabase.from("survivor").select("*");
    return data || [];
  };

  const calcularRanking = () => {
    const referenciaTiempo = horaMexico || new Date();

    const jornadasAProcesar = jornadas.filter((j) => {
      if (jornadaSeleccionada === "general") return true;
      return Number(j.id) === Number(jornadaSeleccionada);
    });

    const jornadasOrdenadas = [...jornadasAProcesar].sort((a, b) => Number(a.id) - Number(b.id));

    const acumulado = {};

    rawPerfiles.forEach((usuario) => {
      const nombre = usuario?.nombre_usuario || usuario?.nombre || usuario?.nombre_completo || "Sin nombre";
      acumulado[usuario.id] = {
        usuario_id: usuario.id,
        nombre,
        puntos: 0,
        vidas: 0,
        equipoElegido: "-",
        tuvoInfraccion: false,
        email: usuario?.email || "",
        rol: usuario?.rol || "",
      };
    });

    // PASO 1: Identificar infracciones (4ta vez o más)
    const seleccionesPorUsuarioYEquipo = {};
    rawSurvivor.forEach(s => {
      if (!s.equipo || !s.equipo.trim()) return; // 🚨 Ignorar selecciones vacías
      if (!seleccionesPorUsuarioYEquipo[s.usuario_id]) seleccionesPorUsuarioYEquipo[s.usuario_id] = {};
      const baseTeam = s.equipo.split(' (vs ')[0].trim().toLowerCase();
      if (!seleccionesPorUsuarioYEquipo[s.usuario_id][baseTeam]) seleccionesPorUsuarioYEquipo[s.usuario_id][baseTeam] = [];
      seleccionesPorUsuarioYEquipo[s.usuario_id][baseTeam].push(s);
    });

    const seleccionesInfraccion = new Set();
    Object.keys(seleccionesPorUsuarioYEquipo).forEach(userId => {
      Object.keys(seleccionesPorUsuarioYEquipo[userId]).forEach(team => {
        const selecciones = seleccionesPorUsuarioYEquipo[userId][team].sort((a, b) => Number(a.jornada_id) - Number(b.jornada_id));
        for (let i = 3; i < selecciones.length; i++) {
          seleccionesInfraccion.add(`${userId}_${selecciones[i].jornada_id}`);
        }
      });
    });

    // 🚨 PASO 1.5: Crear un SET con los usuarios que SÍ tienen selección válida en cada jornada
    const usuariosConSeleccionPorJornada = {};
    rawSurvivor.forEach(s => {
      // Solo contar si el equipo tiene un valor real (no null, no vacío, no solo espacios)
      if (s.equipo && String(s.equipo).trim() !== "") {
        const key = String(s.jornada_id);
        if (!usuariosConSeleccionPorJornada[key]) usuariosConSeleccionPorJornada[key] = new Set();
        usuariosConSeleccionPorJornada[key].add(String(s.usuario_id));
      }
    });

    // PASO 2: Procesar jornadas
    for (const jornada of jornadasOrdenadas) {
      const esPasadaYCerrada = jornada.fecha_limite
        ? referenciaTiempo > new Date(jornada.fecha_limite)
        : jornada.cerrada === true || jornada.estado === "cerrada";

      const eleccionesJornada = rawSurvivor.filter(
        (s) => Number(s.jornada_id) === Number(jornada.id)
      );

      rawPerfiles.forEach((usuario) => {
        // 🚨 Solo considerar selecciones con equipo válido
        const seleccion = eleccionesJornada.find(
          (s) => s.usuario_id === usuario.id && s.equipo && String(s.equipo).trim() !== ""
        );

        const registroAcumulado = acumulado[usuario.id];
        if (!registroAcumulado) return;

        if (jornadaSeleccionada !== "general") {
          registroAcumulado.equipoElegido = seleccion ? seleccion.equipo : "Sin selección";
        }

        if (!seleccion && esPasadaYCerrada) {
          if (registroAcumulado.vidas < 3) registroAcumulado.vidas += 1;
          return;
        }

        if (!seleccion) return;

        const esInfraccion = seleccionesInfraccion.has(`${usuario.id}_${jornada.id}`);

        const partes = seleccion.equipo.split(' (vs ');
        const nombreEquipoBase = partes[0].trim().toLowerCase();
        const nombreRivalBase = partes.length > 1 ? partes[1].replace(')', '').trim().toLowerCase() : null;

        const partido = rawPartidos.find((p) => {
          if (Number(p.jornada_id) !== Number(jornada.id)) return false;
          const localLimpio = p.local.trim().toLowerCase();
          const visitaLimpio = p.visitante.trim().toLowerCase();
          const esEquipoLocal = localLimpio === nombreEquipoBase;
          const esEquipoVisita = visitaLimpio === nombreEquipoBase;
          if (!esEquipoLocal && !esEquipoVisita) return false;
          if (nombreRivalBase) {
            return (esEquipoLocal && visitaLimpio === nombreRivalBase) || (esEquipoVisita && localLimpio === nombreRivalBase);
          }
          return true;
        });

        if (!partido || !partido.resultado) return;

        let puntos = 0;
        let perdio = false;

        if (esInfraccion) {
          puntos = 0;
          perdio = true;
          registroAcumulado.tuvoInfraccion = true;
        } else {
          const esLocal = partido.local.trim().toLowerCase() === nombreEquipoBase;
          if (esLocal) {
            if (partido.resultado === "L") puntos = 3;
            else if (partido.resultado === "E") puntos = 1;
            else if (partido.resultado === "V") perdio = true;
          } else {
            if (partido.resultado === "V") puntos = 3;
            else if (partido.resultado === "E") puntos = 1;
            else if (partido.resultado === "L") perdio = true;
          }
        }

        registroAcumulado.puntos += puntos;
        if (perdio && registroAcumulado.vidas < 3) registroAcumulado.vidas += 1;
      });
    }

    // 🚨 FILTRO INFALIBLE USANDO EL SET
    let rankingFinal = Object.values(acumulado);

    if (jornadaSeleccionada !== "general") {
      const usuariosConSeleccionEnEstaJornada = usuariosConSeleccionPorJornada[String(jornadaSeleccionada)] || new Set();
      
      rankingFinal = rankingFinal.filter((fila) => {
        // 1. Debe estar en el SET de usuarios con selección válida
        if (!usuariosConSeleccionEnEstaJornada.has(String(fila.usuario_id))) return false;
        
        // 2. No eliminado
        if (fila.vidas >= 3) return false;

        // 3. No admin
        const rolLower = (fila.rol || "").toLowerCase();
        const emailLower = (fila.email || "").toLowerCase();
        const nombreLower = (fila.nombre || "").toLowerCase();
        if (rolLower === "admin" || emailLower.includes("admin") || nombreLower.includes("admin") || emailLower.includes("root")) return false;

        return true;
      });
    }

    rankingFinal.sort((a, b) => {
      if (a.vidas !== b.vidas) return a.vidas - b.vidas;
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      return a.nombre.localeCompare(b.nombre);
    });

    setRanking(rankingFinal);
  };

  const jornadaActualObj = jornadas.find((j) => Number(j.id) === Number(jornadaSeleccionada));

  const estaCerrada = () => {
    if (!jornadaActualObj) return false;
    if (jornadaActualObj.cerrada === true || jornadaActualObj.estado === "cerrada") return true;
    if (jornadaActualObj.fecha_limite) {
      return (horaMexico || new Date()) >= new Date(jornadaActualObj.fecha_limite);
    }
    return false;
  };

  const tiempoExpirado = estaCerrada();

  return (
    <div style={{ backgroundColor: "#f3f4f6", minHeight: "100vh", padding: "24px" }}>
      <h1 className="text-3xl font-bold mb-6" style={{ color: "#111827" }}>🏆 Tabla Survivor</h1>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <label className="font-semibold" style={{ color: "#374151" }}>Filtrar vista:</label>
        <select
          value={jornadaSeleccionada}
          onChange={(e) => setJornadaSeleccionada(e.target.value === "general" ? "general" : Number(e.target.value))}
          className="rounded-lg px-4 py-2 font-medium focus:outline-none"
          style={{ backgroundColor: "#ffffff", border: "1px solid #d1d5db", color: "#111827" }}
        >
          <option value="general">🏆 Ranking General (Acumulado)</option>
          <optgroup label="Jornadas Individuales">
            {jornadas.map((j) => (
              <option key={j.id} value={j.id}>{j.nombre} {j.activa ? "🟢 (Activa)" : ""}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {cargando ? (
        <div className="rounded p-8 text-center font-medium" style={{ backgroundColor: "#ffffff", color: "#4b5563" }}>
          Cargando datos de Survivor...
        </div>
      ) : (
        <div className="rounded p-6 mb-8" style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb" }}>
          <div className="flex justify-between items-center mb-4 pb-3" style={{ borderBottom: "1px solid #e5e7eb" }}>
            <h2 className="text-2xl font-bold" style={{ color: "#1f2937" }}>
              {jornadaSeleccionada === "general" ? "Ranking General (Acumulado)" : `Resultados - ${jornadaActualObj?.nombre || "Jornada"}`}
            </h2>
            <span className="text-sm px-3 py-1 rounded-full font-medium" style={{ backgroundColor: "#f3f4f6", color: "#4b5563" }}>
              {ranking.length} Participantes {jornadaSeleccionada !== "general" && "(Activos en esta jornada)"}
            </span>
          </div>

          <table className="w-full" style={{ borderCollapse: "collapse", border: "1px solid #e5e7eb" }}>
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>
                <th className="p-2 w-16" style={{ border: "1px solid #e5e7eb" }}>Pos</th>
                <th className="p-2 text-left" style={{ border: "1px solid #e5e7eb" }}>Participante</th>
                {jornadaSeleccionada !== "general" && <th className="p-2" style={{ border: "1px solid #e5e7eb" }}>Equipo Elegido</th>}
                <th className="p-2 w-28" style={{ border: "1px solid #e5e7eb" }}>Puntos</th>
                <th className="p-2 w-32" style={{ border: "1px solid #e5e7eb" }}>Vidas Perdidas</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={jornadaSeleccionada !== "general" ? 5 : 4} className="text-center p-4" style={{ color: "#6b7280", border: "1px solid #e5e7eb" }}>
                    {jornadaSeleccionada !== "general" ? "No hay participantes activos en esta jornada." : "No se encontraron registros."}
                  </td>
                </tr>
              ) : (
                ranking.map((fila, index) => (
                  <tr key={fila.usuario_id}>
                    <td className="p-2 text-center font-bold" style={{ border: "1px solid #e5e7eb" }}>
                      {index === 0 && "🥇 "}{index === 1 && "🥈 "}{index === 2 && "🥉 "}{index + 1}
                    </td>
                    <td className="p-2 font-medium" style={{ border: "1px solid #e5e7eb" }}>{fila.nombre}</td>
                    {jornadaSeleccionada !== "general" && (
                      <td className="p-2 text-center font-semibold" style={{ border: "1px solid #e5e7eb", color: "#1d4ed8" }}>
                        {tiempoExpirado ? fila.equipoElegido : "🔒 Oculto"}
                      </td>
                    )}
                    <td className="p-2 text-center" style={{ border: "1px solid #e5e7eb" }}>
                      <div className="font-bold" style={{ color: fila.tuvoInfraccion ? "#dc2626" : "#111827" }}>{fila.puntos}</div>
                      {fila.tuvoInfraccion && (
                        <div className="text-[10px] text-red-600 font-semibold mt-1" title="Penalizado por elegir el mismo equipo más de 3 veces">
                          ⚠️ Penalizado
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-center font-semibold" style={{ border: "1px solid #e5e7eb", color: fila.vidas >= 3 ? "#dc2626" : "#4b5563" }}>
                      {fila.vidas} {fila.vidas >= 3 && "💀"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}