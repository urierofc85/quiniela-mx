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

  const [horaMexico, setHoraMexico] = useState(null);

  const tablaRef = useRef(null);
  const reporteRef = useRef(null);
  const tablaUsosRef = useRef(null);

  //=========================================
  // INICIALIZACIÓN Y RELOJ DE SEGURIDAD
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
      cargarReporteJornada();
    }
  }, [jornadaSeleccionada, rawSurvivor, rawPerfiles, rawPartidos, jornadas, horaMexico]);

  //=========================================
  // CARGA DE DATOS
  //=========================================
  const cargarDatosIniciales = async () => {
    setCargando(true);

    const horaInicial = await obtenerHoraMexico();
    setHoraMexico(horaInicial);

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
  // 🚨 VALIDACIÓN DE SEGURIDAD DE JORNADA
  //=========================================
  const jornadaActualObj = jornadas.find((j) => Number(j.id) === Number(jornadaSeleccionada));
  
  const jornadaEstaCerrada = useMemo(() => {
    if (jornadaSeleccionada === "general") return true;
    if (!jornadaActualObj || !horaMexico) return false;
    
    const cerradaPorTiempo = jornadaActualObj.fecha_limite && horaMexico > new Date(jornadaActualObj.fecha_limite);
    const cerradaManualmente = jornadaActualObj.activa === false || jornadaActualObj.cerrada === true || jornadaActualObj.estado === "cerrada";
    
    return cerradaPorTiempo || cerradaManualmente;
  }, [jornadaSeleccionada, jornadaActualObj, horaMexico]);

  //=========================================
  // 🚨 LÓGICA DEL RANKING (MEJORADA CON HISTORIAL Y USOS)
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
        equiposUsados: new Set(), // 🚨 NUEVO: Para contar equipos únicos
        historial: {}             // 🚨 NUEVO: Para guardar el resultado por jornada (3, 1, X, -)
      };
    });

    // 🚨 NUEVO: Calcular equipos únicos usados por cada usuario
    rawSurvivor.forEach(s => {
      if (!s.equipo || !String(s.equipo).trim()) return;
      const equipoBase = s.equipo.split(' (vs ')[0].trim();
      if (acumulado[s.usuario_id]) {
        acumulado[s.usuario_id].equiposUsados.add(equipoBase);
      }
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
      const cerradaPorTiempo = jornada.fecha_limite && horaActual > new Date(jornada.fecha_limite);
      const cerradaManualmente = jornada.activa === false || jornada.cerrada === true || jornada.estado === "cerrada";
      const esPasadaYCerrada = cerradaPorTiempo || cerradaManualmente;

      const eleccionesJornada = rawSurvivor.filter(
        (s) => Number(s.jornada_id) === Number(jornada.id)
      );

      rawPerfiles.forEach((usuario) => {
        const seleccion = eleccionesJornada.find(
          (s) => s.usuario_id === usuario.id && s.equipo && String(s.equipo).trim() !== ""
        );

        const registroAcumulado = acumulado[usuario.id];
        if (!registroAcumulado) return;

        // 🚨 Inicializar historial de la jornada
        registroAcumulado.historial[jornada.id] = { puntos: 0, perdioVida: false, tipo: '-' };

        if (jornadaSeleccionada !== "general") {
          registroAcumulado.equipoElegido = seleccion ? seleccion.equipo : "Sin selección";
        }

        if (!seleccion && esPasadaYCerrada) {
          if (registroAcumulado.vidas < 3) {
            registroAcumulado.vidas += 1;
            registroAcumulado.historial[jornada.id] = { puntos: 0, perdioVida: true, tipo: 'X' };
            console.log(`✅ PENALIZACIÓN: A ${registroAcumulado.nombre} se le restó 1 vida en Jornada ${jornada.id}`);
          }
          return;
        }

        if (!seleccion) {
          registroAcumulado.historial[jornada.id] = { puntos: 0, perdioVida: false, tipo: '-' };
          return;
        }

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
          registroAcumulado.historial[jornada.id] = { puntos: 0, perdioVida: true, tipo: 'X' };
        } else {
          const esLocal = partido.local.trim().toLowerCase() === nombreEquipoBase;
          if (esLocal) {
            if (partido.resultado === "L") {
              puntos = 3;
              registroAcumulado.historial[jornada.id] = { puntos: 3, perdioVida: false, tipo: '3' };
            } else if (partido.resultado === "E") {
              puntos = 1;
              registroAcumulado.historial[jornada.id] = { puntos: 1, perdioVida: false, tipo: '1' };
            } else if (partido.resultado === "V") {
              perdio = true;
              registroAcumulado.historial[jornada.id] = { puntos: 0, perdioVida: true, tipo: 'X' };
            }
          } else {
            if (partido.resultado === "V") {
              puntos = 3;
              registroAcumulado.historial[jornada.id] = { puntos: 3, perdioVida: false, tipo: '3' };
            } else if (partido.resultado === "E") {
              puntos = 1;
              registroAcumulado.historial[jornada.id] = { puntos: 1, perdioVida: false, tipo: '1' };
            } else if (partido.resultado === "L") {
              perdio = true;
              registroAcumulado.historial[jornada.id] = { puntos: 0, perdioVida: true, tipo: 'X' };
            }
          }
        }

        registroAcumulado.puntos += puntos;
        if (perdio && registroAcumulado.vidas < 3) registroAcumulado.vidas += 1;
      });
    }

    // 🚨 NUEVO: Mapear para incluir el tamaño del Set de equipos usados
    let rankingFinal = Object.values(acumulado).map(fila => ({
      ...fila,
      equiposUsados: fila.equiposUsados.size,
    }));

    if (jornadaSeleccionada !== "general") {
      rankingFinal = rankingFinal.filter((fila) => {
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
  // 🚨 REPORTE DE ELECCIONES (CON BLOQUEO)
  //=========================================
  const cargarReporteJornada = () => {
    if (jornadaSeleccionada === "general") {
      setReporteJornada([]);
      return;
    }

    if (!jornadaEstaCerrada) {
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
      const participante = perfil?.nombre_usuario || perfil?.nombre || perfil?.nombre_completo || "Sin nombre";

      return {
        participante,
        seleccion: seleccion ? seleccion.equipo : "Sin selección",
      };
    });

    filas.sort((a, b) => a.participante.localeCompare(b.participante));
    setReporteJornada(filas);
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
  // 🚨 EXPORTAR RANKING DETALLADO (MEJORADA)
  //=========================================
  const exportarRankingDetallado = async () => {
    if (ranking.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    try {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = 'max-content';
      container.style.background = 'white';
      container.style.padding = '40px';
      container.style.zIndex = '9999';
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

      const title = document.createElement('h2');
      title.textContent = `🏆 Ranking General Survivor - ${jornadaSeleccionada === "general" ? 'Acumulado' : jornadaActualObj?.nombre}`;
      title.style.fontSize = '24px';
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '20px';
      title.style.textAlign = 'center';
      title.style.color = '#0f172a';
      container.appendChild(title);

      const table = document.createElement('table');
      table.style.borderCollapse = 'collapse';
      table.style.width = '100%';
      table.style.fontSize = '12px';

      const thStyle = "border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; background-color: #f8fafc; font-weight: bold; color: #475569;";
      const tdStyle = "border: 1px solid #e2e8f0; padding: 8px 12px; text-align: center; color: #334155; vertical-align: middle;";
      const tdLeft = "border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; color: #334155; vertical-align: middle;";
      const tdNarrow = "border: 1px solid #e2e8f0; padding: 8px 4px; text-align: center; color: #334155; vertical-align: middle; width: 70px;";

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      
      // 🚨 JORNADAS CONSECUTIVAS (J1, J2, J3...)
      const jornadasParaExportar = [...jornadas].sort((a, b) => Number(a.id) - Number(b.id));
      
      const headers = ["Pos", "Participante", "Puntos", "Usos Equip"];
      jornadasParaExportar.forEach((_, idx) => {
        headers.push(`J${idx + 1}`);
      });
      headers.push("Vidas");

      headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        th.style.cssText = h === "Usos Equip" ? thStyle.replace('padding: 8px 12px', 'padding: 8px 4px; width: 70px;') : thStyle;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      ranking.forEach((fila, index) => {
        const tr = document.createElement('tr');
        
        if (index === 0) tr.style.backgroundColor = '#fef9c3';
        else if (index === 1) tr.style.backgroundColor = '#f1f5f9';
        else if (index === 2) tr.style.backgroundColor = '#ffedd5';

        // Pos
        const posTd = document.createElement('td');
        posTd.textContent = index + 1;
        posTd.style.cssText = tdStyle + " font-weight: bold;";
        tr.appendChild(posTd);

        // Nombre
        const nameTd = document.createElement('td');
        nameTd.textContent = fila.nombre;
        nameTd.style.cssText = tdLeft + " font-weight: bold;";
        tr.appendChild(nameTd);

        // Puntos Totales
        const ptsTd = document.createElement('td');
        ptsTd.textContent = fila.puntos;
        ptsTd.style.cssText = tdStyle + " font-weight: bold; color: #0f172a;";
        tr.appendChild(ptsTd);

        // 🚨 Usos Equip (Columna angosta)
        const eqTd = document.createElement('td');
        eqTd.textContent = fila.equiposUsados;
        eqTd.style.cssText = tdNarrow + " font-weight: bold;";
        tr.appendChild(eqTd);

        // 🚨 Jornadas Consecutivas
        jornadasParaExportar.forEach(j => {
          const jTd = document.createElement('td');
          const hist = fila.historial && fila.historial[j.id] ? fila.historial[j.id] : { tipo: '-', perdioVida: false };
          
          // 🚨 X PERFECTAMENTE CENTRADA
          if (hist.tipo === 'X') {
            jTd.innerHTML = '<span style="color: #dc2626; font-weight: 900; font-size: 14px; display: block; width: 100%; text-align: center; line-height: 1;">X</span>';
          } else if (hist.tipo === '3') {
            jTd.textContent = '3';
            jTd.style.cssText = tdNarrow + " font-weight: bold; color: #16a34a;";
          } else if (hist.tipo === '1') {
            jTd.textContent = '1';
            jTd.style.cssText = tdNarrow + " font-weight: bold; color: #d97706;";
          } else {
            jTd.textContent = hist.tipo || '-';
            jTd.style.cssText = tdNarrow + " color: #94a3b8;";
          }
          tr.appendChild(jTd);
        });

        // Vidas Restantes
        const vidasRestantes = Math.max(0, 3 - fila.vidas);
        const vidasTd = document.createElement('td');
        vidasTd.textContent = vidasRestantes;
        vidasTd.style.cssText = tdStyle + ` font-weight: bold; color: ${vidasRestantes === 0 ? '#dc2626' : '#0f172a'}`;
        tr.appendChild(vidasTd);

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);

      document.body.appendChild(container);
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight
      });

      document.body.removeChild(container);

      const link = document.createElement("a");
      link.download = `Ranking_Detallado_Survivor.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();

    } catch (error) {
      console.error("Error al exportar JPG:", error);
      alert("❌ Ocurrió un error al generar la imagen.");
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
            <p className="text-slate-500 mt-1">Gestión de rankings, reportes y auditoría de usos.</p>
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
              onClick={exportarRankingDetallado}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all duration-200 hover:scale-[1.02]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Exportar Ranking Detallado (JPG)
            </button>

            <button
              onClick={() => exportarJPG(reporteRef, `Elecciones-${jornadaActualObj?.nombre || "Jornada"}`)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all duration-200 hover:scale-[1.02]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Exportar Elecciones (JPG)
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

        {/* Tabla Ranking */}
        <div ref={tablaRef} className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
          <div className="px-6 py-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: '#f1f5f9' }}>
            <h2 className="text-xl font-black flex items-center gap-2" style={{ color: '#0f172a' }}>
              {jornadaSeleccionada === "general" ? "Ranking General" : `Resultados: ${jornadaActualObj?.nombre || "Jornada"}`}
            </h2>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
              {ranking.length} Participantes {jornadaSeleccionada !== "general" && "(Activos)"}
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
                      {jornadaSeleccionada !== "general" ? "No hay participantes activos en esta jornada." : "No se encontraron registros."}
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
                            {!jornadaEstaCerrada ? (
                              <span className="inline-flex items-center gap-1.5 text-slate-400 italic font-semibold">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Oculto hasta el cierre
                              </span>
                            ) : fila.equipoElegido === "Sin selección" ? (
                              <span className="inline-flex items-center gap-1.5 font-bold italic" style={{ color: '#dc2626' }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Sin selección
                              </span>
                            ) : (
                              fila.equipoElegido
                            )}
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
                                    color: estaLleno ? '#ef4444' : '#cbd5e1',
                                    opacity: estaLleno ? 1 : 0.4,
                                    transform: estaLleno ? 'scale(1)' : 'scale(0.9)'
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

        {/* Reporte Elecciones */}
        {jornadaSeleccionada !== "general" && (
          <div ref={reporteRef} className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
            <div className="px-6 py-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: '#f1f5f9' }}>
              <h2 className="text-xl font-black flex items-center gap-2" style={{ color: '#0f172a' }}>
                Resumen de Elecciones: {jornadaActualObj?.nombre || ""}
              </h2>
              
              {!jornadaEstaCerrada && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border" style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Oculto hasta el cierre
                </span>
              )}
            </div>
            
            {!jornadaEstaCerrada ? (
              <div className="p-8 text-center" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <p className="font-medium flex flex-col items-center justify-center gap-2" style={{ color: '#475569' }}>
                  <svg className="w-8 h-8" style={{ color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <span>Las elecciones de los participantes están ocultas por seguridad.</span>
                </p>
              </div>
            ) : reporteJornada.length === 0 ? (
              <div className="p-8 text-center" style={{ backgroundColor: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
                <p className="font-medium flex items-center justify-center gap-2" style={{ color: '#92400e' }}>
                  No se registraron selecciones válidas en esta jornada.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-black uppercase tracking-wider" style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>
                      <th className="px-6 py-4">Participante</th>
                      <th className="px-6 py-4 text-center">Equipo Seleccionado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#f1f5f9' }}>
                    {reporteJornada.map((fila, index) => (
                      <tr key={index} className="transition-colors hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium" style={{ color: '#1e293b' }}>{fila.participante}</td>
                        <td className="px-6 py-4 text-center">
                          {fila.seleccion === "Sin selección" ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border" style={{ backgroundColor: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' }}>
                              Sin selección
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border" style={{ backgroundColor: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe' }}>
                              {fila.seleccion}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

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