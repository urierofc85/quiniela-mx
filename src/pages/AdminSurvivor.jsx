import { useEffect, useState, useRef } from "react";
import { supabase } from "../services/supabase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminSurvivor() {
  //=========================================
  // ESTADOS
  //=========================================
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("general");

  const [ranking, setRanking] = useState([]);
  const [reporteJornada, setReporteJornada] = useState([]);
  const [cargando, setCargando] = useState(false);

  const [rawSurvivor, setRawSurvivor] = useState([]);
  const [rawPerfiles, setRawPerfiles] = useState([]);
  const [rawPartidos, setRawPartidos] = useState([]);

  const tablaRef = useRef(null);
  const reporteRef = useRef(null);
  const tablaUsosRef = useRef(null);

  //=========================================
  // INICIALIZACIÓN
  //=========================================
  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    if (rawSurvivor.length > 0) {
      calcularRanking();
      cargarReporteJornada();
    }
  }, [jornadaSeleccionada, rawSurvivor, rawPerfiles, rawPartidos]);

  //=========================================
  // CARGA DE DATOS (SUPABASE)
  //=========================================
  const cargarDatosIniciales = async () => {
    setCargando(true);

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
    if (error) console.error(error);
    return data || [];
  };

  const obtenerPerfiles = async () => {
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) console.error(error);
    return data || [];
  };

  const obtenerPartidos = async () => {
    const { data, error } = await supabase.from("partidos").select("*");
    if (error) console.error(error);
    return data || [];
  };

  const obtenerSurvivor = async () => {
    const { data, error } = await supabase.from("survivor").select("*");
    if (error) console.error(error);
    return data || [];
  };

  //=========================================
  // LÓGICA DEL RANKING
  //=========================================
  const calcularRanking = () => {
    const registrosFiltrados = rawSurvivor.filter((registro) => {
      if (jornadaSeleccionada === "general") return true;
      return Number(registro.jornada_id) === Number(jornadaSeleccionada);
    });

    const acumulado = {};

    for (const registro of registrosFiltrados) {
      const usuario = rawPerfiles.find((p) => p.id === registro.usuario_id);
      const partido = rawPartidos.find(
        (p) =>
          Number(p.jornada_id) === Number(registro.jornada_id) &&
          (p.local === registro.equipo || p.visitante === registro.equipo)
      );

      const nombre =
        usuario?.nombre_usuario ||
        usuario?.nombre ||
        usuario?.nombre_completo ||
        registro.usuario ||
        "Sin nombre";

      if (!acumulado[registro.usuario_id]) {
        acumulado[registro.usuario_id] = {
          usuario_id: registro.usuario_id,
          nombre,
          puntos: 0,
          vidas: 0,
          equipoElegido: registro.equipo,
        };
      }

      if (!partido || !partido.resultado) continue;

      let puntos = 0;
      let perdio = false;

      if (partido.local === registro.equipo) {
        if (partido.resultado === "L") puntos = 3;
        else if (partido.resultado === "E") puntos = 1;
        else if (partido.resultado === "V") perdio = true;
      } else if (partido.visitante === registro.equipo) {
        if (partido.resultado === "V") puntos = 3;
        else if (partido.resultado === "E") puntos = 1;
        else if (partido.resultado === "L") perdio = true;
      }

      acumulado[registro.usuario_id].puntos += puntos;
      if (perdio) acumulado[registro.usuario_id].vidas += 1;
    }

    const rankingFinal = Object.values(acumulado).sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (a.vidas !== b.vidas) return a.vidas - b.vidas;
      return a.nombre.localeCompare(b.nombre);
    });

    setRanking(rankingFinal);
  };

  //=========================================
  // REPORTE DE ELECCIONES POR JORNADA
  //=========================================
  const cargarReporteJornada = () => {
    if (jornadaSeleccionada === "general") {
      setReporteJornada([]);
      return;
    }

    const eleccionesJornada = rawSurvivor.filter(
      (item) => Number(item.jornada_id) === Number(jornadaSeleccionada)
    );

    const filas = eleccionesJornada.map((item) => {
      const perfil = rawPerfiles.find((p) => p.id === item.usuario_id);
      return {
        participante:
          perfil?.nombre_usuario ||
          perfil?.nombre ||
          perfil?.nombre_completo ||
          item.usuario ||
          "Sin nombre",
        seleccion: item.equipo,
      };
    });

    filas.sort((a, b) => a.participante.localeCompare(b.participante));
    setReporteJornada(filas);
  };

  //=========================================
  // FUNCIONES PARA EXPORTAR IMAGEN JPG
  //=========================================
  const esperarRender = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

  const exportarJPG = async (ref, nombreArchivo) => {
    if (!ref.current) {
      alert("No hay información visible para exportar.");
      return;
    }

    await esperarRender();

    const canvas = await html2canvas(ref.current, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const link = document.createElement("a");
    link.download = `${nombreArchivo}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 1);
    link.click();
  };

  //=========================================
  // CALCULAR USOS POR EQUIPO
  //=========================================
  const calcularUsosPorEquipo = () => {
    const usuarios = rawPerfiles.map((u) => ({
      id: u.id,
      nombre: u.nombre_usuario || u.nombre || u.nombre_completo || "Sin nombre",
    }));

    const equiposLigaMx = rawPartidos
      .reduce((acc, p) => {
        if (p.local && !acc.includes(p.local)) acc.push(p.local);
        if (p.visitante && !acc.includes(p.visitante)) acc.push(p.visitante);
        return acc;
      }, [])
      .sort((a, b) => a.localeCompare(b));

    const conteo = {};
    rawSurvivor.forEach((registro) => {
      const usuarioId = registro.usuario_id;
      const equipoElegido = registro.equipo;
      if (!conteo[usuarioId]) {
        conteo[usuarioId] = {};
      }
      if (!conteo[usuarioId][equipoElegido]) {
        conteo[usuarioId][equipoElegido] = 0;
      }
      conteo[usuarioId][equipoElegido]++;
    });

    const resultadoPorEquipo = equiposLigaMx.map((equipo) => {
      const usosPorUsuario = usuarios.map((usuario) => {
        const cantidad = conteo[usuario.id]?.[equipo] || 0;
        return {
          usuario_id: usuario.id,
          cantidad,
        };
      });
      return {
        equipo,
        usosPorUsuario,
      };
    });

    return { usuarios, resultado: resultadoPorEquipo };
  };

  //=========================================
  // EXPORTAR USOS POR EQUIPO EN PDF (Nativo / Ajustable)
  //=========================================
  const exportarTablaUsosPDF = () => {
    const { usuarios, resultado } = calcularUsosPorEquipo();

    if (usuarios.length === 0 || resultado.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    // Orientación horizontal ("landscape") para dar más espacio a los nombres
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    // Encabezados: [ "Equipo", "Usuario 1", "Usuario 2", ... ]
    const head = [["Equipo", ...usuarios.map((u) => u.nombre)]];

    // Filas de la tabla
    const body = resultado.map((row) => [
      row.equipo,
      ...row.usosPorUsuario.map((u) => u.cantidad),
    ]);

    // Título del documento
    const jornadaNombre =
      jornadaSeleccionada === "general"
        ? "General"
        : jornadas.find((j) => Number(j.id) === Number(jornadaSeleccionada))
            ?.nombre || "";

    doc.setFontSize(16);
    doc.text(`Usos por Equipo - ${jornadaNombre}`, 40, 40);

    // Renderizar la tabla dinámica
    autoTable(doc, {
      startY: 50,
      head: head,
      body: body,
      styles: {
        fontSize: 8,
        cellPadding: 4,
        halign: "center",
        valign: "middle",
      },
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [55, 65, 81],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold" },
      },
      // Formatear el color de fondo dinámicamente según los usos
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index > 0) {
          const valor = Number(data.cell.raw);
          if (valor === 1) {
            data.cell.styles.fillColor = [34, 197, 94]; // Verde (#22c55e)
            data.cell.styles.textColor = [255, 255, 255];
          } else if (valor === 2) {
            data.cell.styles.fillColor = [250, 204, 21]; // Amarillo (#facc15)
            data.cell.styles.textColor = [0, 0, 0];
          } else if (valor >= 3) {
            data.cell.styles.fillColor = [239, 68, 68]; // Rojo (#ef4444)
            data.cell.styles.textColor = [255, 255, 255];
          } else {
            data.cell.styles.fillColor = [255, 255, 255]; // Blanco
            data.cell.styles.textColor = [156, 163, 175];
          }
        }
      },
    });

    doc.save(`UsosPorEquipo_${jornadaNombre}.pdf`);
  };

  //=========================================
  // RENDER
  //=========================================
  const jornadaActualObj = jornadas.find(
    (j) => Number(j.id) === Number(jornadaSeleccionada)
  );

  return (
    <div style={{ backgroundColor: "#f3f4f6", minHeight: "100vh", padding: "24px" }}>
      <h1 className="text-3xl font-bold mb-6" style={{ color: "#111827" }}>
        🏆 Panel Admin Survivor
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
                {j.nombre}
              </option>
            ))}
          </optgroup>
        </select>

        {/* Botón para exportar tabla principal */}
        <button
          onClick={() =>
            exportarJPG(
              tablaRef,
              jornadaSeleccionada === "general"
                ? "Ranking-General-Survivor"
                : `Ranking-${jornadaActualObj?.nombre || "Jornada"}`
            )
          }
          className="px-4 py-2 rounded text-white font-medium cursor-pointer"
          style={{ backgroundColor: "#16a34a" }}
        >
          🖼️ Exportar Tabla (JPG)
        </button>

        {/* Botón para exportar Elecciones */}
        {jornadaSeleccionada !== "general" && (
          <button
            onClick={() =>
              exportarJPG(
                reporteRef,
                `Elecciones-${jornadaActualObj?.nombre || "Jornada"}`
              )
            }
            className="px-4 py-2 rounded text-white font-medium cursor-pointer"
            style={{ backgroundColor: "#2563eb" }}
          >
            📸 Exportar Elecciones (JPG)
          </button>
        )}

        {/* Botón para exportar Usos por Equipo en PDF */}
        <button
          onClick={exportarTablaUsosPDF}
          className="px-4 py-2 rounded text-white font-medium cursor-pointer"
          style={{ backgroundColor: "#8b5cf6" }}
        >
          📄 Exportar Usos por Equipo (PDF)
        </button>
      </div>

      {cargando ? (
        <div
          className="rounded p-8 text-center font-medium"
          style={{ backgroundColor: "#ffffff", color: "#4b5563" }}
        >
          Cargando datos de Survivor...
        </div>
      ) : (
        <>
          {/* Tabla Ranking */}
          <div
            ref={tablaRef}
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
                  <th className="p-2 w-16" style={{ border: "1px solid #e5e7eb" }}>Pos</th>
                  <th className="p-2 text-left" style={{ border: "1px solid #e5e7eb" }}>Participante</th>
                  {jornadaSeleccionada !== "general" && (
                    <th className="p-2" style={{ border: "1px solid #e5e7eb" }}>Equipo Elegido</th>
                  )}
                  <th className="p-2 w-28" style={{ border: "1px solid #e5e7eb" }}>Puntos</th>
                  <th className="p-2 w-32" style={{ border: "1px solid #e5e7eb" }}>Vidas Perdidas</th>
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
                            color: "#1d4ed8",
                          }}
                        >
                          {fila.equipoElegido || "-"}
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

          {/* Reporte Elecciones */}
          {jornadaSeleccionada !== "general" && (
            <div
              ref={reporteRef}
              className="rounded p-6 mb-8"
              style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb" }}
            >
              <h2 className="text-2xl font-bold mb-4" style={{ color: "#1f2937" }}>
                Resumen de Elecciones - {jornadaActualObj?.nombre || ""}
              </h2>
              {reporteJornada.length === 0 ? (
                <div
                  className="rounded p-4"
                  style={{
                    backgroundColor: "#fefce8",
                    border: "1px solid #fef08a",
                    color: "#854d0e",
                  }}
                >
                  No se registraron selecciones de equipos para esta jornada.
                </div>
              ) : (
                <table
                  className="w-full"
                  style={{
                    borderCollapse: "collapse",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>
                      <th className="p-2 text-left" style={{ border: "1px solid #e5e7eb" }}>Participante</th>
                      <th className="p-2 text-center" style={{ border: "1px solid #e5e7eb" }}>Equipo Seleccionado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporteJornada.map((fila, index) => (
                      <tr key={index}>
                        <td
                          className="p-2"
                          style={{ border: "1px solid #e5e7eb" }}
                        >
                          {fila.participante}
                        </td>
                        <td
                          className="p-2 text-center font-bold"
                          style={{
                            border: "1px solid #e5e7eb",
                            color: "#1f2937",
                          }}
                        >
                          {fila.seleccion}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Tabla Usos por Equipo */}
          <div
            ref={tablaUsosRef}
            className="rounded p-6 mb-8"
            style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", overflowX: "auto" }}
          >
            <h2 className="text-2xl font-bold mb-4" style={{ color: "#1f2937" }}>
              Usos por Equipo - {jornadaSeleccionada === "general" ? "General" : jornadaActualObj?.nombre}
            </h2>
            <table
              className="w-full"
              style={{
                borderCollapse: "collapse",
                border: "1px solid #e5e7eb",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>
                  <th className="p-2 text-left" style={{ border: "1px solid #e5e7eb" }}>Equipo</th>
                  {(() => {
                    const { usuarios } = calcularUsosPorEquipo();
                    return usuarios.map((usuario) => (
                      <th
                        key={usuario.id}
                        className="p-2 text-center"
                        style={{ border: "1px solid #e5e7eb" }}
                      >
                        {usuario.nombre}
                      </th>
                    ));
                  })()}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const { resultado } = calcularUsosPorEquipo();
                  return resultado.map((fila) => (
                    <tr key={fila.equipo}>
                      <td
                        className="p-2 font-medium"
                        style={{ border: "1px solid #e5e7eb" }}
                      >
                        {fila.equipo}
                      </td>
                      {fila.usosPorUsuario.map((uso) => {
                        let bgColor = "#ffffff";
                        if (uso.cantidad === 1) bgColor = "#22c55e";
                        else if (uso.cantidad === 2) bgColor = "#facc15";
                        else if (uso.cantidad >= 3) bgColor = "#ef4444";

                        return (
                          <td
                            key={uso.usuario_id}
                            className="p-2 text-center font-semibold"
                            style={{
                              border: "1px solid #e5e7eb",
                              backgroundColor: bgColor,
                            }}
                          >
                            {uso.cantidad}
                          </td>
                        );
                      })}
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}