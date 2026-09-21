import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "../services/supabase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { obtenerHoraMexico } from "../services/horario";

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
    if (rawSurvivor.length > 0 && jornadas.length > 0) {
      calcularRanking();
      cargarReporteJornada();
    }
  }, [jornadaSeleccionada, rawSurvivor, rawPerfiles, rawPartidos, jornadas]);

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
  // 🚨 LÓGICA DEL RANKING (CON SET INFALIBLE)
  //=========================================
  const calcularRanking = async () => {
    const horaMexico = await obtenerHoraMexico();

    const jornadasAProcesar = jornadas.filter((j) => {
      if (jornadaSeleccionada === "general") return true;
      return Number(j.id) === Number(jornadaSeleccionada);
    });

    const jornadasOrdenadas = [...jornadasAProcesar].sort((a, b) => Number(a.id) - Number(b.id));

    const acumulado = {};
    rawPerfiles.forEach((usuario) => {
      acumulado[usuario.id] = {
        usuario_id: usuario.id,
        nombre: usuario?.nombre_usuario || usuario?.nombre || usuario?.nombre_completo || "Sin nombre",
        puntos: 0,
        vidas: 0,
        equipoElegido: "-",
        tuvoInfraccion: false,
      };
    });

    // PASO 1: Identificar infracciones (4ta vez o más)
    const seleccionesPorUsuarioYEquipo = {};
    rawSurvivor.forEach(s => {
      if (!s.equipo || !String(s.equipo).trim()) return; // Ignorar selecciones vacías
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
      if (s.equipo && String(s.equipo).trim() !== "") {
        const key = String(s.jornada_id);
        if (!usuariosConSeleccionPorJornada[key]) usuariosConSeleccionPorJornada[key] = new Set();
        usuariosConSeleccionPorJornada[key].add(String(s.usuario_id));
      }
    });

    // PASO 2: Procesar jornadas
    for (const jornada of jornadasOrdenadas) {
      const esPasadaYCerrada = jornada.fecha_limite
        ? horaMexico > new Date(jornada.fecha_limite)
        : jornada.cerrada === true || jornada.estado === "cerrada";

      const eleccionesJornada = rawSurvivor.filter(
        (s) => Number(s.jornada_id) === Number(jornada.id)
      );

      rawPerfiles.forEach((usuario) => {
        // Solo considerar selecciones con equipo válido
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
        return true;
      });
    }

    // 3. ORDEN DE CLASIFICACIÓN
    rankingFinal.sort((a, b) => {
      if (a.vidas !== b.vidas) return a.vidas - b.vidas;
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
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

    const filas = rawPerfiles.map((perfil) => {
      const seleccion = eleccionesJornada.find(
        (item) => item.usuario_id === perfil.id && item.equipo && String(item.equipo).trim() !== ""
      );
      const participante =
        perfil?.nombre_usuario ||
        perfil?.nombre ||
        perfil?.nombre_completo ||
        "Sin nombre";

      return {
        participante,
        seleccion: seleccion ? seleccion.equipo : "Sin selección",
      };
    });

    filas.sort((a, b) => a.participante.localeCompare(b.participante));
    setReporteJornada(filas);
  };

  //=========================================
  // CALCULAR USOS POR EQUIPO (OPTIMIZADO CON USEMEMO)
  //=========================================
  const datosUsosEquipo = useMemo(() => {
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
      if (!registro.equipo || !String(registro.equipo).trim()) return;
      const usuarioId = registro.usuario_id;
      const equipoBase = registro.equipo.split(' (vs ')[0].trim();
      
      if (!conteo[usuarioId]) conteo[usuarioId] = {};
      if (!conteo[usuarioId][equipoBase]) conteo[usuarioId][equipoBase] = 0;
      conteo[usuarioId][equipoBase]++;
    });

    const resultado = equiposLigaMx.map((equipo) => {
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

    return { usuarios, resultado };
  }, [rawPerfiles, rawPartidos, rawSurvivor]);

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
  // EXPORTAR USOS POR EQUIPO EN PDF
  //=========================================
  const exportarTablaUsosPDF = () => {
    const { usuarios, resultado } = datosUsosEquipo;

    if (usuarios.length === 0 || resultado.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    const head = [["Equipo", ...usuarios.map((u) => u.nombre)]];

    const body = resultado.map((row) => [
      row.equipo,
      ...row.usosPorUsuario.map((u) => u.cantidad),
    ]);

    const jornadaNombre =
      jornadaSeleccionada === "general"
        ? "General"
        : jornadas.find((j) => Number(j.id) === Number(jornadaSeleccionada))
            ?.nombre || "";

    doc.setFontSize(16);
    doc.text(`Usos por Equipo - ${jornadaNombre}`, 40, 40);

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
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index > 0) {
          const valor = Number(data.cell.raw);
          if (valor === 1) {
            data.cell.styles.fillColor = [34, 197, 94];
            data.cell.styles.textColor = [255, 255, 255];
          } else if (valor === 2) {
            data.cell.styles.fillColor = [250, 204, 21];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (valor >= 3) {
            data.cell.styles.fillColor = [239, 68, 68];
            data.cell.styles.textColor = [255, 255, 255];
          } else {
            data.cell.styles.fillColor = [255, 255, 255];
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
                {ranking.length} Participantes {jornadaSeleccionada !== "general" && "(Activos)"}
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
                      {jornadaSeleccionada !== "general" 
                        ? "No hay participantes activos en esta jornada." 
                        : "No se encontraron registros para esta selección."}
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
                          {fila.equipoElegido}
                        </td>
                      )}
                      <td
                        className="p-2 text-center"
                        style={{ border: "1px solid #e5e7eb" }}
                      >
                        <div className="font-bold" style={{ color: fila.tuvoInfraccion ? "#dc2626" : "#111827" }}>
                          {fila.puntos}
                        </div>
                        {fila.tuvoInfraccion && (
                          <div 
                            className="text-[10px] text-red-600 font-semibold mt-1" 
                            title="Penalizado por elegir el mismo equipo más de 3 veces en la temporada"
                          >
                            ⚠️ Penalizado
                          </div>
                        )}
                      </td>
                      <td
                        className="p-2 text-center font-semibold"
                        style={{
                          border: "1px solid #e5e7eb",
                          color: fila.vidas >= 3 ? "#dc2626" : "#4b5563",
                        }}
                      >
                        {fila.vidas} {fila.vidas >= 3 && "💀"}
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
                  No se registraron selecciones válidas en esta jornada.
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
                            color: fila.seleccion === "Sin selección" ? "#dc2626" : "#1f2937",
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
                  {datosUsosEquipo.usuarios.map((usuario) => (
                    <th
                      key={usuario.id}
                      className="p-2 text-center"
                      style={{ border: "1px solid #e5e7eb" }}
                    >
                      {usuario.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datosUsosEquipo.resultado.map((fila) => (
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
                            color: uso.cantidad >= 3 ? "#ffffff" : (uso.cantidad > 0 ? "#000000" : "#9ca3af"),
                          }}
                        >
                          {uso.cantidad}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}