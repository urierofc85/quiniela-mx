
import { useEffect, useState } from "react";
import { supabase } from "./services/supabase";

export default function Partidos() {
  const [jornadas, setJornadas] = useState([]);
  const [jornadaId, setJornadaId] = useState("");
  const [ligaSeleccionada, setLigaSeleccionada] = useState("Liga MX");
  
  // Lista de equipos extraídos automáticamente desde la Jornada 1 (ID: 3)
  const [equiposDisponibles, setEquiposDisponibles] = useState([]);
  const [cargandoEquipos, setCargandoEquipos] = useState(false);

  const [partidos, setPartidos] = useState(
    Array.from({ length: 9 }, () => ({
      local: "",
      visitante: "",
    }))
  );

  useEffect(() => {
    cargarJornadas();
  }, []);

  useEffect(() => {
    if (ligaSeleccionada) {
      cargarEquiposDesdeJornadaBase();
    }
  }, [ligaSeleccionada]);

  // Cargar jornadas disponibles
  const cargarJornadas = async () => {
    const { data, error } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: false });

    if (error) console.error("Error al cargar jornadas:", error);
    setJornadas(data || []);
  };

  // Extraer catálogo de equipos únicos usando los partidos de la Jornada 1 (ID: 3)
  const cargarEquiposDesdeJornadaBase = async () => {
    setCargandoEquipos(true);

    // Consulta los partidos registrados en la jornada base (Jornada 1 / ID: 3)
    const { data, error } = await supabase
      .from("partidos")
      .select("local, visitante")
      .eq("jornada_id", 3); // ID 3 de la Jornada 1

    if (error) {
      console.error("Error al obtener equipos de la Jornada 1:", error);
      setCargandoEquipos(false);
      return;
    }

    if (data && data.length > 0) {
      // Extraer y limpiar nombres de equipos
      const nombresEquipos = new Set();
      data.forEach((p) => {
        if (p.local) nombresEquipos.add(p.local.trim());
        if (p.visitante) nombresEquipos.add(p.visitante.trim());
      });

      // Ordenar alfabéticamente los equipos
      const listaOrdenada = Array.from(nombresEquipos).sort((a, b) =>
        a.localeCompare(b)
      );
      setEquiposDisponibles(listaOrdenada);
    } else {
      setEquiposDisponibles([]);
    }

    setCargandoEquipos(false);
  };

  // Guardar partidos cargados en Supabase
  const guardarPartidos = async () => {
    if (!ligaSeleccionada) {
      alert("Selecciona una liga.");
      return;
    }

    if (!jornadaId) {
      alert("Selecciona una jornada.");
      return;
    }

    // Filtrar partidos que tengan seleccionado tanto local como visitante
    const registros = partidos
      .filter((p) => p.local.trim() !== "" && p.visitante.trim() !== "")
      .map((p) => ({
        jornada_id: Number(jornadaId),
        local: p.local.trim(),
        visitante: p.visitante.trim(),
      }));

    if (registros.length === 0) {
      alert("Debes seleccionar local y visitante en al menos un partido.");
      return;
    }

    const { error } = await supabase.from("partidos").insert(registros);

    if (error) {
      alert("Error al guardar: " + error.message);
      return;
    }

    alert(`¡Éxito! Se guardaron ${registros.length} partidos correctamente.`);

    // Reiniciar los selectores
    setPartidos(
      Array.from({ length: 9 }, () => ({
        local: "",
        visitante: "",
      }))
    );
  };

  return (
    <div
      style={{
        maxWidth: "48rem",
        margin: "0 auto",
        padding: "24px",
        backgroundColor: "#ffffff",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#111827" }}>
        ⚽ Carga Masiva de Partidos
      </h1>

      {/* SELECCIÓN DE LIGA Y JORNADA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: "#374151" }}>
            1. Liga:
          </label>
          <select
            className="w-full p-2 border rounded"
            style={{
              backgroundColor: "#ffffff",
              borderColor: "#d1d5db",
              color: "#111827",
            }}
            value={ligaSeleccionada}
            onChange={(e) => setLigaSeleccionada(e.target.value)}
          >
            <option value="Liga MX">🇲🇽 Liga MX</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: "#374151" }}>
            2. Jornada a Capturar:
          </label>
          <select
            className="w-full p-2 border rounded"
            style={{
              backgroundColor: "#ffffff",
              borderColor: "#d1d5db",
              color: "#111827",
            }}
            value={jornadaId}
            onChange={(e) => setJornadaId(e.target.value)}
          >
            <option value="">-- Seleccionar Jornada --</option>
            {jornadas.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* AVISO DE CARGA DE EQUIPOS */}
      {cargandoEquipos ? (
        <div
          className="p-4 mb-6 text-center rounded"
          style={{ backgroundColor: "#f3f4f6", color: "#4b5563" }}
        >
          Cargando catálogo de equipos de la Jornada 1...
        </div>
      ) : equiposDisponibles.length === 0 ? (
        <div
          className="p-4 mb-6 text-center rounded"
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
          }}
        >
          No se encontraron equipos registrados en la Jornada 1 (ID: 3).
        </div>
      ) : null}

      {/* FORMULARIO DE PARTIDOS CON MENÚ DESPLEGABLE */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {partidos.map((partido, index) => (
          <div
            key={index}
            className="grid grid-cols-2 gap-3 p-3 rounded"
            style={{
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
            }}
          >
            {/* SELECT LOCAL */}
            <div>
              <span className="text-xs font-semibold block mb-1" style={{ color: "#6b7280" }}>
                Partido {index + 1} - Local
              </span>
              <select
                className="w-full p-2 border rounded"
                style={{
                  backgroundColor: "#ffffff",
                  borderColor: "#d1d5db",
                  color: "#111827",
                }}
                value={partido.local}
                onChange={(e) => {
                  const copia = [...partidos];
                  copia[index].local = e.target.value;
                  setPartidos(copia);
                }}
                disabled={equiposDisponibles.length === 0}
              >
                <option value="">-- Seleccionar Local --</option>
                {equiposDisponibles.map((equipo) => (
                  <option key={`local-${equipo}`} value={equipo}>
                    {equipo}
                  </option>
                ))}
              </select>
            </div>

            {/* SELECT VISITANTE */}
            <div>
              <span className="text-xs font-semibold block mb-1" style={{ color: "#6b7280" }}>
                Partido {index + 1} - Visitante
              </span>
              <select
                className="w-full p-2 border rounded"
                style={{
                  backgroundColor: "#ffffff",
                  borderColor: "#d1d5db",
                  color: "#111827",
                }}
                value={partido.visitante}
                onChange={(e) => {
                  const copia = [...partidos];
                  copia[index].visitante = e.target.value;
                  setPartidos(copia);
                }}
                disabled={equiposDisponibles.length === 0}
              >
                <option value="">-- Seleccionar Visitante --</option>
                {equiposDisponibles.map((equipo) => (
                  <option key={`visitante-${equipo}`} value={equipo}>
                    {equipo}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={guardarPartidos}
        className="w-full mt-6 py-3 px-6 rounded text-white font-semibold cursor-pointer"
        style={{ backgroundColor: "#2563eb" }}
      >
        💾 Guardar Partidos Capturados
      </button>
    </div>
  );
}