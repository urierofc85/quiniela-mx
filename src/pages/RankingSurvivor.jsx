import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { obtenerHoraMexico } from "../services/horario";

export default function RankingSurvivor() {
  //=========================================
  // ESTADOS
  //=========================================
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("general");

  const [ranking, setRanking] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [horaMexico, setHoraMexico] = useState(null);

  const [rawSurvivor, setRawSurvivor] = useState([]);
  const [rawPerfiles, setRawPerfiles] = useState([]);
  const [rawPartidos, setRawPartidos] = useState([]);

  //=========================================
  // INICIALIZACIÓN
  //=========================================
  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    if (rawPerfiles.length > 0 && jornadas.length > 0 && horaMexico) {
      calcularRanking();
    }
  }, [jornadaSeleccionada, rawSurvivor, rawPerfiles, rawPartidos, jornadas, horaMexico]);

  //=========================================
  // CARGA DE DATOS (SUPABASE Y HORARIO)
  //=========================================
  const cargarDatosIniciales = async () => {
    setCargando(true);

    try {
      const hora = await obtenerHoraMexico();
      setHoraMexico(hora);
    } catch (error) {
      console.error("Error obteniendo hora CDMX:", error);
    }

    const [jornadasData, perfilesData, partidosData, survivorData] =
      await Promise.all([
        obtenerJornadas(),
        obtenerPerfiles(),
        obtenerPartidos(),
        obtenerSurvivor(),
      ]);

    setJornadas(jornadasData);
    setRawPerfiles(perfilesData);
    setRawPartidos(partidosData);
    setRawSurvivor(survivorData);

    setCargando(false);
  };

  const obtenerJornadas = async () => {
    const { data, error } = await supabase
      .from("jornadas")
      .select("*")
      .order("id");
    if (error) console.error("Error al obtener jornadas:", error);
    return data || [];
  };

  const obtenerPerfiles = async () => {
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) console.error("Error al obtener perfiles:", error);
    return data || [];
  };

  const obtenerPartidos = async () => {
    const { data, error } = await supabase.from("partidos").select("*");
    if (error) console.error("Error al obtener partidos:", error);
    return data || [];
  };

  const obtenerSurvivor = async () => {
    const { data, error } = await supabase.from("survivor").select("*");
    if (error) console.error("Error al obtener survivor:", error);
    return data || [];
  };

  //=========================================
  // LÓGICA DEL RANKING (IGUALADA A ADMIN)
  //=========================================
  const calcularRanking = () => {
    const referenciaTiempo = horaMexico || new Date();

    // Filtramos jornadas a evaluar según lo seleccionado en el combo
    const jornadasAProcesar = jornadas.filter((j) => {
      if (jornadaSeleccionada === "general") return true;
      return Number(j.id) === Number(jornadaSeleccionada);
    });

    const acumulado = {};

    // 1. Inicializamos el acumulado con TODOS los perfiles existentes
    rawPerfiles.forEach((usuario) => {
      const nombre =
        usuario?.nombre_usuario ||
        usuario?.nombre ||
        usuario?.nombre_completo ||
        "Sin nombre";

      acumulado[usuario.id] = {
        usuario_id: usuario.id,
        nombre,
        puntos: 0,
        vidas: 0,
        equipoElegido: "-",
      };
    });

    // 2. Procesamos cada jornada elegible
    for (const jornada of jornadasAProcesar) {
      const esPasadaYCerrada = jornada.fecha_limite
        ? referenciaTiempo > new Date(jornada.fecha_limite)
        : jornada.cerrada === true || jornada.estado === "cerrada";

      // Obtenemos las selecciones de esta jornada específica
      const eleccionesJornada = rawSurvivor.filter(
        (s) => Number(s.jornada_id) === Number(jornada.id)
      );

      rawPerfiles.forEach((usuario) => {
        const seleccion = eleccionesJornada.find(
          (s) => s.usuario_id === usuario.id
        );

        const registroAcumulado = acumulado[usuario.id];
        if (!registroAcumulado) return;

        // Si estamos viendo una jornada individual, guardamos su equipo elegido
        if (jornadaSeleccionada !== "general") {
          registroAcumulado.equipoElegido = seleccion ? seleccion.equipo : "Sin selección";
        }

        // CASO A: No seleccionó y la jornada ya cerró -> Pierde 1 vida
        if (!seleccion && esPasadaYCerrada) {
          registroAcumulado.vidas += 1;
          return;
        }

        // CASO B: No seleccionó y la jornada sigue abierta -> No afecta
        if (!seleccion) {
          return;
        }

        // CASO C: Sí seleccionó, calculamos puntos y resultados
        const partido = rawPartidos.find(
          (p) =>
            Number(p.jornada_id) === Number(jornada.id) &&
            (p.local === seleccion.equipo || p.visitante === seleccion.equipo)
        );

        if (!partido || !partido.resultado) return;

        let puntos = 0;
        let perdio = false;

        if (partido.local === seleccion.equipo) {
          if (partido.resultado === "L") puntos = 3;
          else if (partido.resultado === "E") puntos = 1;
          else if (partido.resultado === "V") perdio = true;
        } else if (partido.visitante === seleccion.equipo) {
          if (partido.resultado === "V") puntos = 3;
          else if (partido.resultado === "E") puntos = 1;
          else if (partido.resultado === "L") perdio = true;
        }

        registroAcumulado.puntos += puntos;
        if (perdio) {
          registroAcumulado.vidas += 1;
        }
      });
    }

    const rankingFinal = Object.values(acumulado).sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (a.vidas !== b.vidas) return a.vidas - b.vidas;
      return a.nombre.localeCompare(b.nombre);
    });

    setRanking(rankingFinal);
  };

  //=========================================
  // HELPER DE ESTADO Y CIERRE DE JORNADA
  //=========================================
  const jornadaActualObj = jornadas.find(
    (j) => Number(j.id) === Number(jornadaSeleccionada)
  );

  const estaCerrada = () => {
    if (!jornadaActualObj) return false;

    if (jornadaActualObj.cerrada === true || jornadaActualObj.estado === "cerrada") {
      return true;
    }

    if (jornadaActualObj.fecha_limite) {
      const fechaLimite = new Date(jornadaActualObj.fecha_limite);
      const referenciaTiempo = horaMexico || new Date();
      return referenciaTiempo >= fechaLimite;
    }

    return false;
  };

  const tiempoExpirado = estaCerrada();

  return (
    <div style={{ backgroundColor: "#f3f4f6", minHeight: "100vh", padding: "24px" }}>
      <h1 className="text-3xl font-bold mb-6" style={{ color: "#111827" }}>
        🏆 Tabla Survivor
      </h1>

      {/* CONTROLES */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <label className="font-semibold" style={{ color: "#374151" }}>
          Filtrar vista:
        </label>
        <select
          value={jornadaSeleccionada}
          onChange={(e) => {
            const val = e.target.value;
            setJornadaSeleccionada(val === "general" ? "general" : Number(val));
          }}
          className="rounded-lg px-4 py-2 font-medium focus:outline-none"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #d1d5db",
            color: "#111827",
          }}
        >
          <option value="general">🏆 Ranking General (Acumulado)</option>
          <optgroup label="Jornadas Individuales">
            {jornadas.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nombre} {j.activa ? "🟢 (Activa)" : ""}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {cargando ? (
        <div
          className="rounded p-8 text-center font-medium"
          style={{ backgroundColor: "#ffffff", color: "#4b5563" }}
        >
          Cargando datos de Survivor...
        </div>
      ) : (
        <div
          className="rounded p-6 mb-8"
          style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb" }}
        >
          <div
            className="flex justify-between items-center mb-4 pb-3"
            style={{ borderBottom: "1px solid #e5e7eb" }}
          >
            <h2 className="text-2xl font-bold" style={{ color: "#1f2937" }}>
              {jornadaSeleccionada === "general"
                ? "Ranking General (Acumulado)"
                : `Resultados - ${jornadaActualObj?.nombre || "Jornada"}`}
            </h2>
            <span
              className="text-sm px-3 py-1 rounded-full font-medium"
              style={{ backgroundColor: "#f3f4f6", color: "#4b5563" }}
            >
              {ranking.length} Participantes
            </span>
          </div>

          <table
            className="w-full"
            style={{
              borderCollapse: "collapse",
              border: "1px solid #e5e7eb",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>
                <th className="p-2 w-16" style={{ border: "1px solid #e5e7eb" }}>
                  Pos
                </th>
                <th
                  className="p-2 text-left"
                  style={{ border: "1px solid #e5e7eb" }}
                >
                  Participante
                </th>
                {jornadaSeleccionada !== "general" && (
                  <th
                    className="p-2"
                    style={{ border: "1px solid #e5e7eb" }}
                  >
                    Equipo Elegido
                  </th>
                )}
                <th className="p-2 w-28" style={{ border: "1px solid #e5e7eb" }}>
                  Puntos
                </th>
                <th className="p-2 w-32" style={{ border: "1px solid #e5e7eb" }}>
                  Vidas Perdidas
                </th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr>
                  <td
                    colSpan={jornadaSeleccionada !== "general" ? 5 : 4}
                    className="text-center p-4"
                    style={{
                      color: "#6b7280",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    No se encontraron registros para esta selección.
                  </td>
                </tr>
              ) : (
                ranking.map((fila, index) => (
                  <tr key={fila.usuario_id}>
                    <td
                      className="p-2 text-center font-bold"
                      style={{ border: "1px solid #e5e7eb" }}
                    >
                      {index === 0 && "🥇 "}
                      {index === 1 && "🥈 "}
                      {index === 2 && "🥉 "}
                      {index + 1}
                    </td>
                    <td
                      className="p-2 font-medium"
                      style={{ border: "1px solid #e5e7eb" }}
                    >
                      {fila.nombre}
                    </td>
                    {jornadaSeleccionada !== "general" && (
                      <td
                        className="p-2 text-center font-semibold"
                        style={{
                          border: "1px solid #e5e7eb",
                          color: fila.equipoElegido === "Sin selección" ? "#dc2626" : "#1d4ed8",
                        }}
                      >
                        {tiempoExpirado
                          ? fila.equipoElegido || "-"
                          : "🔒 Oculto"}
                      </td>
                    )}
                    <td
                      className="p-2 text-center font-bold"
                      style={{
                        border: "1px solid #e5e7eb",
                        color: "#111827",
                      }}
                    >
                      {fila.puntos}
                    </td>
                    <td
                      className="p-2 text-center font-semibold"
                      style={{
                        border: "1px solid #e5e7eb",
                        color: "#dc2626",
                      }}
                    >
                      {fila.vidas}
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