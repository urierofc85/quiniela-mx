import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { Link } from "react-router-dom";
import { obtenerHoraMexico } from "../services/horario";

export default function Quiniela() {
  const [partidos, setPartidos] = useState([]);
  const [pronosticos, setPronosticos] = useState({});
  const [jornadaActiva, setJornadaActiva] = useState(null);
  const [jornadaCerrada, setJornadaCerrada] = useState(false);
  const [quinielaGuardada, setQuinielaGuardada] = useState([]);
  
  // ESTADOS PARA LA EXPORTACIÓN DE PDF
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionadaPDF, setJornadaSeleccionadaPDF] = useState("");
  const [cargandoPDF, setCargandoPDF] = useState(false);

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const cargarDatosIniciales = async () => {
    const ahora = await obtenerHoraMexico();

    // 1. Cargar todas las jornadas para el selector de PDF
    const { data: todasJornadas } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: false });

    if (todasJornadas) {
      // Filtrar únicamente las jornadas que YA CERRARON
      const cerradas = todasJornadas.filter((j) => {
        if (!j.fecha_limite) return false;
        const limiteQ = new Date(j.fecha_limite);
        const limiteS = j.fecha_limite_survivor
          ? new Date(j.fecha_limite_survivor)
          : limiteQ;
        return ahora > limiteQ && ahora > limiteS;
      });

      setJornadas(cerradas);

      // Seleccionar por defecto la jornada activa si ya cerró, o la más reciente cerrada
      if (cerradas.length > 0) {
        setJornadaSeleccionadaPDF(cerradas[0].id.toString());
      }
    }

    // 2. Cargar la jornada activa actual
    const { data: activa, error: jornadaError } = await supabase
      .from("jornadas")
      .select("*")
      .eq("activa", true)
      .single();

    if (jornadaError || !activa) {
      console.error("Error cargando jornada activa:", jornadaError);
      return;
    }

    setJornadaActiva(activa);

    // Cargar datos de la jornada activa
    await cargarMiQuiniela(activa.id);
    await cargarPartidos(activa.id);

    // Verificar si la jornada activa ya cerró
    if (activa.fecha_limite) {
      const limiteQ = new Date(activa.fecha_limite);
      const limiteS = activa.fecha_limite_survivor
        ? new Date(activa.fecha_limite_survivor)
        : limiteQ;

      setJornadaCerrada(ahora > limiteQ && ahora > limiteS);
    }
  };

  const cargarPartidos = async (jornadaId) => {
    if (!jornadaId) return;

    const { data, error } = await supabase
      .from("partidos")
      .select("*")
      .eq("jornada_id", jornadaId);

    if (error) {
      console.error("Error cargando partidos:", error);
      return;
    }

    setPartidos(data || []);
  };

  const cargarMiQuiniela = async (jornadaId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !jornadaId) return;

    const { data, error } = await supabase
      .from("quinielas")
      .select("*")
      .eq("usuario_id", user.id)
      .eq("jornada_id", jornadaId);

    if (error) {
      console.error("Error cargando quiniela:", error);
      return;
    }

    setQuinielaGuardada(data || []);

    const nuevosPronosticos = {};
    data?.forEach((item) => {
      nuevosPronosticos[item.partido_id] = item.pronostico;
    });
    setPronosticos(nuevosPronosticos);
  };

  const actualizarPronostico = (partidoId, valor) => {
    setPronosticos({
      ...pronosticos,
      [partidoId]: valor,
    });
  };

  const guardarQuiniela = async () => {
    const horaMexico = await obtenerHoraMexico();
    const { data: { user } } = await supabase.auth.getUser();

    if (!jornadaActiva) {
      alert("No existe una jornada activa");
      return;
    }

    const fechaLimite = new Date(jornadaActiva.fecha_limite);

    if (horaMexico > fechaLimite) {
      alert("La jornada ya fue cerrada");
      return;
    }

    const registros = Object.entries(pronosticos).map(([partidoId, valor]) => ({
      usuario: user.email,
      usuario_id: user.id,
      partido_id: Number(partidoId),
      pronostico: valor,
      jornada_id: jornadaActiva.id,
      fecha_envio: horaMexico.toISOString(),
    }));

    const { error: deleteError } = await supabase
      .from("quinielas")
      .delete()
      .eq("usuario_id", user.id)
      .eq("jornada_id", jornadaActiva.id);

    if (deleteError) {
      console.error("Error eliminando quiniela previa:", deleteError);
      alert(deleteError.message);
      return;
    }

    const { data, error } = await supabase
      .from("quinielas")
      .insert(registros)
      .select();

    if (error) {
      console.error("Error guardando quiniela:", error);
      alert(error.message);
      return;
    }

    setQuinielaGuardada(data || []);

    const nuevosPronosticos = {};
    data?.forEach((item) => {
      nuevosPronosticos[item.partido_id] = item.pronostico;
    });
    setPronosticos(nuevosPronosticos);

    alert("Quiniela guardada correctamente");
  };

  //---------------------------------------
  // FUNCIÓN PARA EXPORTAR PDF POR JORNADA
  //---------------------------------------
  const exportarPDF = async () => {
    if (!jornadaSeleccionadaPDF) {
      alert("Por favor selecciona una jornada para descargar.");
      return;
    }

    const jornadaAExportar = jornadas.find(
      (j) => j.id.toString() === jornadaSeleccionadaPDF
    );

    try {
      setCargandoPDF(true);

      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      // 1. Obtener Partidos de la jornada seleccionada
      const { data: partidosData } = await supabase
        .from("partidos")
        .select("id, local, visitante, resultado")
        .eq("jornada_id", jornadaSeleccionadaPDF)
        .order("id");

      // 2. Obtener Pronósticos de la jornada seleccionada
      const { data: quinielasData } = await supabase
        .from("quinielas")
        .select("usuario_id, partido_id, pronostico")
        .eq("jornada_id", jornadaSeleccionadaPDF);

      // 3. Obtener Perfiles
      const { data: perfiles } = await supabase
        .from("profiles")
        .select("id, nombre, nombre_usuario, nombre_completo");

      const usuarios = [
        ...new Set(quinielasData?.map((q) => q.usuario_id) || []),
      ];

      // Encabezados
      const columnas = [
        "Partido",
        "Resultado",
        ...usuarios.map((usuarioId) => {
          const perfil = perfiles?.find((p) => p.id === usuarioId);
          return (
            perfil?.nombre_usuario ||
            perfil?.nombre ||
            perfil?.nombre_completo ||
            usuarioId
          );
        }),
      ];

      const aciertos = {};
      usuarios.forEach((usuarioId) => {
        aciertos[usuarioId] = 0;
      });

      // Filas
      const filas = (partidosData || []).map((partido) => {
        const fila = [`${partido.local} vs ${partido.visitante}`, partido.resultado || "-"];

        usuarios.forEach((usuarioId) => {
          const pronostico = quinielasData?.find(
            (q) =>
              Number(q.partido_id) === Number(partido.id) &&
              q.usuario_id === usuarioId
          );

          let valor = "-";
          if (pronostico) {
            valor = pronostico.pronostico;
            if (partido.resultado && pronostico.pronostico === partido.resultado) {
              aciertos[usuarioId]++;
            }
          }
          fila.push(valor);
        });

        return fila;
      });

      // Fila de totales
      const filaTotales = ["TOTAL", ""];
      usuarios.forEach((usuarioId) => {
        filaTotales.push(aciertos[usuarioId]);
      });
      filas.push(filaTotales);

      // Generación PDF
      const doc = new jsPDF("landscape");
      doc.setFontSize(18);
      doc.text(
        `Quinielas - ${jornadaAExportar ? jornadaAExportar.nombre : `Jornada ${jornadaSeleccionadaPDF}`}`,
        14,
        15
      );

      autoTable(doc, {
        head: [columnas],
        body: filas,
        startY: 22,
        theme: "grid",
        styles: { fontSize: 8, halign: "center", valign: "middle" },
        headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: "bold" },
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === filas.length - 1) {
            data.cell.styles.fillColor = [230, 230, 230];
            data.cell.styles.fontStyle = "bold";
            return;
          }
          if (data.section !== "body" || data.column.index < 2) return;

          const fila = filas[data.row.index];
          if (!fila) return;

          const resultado = fila[1];
          const pronostico = data.cell.raw;

          if (resultado && resultado !== "-" && pronostico === resultado) {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      const nombreArchivo = jornadaAExportar
        ? `Quinielas_${jornadaAExportar.nombre.replace(/\s+/g, "_")}.pdf`
        : `Quinielas_Jornada_${jornadaSeleccionadaPDF}.pdf`;

      doc.save(nombreArchivo);
    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("Ocurrió un error al generar el PDF.");
    } finally {
      setCargandoPDF(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Captura tu Quiniela</h1>

      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <Link to="/posiciones" className="bg-orange-600 text-white px-4 py-2 rounded">
          Ranking General
        </Link>
        <Link to="/perfil" className="bg-blue-600 text-white px-4 py-2 rounded">
          Mi Perfil
        </Link>
        <Link to="/survivor" className="bg-purple-600 text-white px-4 py-2 rounded">
          Survivor
        </Link>
      </div>

      {/* SECCIÓN DE DESCARGA DE QUINIELA GENERAL */}
      <div className="bg-gray-50 border p-4 rounded-lg mb-6 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descargar Quiniela General (PDF):
          </label>
          <select
            value={jornadaSeleccionadaPDF}
            onChange={(e) => setJornadaSeleccionadaPDF(e.target.value)}
            disabled={jornadas.length === 0}
            className="w-full border rounded p-2 text-gray-800 bg-white"
          >
            {jornadas.length === 0 ? (
              <option value="">Sin jornadas cerradas disponibles</option>
            ) : (
              jornadas.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nombre} {j.id === jornadaActiva?.id ? "(Jornada Actual)" : ""}
                </option>
              ))
            )}
          </select>
        </div>

        <button
          onClick={exportarPDF}
          disabled={jornadas.length === 0 || cargandoPDF}
          className={`px-4 py-2 rounded text-white self-end flex items-center gap-2 ${
            jornadas.length > 0 && !cargandoPDF
              ? "bg-red-600 hover:bg-red-700 cursor-pointer"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          📄 {cargandoPDF ? "Generando..." : "Descargar PDF"}
        </button>
      </div>

      {jornadaActiva && (
        <p className="mb-4 text-red-600 font-semibold">
          ⏰ Fecha límite ({jornadaActiva.nombre}):{" "}
          {new Date(jornadaActiva.fecha_limite).toLocaleString("es-MX")}
        </p>
      )}

      {partidos.map((partido) => (
        <div key={partido.id} className="border rounded p-4 mb-3">
          <h3 className="font-semibold">
            {partido.local} vs {partido.visitante}
          </h3>

          <div className="flex gap-4 mt-3">
            <label className="cursor-pointer">
              <input
                type="radio"
                name={`partido-${partido.id}`}
                checked={pronosticos[partido.id] === "L"}
                onChange={() => actualizarPronostico(partido.id, "L")}
                disabled={jornadaCerrada}
              />{" "}
              Local
            </label>

            <label className="cursor-pointer">
              <input
                type="radio"
                name={`partido-${partido.id}`}
                checked={pronosticos[partido.id] === "E"}
                onChange={() => actualizarPronostico(partido.id, "E")}
                disabled={jornadaCerrada}
              />{" "}
              Empate
            </label>

            <label className="cursor-pointer">
              <input
                type="radio"
                name={`partido-${partido.id}`}
                checked={pronosticos[partido.id] === "V"}
                onChange={() => actualizarPronostico(partido.id, "V")}
                disabled={jornadaCerrada}
              />{" "}
              Visitante
            </label>
          </div>
        </div>
      ))}

      {jornadaCerrada && (
        <p className="text-red-600 font-bold mt-4">
          🔒 La jornada activa ya fue cerrada. Puedes descargar la quiniela en el selector superior.
        </p>
      )}

      <button
        disabled={jornadaCerrada}
        onClick={guardarQuiniela}
        className={`px-5 py-2 rounded mt-6 text-white ${
          jornadaCerrada ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
        }`}
      >
        Guardar Quiniela
      </button>

      {quinielaGuardada.length > 0 && (
        <div className="mt-10">
          <h2 className="text-2xl font-bold mb-4">✅ Mis Pronósticos Enviados</h2>

          <div className="overflow-x-auto">
            <table className="w-full border rounded">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2 border">Partido</th>
                  <th className="p-2 border">Pronóstico</th>
                </tr>
              </thead>
              <tbody>
                {quinielaGuardada.map((item) => {
                  const partido = partidos.find(
                    (p) => String(p.id) === String(item.partido_id)
                  );

                  return (
                    <tr key={item.id}>
                      <td className="p-2 border">
                        {partido
                          ? `${partido.local} vs ${partido.visitante}`
                          : "Partido no encontrado"}
                      </td>
                      <td className="p-2 border font-semibold">
                        {item.pronostico === "L" && "🏠 Local"}
                        {item.pronostico === "E" && "🤝 Empate"}
                        {item.pronostico === "V" && "✈️ Visitante"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}