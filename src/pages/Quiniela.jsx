import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { Link, useNavigate } from "react-router-dom";
import { obtenerHoraMexico } from "../services/horario";

export default function Quiniela() {
  const navigate = useNavigate();
  const [partidos, setPartidos] = useState([]);
  const [pronosticos, setPronosticos] = useState({});
  const [jornadaActiva, setJornadaActiva] = useState(null);
  const [jornadaCerrada, setJornadaCerrada] = useState(false);
  const [quinielaGuardada, setQuinielaGuardada] = useState([]);
  
  // ESTADOS PARA LA EXPORTACIÓN DE PDF
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionadaPDF, setJornadaSeleccionadaPDF] = useState("");
  const [cargandoPDF, setCargandoPDF] = useState(false);

  // ESTADO PARA EL MODAL DE REGLAS
  const [mostrarModal, setMostrarModal] = useState(false);

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    const validarSesion = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/");
      }
    };

    validarSesion();
  }, [navigate]);

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

  const cerrarSesion = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      return;
    }

    navigate("/");
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
    <div className="max-w-4xl mx-auto p-4 bg-white min-h-screen relative">
      <h1 className="text-3xl font-bold mb-4">Captura tu Quiniela</h1>

      {/* BOTÓN DE REGLAS, PREMIOS Y COSTOS */}
      <button
        onClick={() => setMostrarModal(true)}
        className="mb-6 bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition duration-200 flex items-center gap-2"
      >
        📜 Reglas, Premios y Costos
      </button>

      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <Link to="/posiciones" className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded transition">
          Ranking General
        </Link>

        <Link to="/historico" className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded transition">
          🏆 Histórico
        </Link>

        <Link to="/perfil" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition">
          Mi Perfil
        </Link>

        <Link to="/survivor" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition">
          Survivor
        </Link>

        <button
          onClick={cerrarSesion}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition"
        >
          Cerrar Sesión
        </button>
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
              ? "bg-red-600 hover:bg-red-700 cursor-pointer transition"
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
            <label className="cursor-pointer flex items-center gap-1">
              <input
                type="radio"
                name={`partido-${partido.id}`}
                checked={pronosticos[partido.id] === "L"}
                onChange={() => actualizarPronostico(partido.id, "L")}
                disabled={jornadaCerrada}
                className="cursor-pointer"
              />{" "}
              Local
            </label>

            <label className="cursor-pointer flex items-center gap-1">
              <input
                type="radio"
                name={`partido-${partido.id}`}
                checked={pronosticos[partido.id] === "E"}
                onChange={() => actualizarPronostico(partido.id, "E")}
                disabled={jornadaCerrada}
                className="cursor-pointer"
              />{" "}
              Empate
            </label>

            <label className="cursor-pointer flex items-center gap-1">
              <input
                type="radio"
                name={`partido-${partido.id}`}
                checked={pronosticos[partido.id] === "V"}
                onChange={() => actualizarPronostico(partido.id, "V")}
                disabled={jornadaCerrada}
                className="cursor-pointer"
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
        className={`px-5 py-2 rounded mt-6 text-white font-semibold shadow-md transition ${
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

      {/* ========================================== */}
      {/* MODAL (POP-UP) DE REGLAS, PREMIOS Y COSTOS */}
      {/* ========================================== */}
      {mostrarModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setMostrarModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()} // Evita cerrar al hacer clic dentro del modal
          >
            {/* Botón de cerrar */}
            <button
              onClick={() => setMostrarModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold transition"
              aria-label="Cerrar"
            >
              &times;
            </button>

            <div className="p-6 md:p-8">
              <h2 className="text-2xl font-bold text-green-700 mb-6 text-center border-b pb-3">
                📜 Reglas, Premios y Costos
              </h2>

              <div className="space-y-6">
                {/* Sección de Pronósticos / Premios */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    🏆 Pronósticos y Premios
                  </h3>
                  <ul className="list-decimal list-inside space-y-2 text-gray-700 bg-green-50 p-4 rounded-lg border border-green-200">
                    <li>Premio semanal de <strong>$180.00</strong>.</li>
                    <li>Ganador de liguilla se lleva <strong>$250.00</strong>.</li>
                    <li>Se elimina el ganador a 4to lugar.</li>
                    <li>Primer Lugar gana <strong>$3,620.00</strong>.</li>
                    <li>Segundo Lugar gana <strong>$1,300.00</strong>.</li>
                    <li>Tercer Lugar gana <strong>$550.00</strong>.</li>
                  </ul>
                  <p className="text-sm text-gray-600 mt-2 italic text-right">
                    *(Valores calculados sobre 32 jugadores)*
                  </p>
                </div>

                {/* Sección de Reglas */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    📋 Reglas del Juego
                  </h3>
                  <ul className="list-disc list-inside space-y-3 text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <li>
                      Cada jornada el participante hará la selección de sus pronósticos: <strong>Local, Empate o Visitante</strong>.
                    </li>
                    <li>
                      Se llevará un <strong>ranking semanal</strong>.
                    </li>
                    <li>
                      Los aciertos semanales se sumarán al acumulado de pronósticos acertados. Al final del torneo de la Liga MX se tendrá a un primer, segundo y tercer lugar, conforme a los aciertos que tengan y usos de equipos.
                    </li>
                    <li>
                      En esta aplicación, se tiene un <strong>cronómetro para el inicio de la jornada</strong>. En ese momento, ya no se podrán elegir pronósticos ni survivor, por lo que, cualquier omisión será responsabilidad única del participante.
                    </li>
                  </ul>
                  <p className="text-center text-lg font-bold text-green-700 mt-4">
                    ¡Es una quiniela entre amigos! ⚽🍻
                  </p>
                </div>
              </div>

              {/* Botón de cierre inferior */}
              <div className="mt-8 text-center">
                <button
                  onClick={() => setMostrarModal(false)}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg shadow transition"
                >
                  Entendido, ¡a jugar!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}