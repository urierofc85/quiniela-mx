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
  const [cargando, setCargando] = useState(false);

  const [rawSurvivor, setRawSurvivor] = useState([]);
  const [rawPerfiles, setRawPerfiles] = useState([]);
  const [rawPartidos, setRawPartidos] = useState([]);

  const [horaMexico, setHoraMexico] = useState(null);

  const tablaRef = useRef(null);
  const tablaUsosRef = useRef(null);
  const sobrevivientesRef = useRef(null);

  //=========================================
  // INICIALIZACIÓN
  //=========================================
  useEffect(() => {
    cargarDatosIniciales();
    
    const intervaloHora = setInterval(async () => {
      const hora = await obtenerHoraMexico();
      setHoraMexico(hora);
    }, 60000);

    return () => clearInterval(intervaloHora);
  }, []);

  useEffect(() => {
    if (rawSurvivor.length > 0 && jornadas.length > 0 && horaMexico) {
      calcularRanking();
    }
  }, [jornadaSeleccionada, rawSurvivor, rawPerfiles, rawPartidos, jornadas, horaMexico]);

  //=========================================
  // CARGA DE DATOS
  //=========================================
  const cargarDatosIniciales = async () => {
    setCargando(true);
    const horaInicial = await obtenerHoraMexico();
    setHoraMexico(horaInicial);

    const [jornadasData, perfilesData, partidosData, survivorData] = await Promise.all([
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
    const { data, error } = await supabase.from("jornadas").select("*").order("id");
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
  const calcularRanking = async () => {
    const horaActual = horaMexico || await obtenerHoraMexico();

    const jornadasAProcesar = jornadas.filter((j) => {
      if (jornadaSeleccionada === "general") return true;
      return Number(j.id) <= Number(jornadaSeleccionada);
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

    const seleccionesPorUsuarioYEquipo = {};
    rawSurvivor.forEach(s => {
      if (!s.equipo || !String(s.equipo).trim()) return;
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

    const usuariosConSeleccionPorJornada = {};
    rawSurvivor.forEach(s => {
      if (s.equipo && String(s.equipo).trim() !== "") {
        const key = String(s.jornada_id);
        if (!usuariosConSeleccionPorJornada[key]) usuariosConSeleccionPorJornada[key] = new Set();
        usuariosConSeleccionPorJornada[key].add(String(s.usuario_id));
      }
    });

    for (const jornada of jornadasOrdenadas) {
      const esPasadaYCerrada = jornada.fecha_limite
        ? horaActual > new Date(jornada.fecha_limite)
        : jornada.cerrada === true || jornada.estado === "cerrada";

      const eleccionesJornada = rawSurvivor.filter(
        (s) => Number(s.jornada_id) === Number(jornada.id)
      );

      rawPerfiles.forEach((usuario) => {
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

    let rankingFinal = Object.values(acumulado);

    if (jornadaSeleccionada !== "general") {
      const usuariosConSeleccionEnEstaJornada = usuariosConSeleccionPorJornada[String(jornadaSeleccionada)] || new Set();
      rankingFinal = rankingFinal.filter((fila) => {
        if (!usuariosConSeleccionEnEstaJornada.has(String(fila.usuario_id))) return false;
        if (fila.vidas >= 3) return false;
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

  //=========================================
  // CALCULAR USOS POR EQUIPO
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
        return { usuario_id: usuario.id, cantidad };
      });
      return { equipo, usosPorUsuario };
    });

    return { usuarios, resultado };
  }, [rawPerfiles, rawPartidos, rawSurvivor]);

  //=========================================
  // 🚨 FUNCIONES PARA EXPORTAR (REFORZADAS)
  //=========================================
  const exportarJPG = async (ref, nombreArchivo) => {
    if (!ref || !ref.current) {
      alert("⚠️ No se encontró el elemento a exportar. Intenta de nuevo.");
      return;
    }
    
    try {
      // Pequeña pausa para asegurar que el DOM está completamente renderizado
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const canvas = await html2canvas(ref.current, {
        scale: 2, // Escala 2 es el punto dulce: buena calidad sin exceder el límite de memoria del canvas
        useCORS: true, 
        allowTaint: true, 
        logging: false, 
        backgroundColor: "#ffffff",
        windowWidth: ref.current.scrollWidth,
        windowHeight: ref.current.scrollHeight
      });
      
      const link = document.createElement("a");
      link.download = `${nombreArchivo}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    } catch (error) {
      console.error("Error al exportar JPG:", error);
      alert("❌ Ocurrió un error al generar la imagen. Revisa la consola del navegador (F12) para más detalles.");
    }
  };

  const exportarTablaUsosPDF = () => {
    const { usuarios, resultado } = datosUsosEquipo;
    if (usuarios.length === 0 || resultado.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const head = [["Equipo", ...usuarios.map((u) => u.nombre)]];
    const body = resultado.map((row) => [row.equipo, ...row.usosPorUsuario.map((u) => u.cantidad)]);
    const jornadaNombre = jornadaSeleccionada === "general" ? "General" : jornadas.find((j) => Number(j.id) === Number(jornadaSeleccionada))?.nombre || "";

    doc.setFontSize(16);
    doc.text(`Usos por Equipo - ${jornadaNombre}`, 40, 40);

    autoTable(doc, {
      startY: 50, head, body,
      styles: { fontSize: 8, cellPadding: 4, halign: "center", valign: "middle" },
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: "bold", halign: "center" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index > 0) {
          const valor = Number(data.cell.raw);
          if (valor === 1) { data.cell.styles.fillColor = [34, 197, 94]; data.cell.styles.textColor = [255, 255, 255]; }
          else if (valor === 2) { data.cell.styles.fillColor = [250, 204, 21]; data.cell.styles.textColor = [0, 0, 0]; }
          else if (valor >= 3) { data.cell.styles.fillColor = [239, 68, 68]; data.cell.styles.textColor = [255, 255, 255]; }
          else { data.cell.styles.fillColor = [255, 255, 255]; data.cell.styles.textColor = [156, 163, 175]; }
        }
      },
    });
    doc.save(`UsosPorEquipo_${jornadaNombre}.pdf`);
  };

  //=========================================
  // RENDER
  //=========================================
  const jornadaActualObj = jornadas.find((j) => Number(j.id) === Number(jornadaSeleccionada));
  const sobrevivientes = ranking.filter((fila) => fila.vidas < 3);

  if (cargando || !horaMexico) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg font-bold text-slate-800">Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="text-indigo-600">⚽</span> Panel Admin Survivor
            </h1>
            <p className="text-slate-500 mt-1">Gestión de rankings, auditoría de usos y lista de sobrevivientes.</p>
          </div>
        </div>

        {/* Controles y Filtros */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
            <label className="text-sm font-bold text-slate-700 whitespace-nowrap">Filtrar vista:</label>
            <select
              value={jornadaSeleccionada}
              onChange={(e) => setJornadaSeleccionada(e.target.value === "general" ? "general" : Number(e.target.value))}
              className="w-full sm:w-auto bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
            >
              <option value="general">🏆 Ranking General (Acumulado)</option>
              <optgroup label="Jornadas Individuales">
                {jornadas.map((j) => (
                  <option key={j.id} value={j.id}>{j.nombre}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <button
              onClick={() => exportarJPG(tablaRef, jornadaSeleccionada === "general" ? "Ranking-General-Survivor" : `Ranking-${jornadaActualObj?.nombre || "Jornada"}`)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all duration-200 hover:scale-[1.02]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Exportar Ranking (JPG)
            </button>

            <button
              onClick={() => exportarJPG(sobrevivientesRef, `Sobrevivientes-${jornadaActualObj?.nombre || "General"}`)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl shadow-sm transition-all duration-200 hover:scale-[1.02]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Exportar Sobrevivientes (JPG)
            </button>

            <button
              onClick={exportarTablaUsosPDF}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all duration-200 hover:scale-[1.02]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              Exportar Usos (PDF)
            </button>
          </div>
        </div>

        {/* Tabla Ranking General (Con colores hex inline para evitar error oklch en html2canvas) */}
        <div ref={tablaRef} className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
          <div className="px-6 py-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: '#f1f5f9' }}>
            <h2 className="text-xl font-black flex items-center gap-2" style={{ color: '#0f172a' }}>
              {jornadaSeleccionada === "general" ? "Ranking General" : `Resultados: ${jornadaActualObj?.nombre || "Jornada"}`}
            </h2>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
              {ranking.length} Participantes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-black uppercase tracking-wider" style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>
                  <th className="px-6 py-4 w-20 text-center">Pos</th>
                  <th className="px-6 py-4">Participante</th>
                  {jornadaSeleccionada !== "general" && <th className="px-6 py-4">Equipo Elegido</th>}
                  <th className="px-6 py-4 w-32 text-center">Puntos</th>
                  <th className="px-6 py-4 w-40 text-center">Vidas Restantes</th>
                </tr>
              </thead>
              <tbody>
                {ranking.length === 0 ? (
                  <tr>
                    <td colSpan={jornadaSeleccionada !== "general" ? 5 : 4} className="px-6 py-12 text-center font-medium" style={{ color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                      No se encontraron registros.
                    </td>
                  </tr>
                ) : (
                  ranking.map((fila, index) => {
                    const vidasRestantes = Math.max(0, 3 - fila.vidas);
                    return (
                      <tr key={fila.usuario_id} className="transition-colors" style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm" style={{ 
                            backgroundColor: index === 0 ? '#fef9c3' : index === 1 ? '#e2e8f0' : index === 2 ? '#ffedd5' : 'transparent',
                            color: index === 0 ? '#a16207' : index === 1 ? '#334155' : index === 2 ? '#9a3412' : '#64748b'
                          }}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold" style={{ color: '#1e293b' }}>{fila.nombre}</td>
                        
                        {jornadaSeleccionada !== "general" && (
                          <td className="px-6 py-4 text-sm font-medium" style={{ color: '#475569' }}>
                            {fila.equipoElegido === "Sin selección" ? (
                              <span className="italic" style={{ color: '#ef4444' }}>Sin selección</span>
                            ) : fila.equipoElegido}
                          </td>
                        )}
                        
                        <td className="px-6 py-4 text-center">
                          <div className="text-lg font-black" style={{ color: fila.tuvoInfraccion ? '#dc2626' : '#1e293b' }}>
                            {fila.puntos}
                          </div>
                          {fila.tuvoInfraccion && (
                            <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ color: '#b91c1c', backgroundColor: '#fee2e2', borderColor: '#fecaca' }}>
                              ⚠️ Penalizado
                            </span>
                          )}
                        </td>
                        
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {[...Array(3)].map((_, i) => {
                              const estaLleno = i < vidasRestantes;
                              return (
                                <span 
                                  key={i} 
                                  className="text-2xl transition-all"
                                  style={{ 
                                    color: estaLleno ? '#ef4444' : '#e2e8f0',
                                    transform: estaLleno ? 'scale(1)' : 'scale(0.9)',
                                    filter: estaLleno ? 'none' : 'grayscale(100%)'
                                  }}
                                >
                                  ❤️
                                </span>
                              );
                            })}
                          </div>
                          {fila.vidas >= 3 && (
                            <span className="text-xs font-bold block mt-1" style={{ color: '#dc2626' }}>Eliminado</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lista Compacta de Sobrevivientes (Con colores hex inline para evitar error oklch en html2canvas) */}
        <div 
          ref={sobrevivientesRef} 
          className="rounded-2xl border-2 shadow-sm overflow-hidden"
          style={{ backgroundColor: '#ffffff', borderColor: '#d1d5db' }}
        >
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
            <div>
              <h2 className="text-lg font-black flex items-center gap-2" style={{ color: '#065f46' }}>
                🌟 Lista de Sobrevivientes
              </h2>
              <p className="text-xs font-medium mt-0.5" style={{ color: '#047857' }}>
                Participantes activos (vidas &gt; 0) ordenados por ranking.
              </p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border" style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#a7f3d0' }}>
              {sobrevivientes.length} Activos
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-black uppercase tracking-wider" style={{ backgroundColor: '#ecfdf5', color: '#065f46' }}>
                  <th className="px-6 py-3 w-16 text-center">Pos</th>
                  <th className="px-6 py-3">Participante</th>
                  <th className="px-6 py-3 text-center">Puntos</th>
                  <th className="px-6 py-3">Equipo</th>
                  <th className="px-6 py-3 w-24 text-center">Vidas</th>
                </tr>
              </thead>
              <tbody>
                {sobrevivientes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center font-medium" style={{ color: '#047857', borderBottom: '1px solid #e5e7eb' }}>
                      No hay sobrevivientes en esta jornada.
                    </td>
                  </tr>
                ) : (
                  sobrevivientes.map((fila, index) => {
                    const vidasRestantes = 3 - fila.vidas;
                    return (
                      <tr key={fila.usuario_id} className="transition-colors" style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td className="px-6 py-3 text-center font-bold" style={{ color: '#059669' }}>{index + 1}</td>
                        <td className="px-6 py-3 font-semibold" style={{ color: '#111827' }}>{fila.nombre}</td>
                        <td className="px-6 py-3 text-center font-bold" style={{ color: '#1f2937' }}>{fila.puntos}</td>
                        <td className="px-6 py-3 text-sm font-medium" style={{ color: '#374151' }}>
                          {fila.equipoElegido !== "-" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded border" style={{ backgroundColor: '#f3f4f6', color: '#1f2937', borderColor: '#d1d5db' }}>
                              {fila.equipoElegido}
                            </span>
                          ) : (
                            <span className="italic text-xs" style={{ color: '#9ca3af' }}>Sin equipo registrado</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-center font-black text-xl" style={{ color: '#dc2626' }}>
                          {vidasRestantes}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla Usos por Equipo */}
        <div ref={tablaUsosRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-xl font-black text-slate-900">
              Matriz de Usos por Equipo: {jornadaSeleccionada === "general" ? "General" : jornadaActualObj?.nombre}
            </h2>
            <p className="text-sm text-slate-500 mt-1">Auditoría visual de la regla de máximo 3 usos por equipo.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                  <th className="px-3 py-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-200 font-bold">Equipo</th>
                  {datosUsosEquipo.usuarios.map((usuario) => (
                    <th key={usuario.id} className="px-2 py-3 text-center min-w-[80px] font-semibold">
                      <div className="truncate max-w-[100px]" title={usuario.nombre}>{usuario.nombre}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datosUsosEquipo.resultado.map((fila) => (
                  <tr key={fila.equipo} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 font-bold text-slate-800 text-xs sticky left-0 bg-white z-10 border-r border-slate-100">
                      {fila.equipo}
                    </td>
                    {fila.usosPorUsuario.map((uso) => {
                      let bgColor = "bg-white";
                      let textColor = "text-slate-300";
                      let displayValue = "-";
                      
                      if (uso.cantidad === 1) {
                        bgColor = "bg-emerald-500";
                        textColor = "text-white";
                        displayValue = "1";
                      } else if (uso.cantidad === 2) {
                        bgColor = "bg-amber-400";
                        textColor = "text-slate-900";
                        displayValue = "2";
                      } else if (uso.cantidad >= 3) {
                        bgColor = "bg-red-500";
                        textColor = "text-white";
                        displayValue = uso.cantidad.toString();
                      }
                      
                      return (
                        <td 
                          key={uso.usuario_id} 
                          className={`px-2 py-2 text-center font-bold text-xs ${bgColor} ${textColor} transition-colors`}
                        >
                          {displayValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}