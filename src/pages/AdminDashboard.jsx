import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { obtenerHoraMexico } from "../services/horario";
import html2canvas from "html2canvas";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [jornadaActiva, setJornadaActiva] = useState(null);
  const [participantes, setParticipantes] = useState(0);
  const [quinielasActivas, setQuinielasActivas] = useState(0);
  
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");

  const [datosGrafica, setDatosGrafica] = useState([]);
  const [ausentesQuiniela, setAusentesQuiniela] = useState([]);
  const [ausentesSurvivor, setAusentesSurvivor] = useState([]);

  const [rankingQuinielas, setRankingQuinielas] = useState([]);
  const [jornadasSecuenciales, setJornadasSecuenciales] = useState([]);

  const [cargando, setCargando] = useState(true);

  const [modalPDFAbierto, setModalPDFAbierto] = useState(false);
  const [jornadaParaPDF, setJornadaParaPDF] = useState("");
  const [exportandoPDF, setExportandoPDF] = useState(false);

  useEffect(() => {
    cargarDashboard();
  }, []);

  useEffect(() => {
    const validarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/");
    };
    validarSesion();
  }, [navigate]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && modalPDFAbierto) {
        setModalPDFAbierto(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [modalPDFAbierto]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    window.location.replace("/");
  };

  const esAdmin = (p) => {
    const rol = (p.rol || "").toLowerCase();
    const email = (p.email || "").toLowerCase();
    const nombre = (p.nombre_usuario || p.nombre || "").toLowerCase();
    return rol === "admin" || email.includes("admin") || nombre.includes("admin") || email.includes("root");
  };

  //---------------------------------------
  // CARGA DEL DASHBOARD CON PAGINACIÓN AUTOMÁTICA
  //---------------------------------------
  const cargarDashboard = async () => {
    setCargando(true);
    const t0 = performance.now();

    try {
      const ahora = await obtenerHoraMexico();

      const fetchAllRows = async (tableName, columns) => {
        let allData = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from(tableName)
            .select(columns)
            .order("id", { ascending: false })
            .range(from, to);

          if (error) {
            console.error(`Error fetching ${tableName}:`, error);
            break;
          }

          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allData = [...allData, ...data];
            if (data.length < 1000) {
              hasMore = false;
            } else {
              from += 1000;
              to += 1000;
            }
          }
        }
        return allData;
      };

      const [jornadasRes, jornadaActivaRes, participantesRes, perfilesRes] = await Promise.all([
        supabase.from("jornadas").select("id, nombre, activa, fecha_limite").order("id", { ascending: true }),
        supabase.from("jornadas").select("id, nombre").eq("activa", true).single(),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("id, nombre, nombre_usuario, email, rol, solo_survivor")
      ]);

      const [todasQuinielas, todosSurvivor, todosPartidos] = await Promise.all([
        fetchAllRows("quinielas", "jornada_id, usuario_id, partido_id, pronostico"),
        fetchAllRows("survivor", "jornada_id, usuario_id, equipo"),
        fetchAllRows("partidos", "id, jornada_id, local, visitante, resultado, pospuesto")
      ]);

      const jornadasData = jornadasRes.data || [];
      const jornadaActivaData = jornadaActivaRes.data;
      const perfilesData = perfilesRes.data || [];

      setJornadas(jornadasData);
      setJornadaActiva(jornadaActivaData);
      setParticipantes(participantesRes.count || 0);
      if (jornadaActivaData) setJornadaSeleccionada(jornadaActivaData.id);

      const resultados = procesarTodosLosDatos(
        jornadasData,
        perfilesData,
        todasQuinielas,
        todosSurvivor,
        todosPartidos,
        ahora,
        jornadaActivaData?.id
      );

      setDatosGrafica(resultados.datosGrafica);
      setRankingQuinielas(resultados.rankingQuinielas);
      setJornadasSecuenciales(resultados.jornadasSecuenciales);
      setAusentesQuiniela(resultados.ausentesQuiniela);
      setAusentesSurvivor(resultados.ausentesSurvivor);
      setQuinielasActivas(resultados.quinielasActivas);

      const t1 = performance.now();
      console.log(`⚡ Dashboard cargado en ${Math.round(t1 - t0)}ms`);

    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setCargando(false);
    }
  };

  //---------------------------------------
  // PROCESAMIENTO DE DATOS
  //---------------------------------------
  const procesarTodosLosDatos = (
    jornadasData,
    perfilesData,
    todasQuinielas,
    todosSurvivor,
    todosPartidos,
    ahora,
    idJornadaActiva
  ) => {
    const jornadasSecuenciales = jornadasData.map((jornada, index) => ({
      idSupabase: jornada.id,
      numero: index + 1,
      nombre: `J${index + 1}`
    }));

    const usuariosConPicksSurvivor = new Set(
      (todosSurvivor || []).map(s => s.usuario_id)
    );

    const usuariosQueJueganSurvivor = new Set(
      perfilesData
        .filter(p => p.solo_survivor === true || usuariosConPicksSurvivor.has(p.id))
        .map(p => p.id)
    );

    const acumulado = {};
    perfilesData.forEach(usuario => {
      if (esAdmin(usuario)) return;
      acumulado[usuario.id] = {
        usuario_id: usuario.id,
        nombre: usuario.nombre_usuario || usuario.nombre || "Sin nombre",
        totalAciertos: 0,
        vidas: 0,
        quinielasEnviadas: 0,
        survivorEnviados: 0,
        aciertosPorJornada: {},
        soloSurvivor: usuario.solo_survivor === true
      };
      jornadasSecuenciales.forEach(j => {
        acumulado[usuario.id].aciertosPorJornada[j.numero] = 0;
      });
    });

    const quinielasPorJornadaCount = {};
    const survivorPorJornadaCount = {};

    jornadasData.forEach(jornada => {
      const jornadaId = jornada.id;
      const secNum = jornadasSecuenciales.find(j => j.idSupabase === jornadaId)?.numero;
      const esPasadaYCerrada = jornada.fecha_limite ? ahora > new Date(jornada.fecha_limite) : false;

      quinielasPorJornadaCount[jornadaId] = new Set();
      survivorPorJornadaCount[jornadaId] = new Set();

      const partidosDeJornada = todosPartidos.filter(p => String(p.jornada_id) === String(jornadaId) && !p.pospuesto);
      const quinielasDeJornada = todasQuinielas.filter(q => String(q.jornada_id) === String(jornadaId));
      const survivorDeJornada = todosSurvivor.filter(s => String(s.jornada_id) === String(jornadaId));

      perfilesData.forEach(usuario => {
        if (esAdmin(usuario)) return;
        const reg = acumulado[usuario.id];
        if (!reg) return;

        const esJugadorSurvivor = usuariosQueJueganSurvivor.has(usuario.id);

        // ✅ CORRECCIÓN: Procesar Survivor PRIMERO, antes del return de soloSurvivor
        if (esJugadorSurvivor) {
          const seleccionSurvivor = survivorDeJornada.find(s => s.usuario_id === usuario.id);
          if (seleccionSurvivor && seleccionSurvivor.equipo) {
            reg.survivorEnviados++;
            survivorPorJornadaCount[jornadaId].add(usuario.id);
            if (esPasadaYCerrada) {
              const normalizar = (texto) => texto.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const equipoLimpio = normalizar(seleccionSurvivor.equipo);
              
              const partido = partidosDeJornada.find(p => {
                return normalizar(p.local) === equipoLimpio || normalizar(p.visitante) === equipoLimpio;
              });

              if (partido?.resultado) {
                let perdio = false;
                const esLocal = normalizar(partido.local) === equipoLimpio;
                
                if (esLocal && partido.resultado === "V") perdio = true;
                if (!esLocal && partido.resultado === "L") perdio = true;
                
                if (perdio && reg.vidas < 3) reg.vidas++;
              }
            }
          } else if (esPasadaYCerrada && reg.vidas < 3) {
            reg.vidas++;
          }
        }

        // --- QUINIELA ---
        // Ahora este return solo salta la quiniela, pero el survivor ya se procesó
        if (reg.soloSurvivor) return;

        const quinielasUsuario = quinielasDeJornada.filter(q => q.usuario_id === usuario.id);
        if (quinielasUsuario.length > 0) {
          reg.quinielasEnviadas++;
          quinielasPorJornadaCount[jornadaId].add(usuario.id);
          quinielasUsuario.forEach(q => {
            const partido = partidosDeJornada.find(p => String(p.id) === String(q.partido_id));
            if (partido && partido.resultado && q.pronostico === partido.resultado) {
              if (secNum) reg.aciertosPorJornada[secNum] = (reg.aciertosPorJornada[secNum] || 0) + 1;
              reg.totalAciertos++;
            }
          });
        }
      });
    });

    // Resumen de vidas perdidas en consola
    console.log("\n📊 RESUMEN DE VIDAS PERDIDAS:");
    Object.values(acumulado).forEach(reg => {
      if (reg.vidas > 0) {
        console.log(`  ${reg.nombre}: ${reg.vidas} vidas perdidas`);
      }
    });
    console.log("=== FIN RESUMEN ===\n");

    const rankingQuinielas = Object.values(acumulado)
      .filter(u => !u.soloSurvivor)
      .sort((a, b) => {
        if (b.totalAciertos !== a.totalAciertos) return b.totalAciertos - a.totalAciertos;
        if (a.vidas !== b.vidas) return a.vidas - b.vidas;
        return a.nombre.localeCompare(b.nombre);
      });

    const datosGrafica = jornadasData.map(jornada => {
      const secNum = jornadasSecuenciales.find(j => j.idSupabase === jornada.id)?.numero;
      return {
        nombre: jornada.nombre || `J${secNum || jornada.id}`,
        quinielas: quinielasPorJornadaCount[jornada.id]?.size || 0,
        survivor: survivorPorJornadaCount[jornada.id]?.size || 0
      };
    });

    let ausentesQuiniela = [];
    let ausentesSurvivor = [];
    let quinielasActivas = 0;

    if (idJornadaActiva) {
      const jornadaActivaSecNum = jornadasSecuenciales.find(j => j.idSupabase === idJornadaActiva)?.numero;
      const jornadasHastaActiva = jornadaActivaSecNum || 0;
      
      const quinielasDeJornadaActiva = todasQuinielas.filter(q => String(q.jornada_id) === String(idJornadaActiva));
      const quinielasActivaSet = new Set(quinielasDeJornadaActiva.map(q => q.usuario_id));
      
      const survivorDeJornadaActiva = todosSurvivor.filter(s => String(s.jornada_id) === String(idJornadaActiva));
      const survivorActivaSet = new Set(survivorDeJornadaActiva.filter(s => s.equipo).map(s => s.usuario_id));
      
      quinielasActivas = quinielasActivaSet.size;

      ausentesQuiniela = perfilesData
        .filter(p => {
          if (esAdmin(p)) return false;
          if (p.solo_survivor === true) return false;
          const reg = acumulado[p.id];
          if (!reg) return false;
          return !quinielasActivaSet.has(p.id);
        })
        .map(p => {
          const reg = acumulado[p.id];
          let motivo = "Falta en jornada actual";
          let tipo = "normal";
          
          const jornadasFaltadas = jornadasHastaActiva - reg.quinielasEnviadas;
          if (jornadasFaltadas > 1) {
            motivo = `Inactivo (faltó ${jornadasFaltadas} jornadas)`;
            tipo = "inactivo";
          }
          return { ...p, motivo, tipo };
        });

      // Faltan Survivor: excluir eliminados (3+ vidas)
      ausentesSurvivor = perfilesData
        .filter(p => {
          if (esAdmin(p)) return false;
          if (!usuariosQueJueganSurvivor.has(p.id)) return false;
          if (survivorActivaSet.has(p.id)) return false;
          
          const reg = acumulado[p.id];
          if (reg && reg.vidas >= 3) return false;
          
          return true;
        })
        .map(p => {
          const reg = acumulado[p.id];
          let motivo = "Falta en jornada actual";
          let tipo = "normal";
          if (reg && reg.vidas >= 3) {
            motivo = "Eliminado (3 vidas)";
            tipo = "eliminado";
          }
          return { ...p, motivo, tipo };
        });
    }

    return {
      rankingQuinielas,
      jornadasSecuenciales,
      datosGrafica,
      ausentesQuiniela,
      ausentesSurvivor,
      quinielasActivas
    };
  };

  const getNombreUsuario = (p) => {
    return p.nombre_usuario || p.nombre || (p.email ? p.email.split('@')[0] : 'Usuario');
  };

  //---------------------------------------
  // EXPORTAR A IMAGEN (JPEG)
  //---------------------------------------
  const exportarImagen = async () => {
    try {
      const rankingOrdenado = [...rankingQuinielas].sort((a, b) => {
        if (b.totalAciertos !== a.totalAciertos) return b.totalAciertos - a.totalAciertos;
        return a.nombre.localeCompare(b.nombre);
      });

      const liderScore = rankingOrdenado.length > 0 ? rankingOrdenado[0].totalAciertos : 0;

      const contenedorTemp = document.createElement('div');
      contenedorTemp.style.position = 'fixed';
      contenedorTemp.style.top = '0';
      contenedorTemp.style.left = '0';
      contenedorTemp.style.width = '1400px';
      contenedorTemp.style.background = 'white';
      contenedorTemp.style.padding = '40px';
      contenedorTemp.style.boxShadow = '0 0 20px rgba(0,0,0,0.1)';
      contenedorTemp.style.zIndex = '9999';
      
      const titulo = document.createElement('h2');
      titulo.textContent = '🏆 Ranking General Acumulado - Quinielas';
      titulo.style.fontSize = '28px';
      titulo.style.fontWeight = 'bold';
      titulo.style.marginBottom = '20px';
      titulo.style.textAlign = 'center';
      contenedorTemp.appendChild(titulo);

      const tabla = document.createElement('table');
      tabla.style.width = '100%';
      tabla.style.borderCollapse = 'collapse';
      tabla.style.fontSize = '13px';

      const thead = document.createElement('thead');
      let encabezadosHTML = `
        <tr style="background-color: #16a34a; color: white;">
          <th style="border: 1px solid #15803d; padding: 8px; text-align: center; width: 50px;">Pos</th>
          <th style="border: 1px solid #15803d; padding: 8px; text-align: left; width: 150px;">Usuario</th>
      `;

      jornadasSecuenciales.forEach(jornadaSec => {
        encabezadosHTML += `<th style="border: 1px solid #15803d; padding: 8px; text-align: center; width: 50px;">${jornadaSec.nombre}</th>`;
      });
      encabezadosHTML += `<th style="border: 1px solid #15803d; padding: 8px; text-align: center; width: 70px; background-color: #15803d; font-weight: bold;">TOTAL</th></tr>`;
      thead.innerHTML = encabezadosHTML;
      tabla.appendChild(thead);

      const tbody = document.createElement('tbody');
      
      rankingOrdenado.forEach((fila, index) => {
        const pos = index + 1;
        let bgColor = '#ffffff';
        let textColor = '#000000';
        let fontWeight = 'normal';

        if (pos === 1) {
          bgColor = '#22c55e'; textColor = '#ffffff'; fontWeight = 'bold';
        } else if (pos === 2) {
          bgColor = '#eab308'; textColor = '#000000'; fontWeight = 'bold';
        } else if (pos === 3) {
          bgColor = '#f97316'; textColor = '#ffffff'; fontWeight = 'bold';
        } else if (pos === 4) {
          bgColor = '#3b82f6'; textColor = '#ffffff'; fontWeight = 'bold';
        } else if (pos === 5) {
          bgColor = '#8b5cf6'; textColor = '#ffffff'; fontWeight = 'bold';
        }

        if (liderScore - fila.totalAciertos > 11) {
          bgColor = '#ef4444'; textColor = '#ffffff'; fontWeight = 'bold';
        }

        const tr = document.createElement('tr');
        tr.style.backgroundColor = bgColor;
        tr.style.color = textColor;

        let filaHTML = `
          <td style="border: 1px solid rgba(156, 163, 175, 0.5); padding: 8px; text-align: center; font-weight: ${fontWeight};">${pos}</td>
          <td style="border: 1px solid rgba(156, 163, 175, 0.5); padding: 8px; font-weight: ${fontWeight};">${fila.nombre}</td>
        `;

        jornadasSecuenciales.forEach(jornadaSec => {
          const aciertos = fila.aciertosPorJornada[jornadaSec.numero] || 0;
          filaHTML += `<td style="border: 1px solid rgba(156, 163, 175, 0.5); padding: 8px; text-align: center;">${aciertos}</td>`;
        });
        
        filaHTML += `<td style="border: 1px solid rgba(156, 163, 175, 0.5); padding: 8px; text-align: center; font-weight: bold; background-color: rgba(0,0,0,0.1);">${fila.totalAciertos}</td></tr>`;
        tr.innerHTML = filaHTML;
        tbody.appendChild(tr);
      });

      tabla.appendChild(tbody);
      contenedorTemp.appendChild(tabla);

      document.body.appendChild(contenedorTemp);
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(contenedorTemp, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      document.body.removeChild(contenedorTemp);

      const imagenData = canvas.toDataURL("image/jpeg", 0.95);
      const link = document.createElement("a");
      link.download = `Ranking_General_Quinielas.jpg`;
      link.href = imagenData;
      link.click();
      
    } catch (error) {
      console.error("Error al exportar:", error);
      alert("Error al generar la imagen: " + error.message);
    }
  };

  //---------------------------------------
  // MODAL PDF
  //---------------------------------------
  const abrirModalPDF = () => {
    const preSeleccion = jornadaActiva?.id || (jornadas.length > 0 ? jornadas[0].id : "");
    setJornadaParaPDF(preSeleccion);
    setModalPDFAbierto(true);
  };

  //---------------------------------------
  // ✅ EXPORTAR PDF (CORREGIDO: MUESTRA PRONÓSTICOS INCLUSO SIN RESULTADO)
  //---------------------------------------
  const exportarPDF = async (jornadaId) => {
    if (!jornadaId) {
      alert("Selecciona una jornada.");
      return;
    }

    setExportandoPDF(true);

    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const { data: jornadaActivaPDF } = await supabase.from("jornadas").select("*").eq("id", jornadaId).single();
      
      // Traer TODOS los partidos de la jornada (incluyendo pospuestos o sin resultado)
      const { data: partidos } = await supabase
        .from("partidos")
        .select("id, local, visitante, resultado, pospuesto")
        .eq("jornada_id", jornadaId)
        .order("id");
        
      const { data: quinielasData } = await supabase.from("quinielas").select("usuario_id, partido_id, pronostico").eq("jornada_id", jornadaId);
      const { data: perfiles } = await supabase.from("profiles").select("id, nombre, nombre_usuario, nombre_completo");

      let usuarios = [...new Set(quinielasData?.map(q => q.usuario_id) || [])];

      if (usuarios.length === 0) {
        alert("⚠️ No hay quinielas registradas para esta jornada.");
        setExportandoPDF(false);
        return;
      }

      // ✅ CORRECCIÓN: Buscar el pronóstico del usuario SIN importar si el partido ya tiene resultado
      const usuariosConPuntajes = usuarios.map(usuarioId => {
        let aciertos = 0;
        const pronosticosUsuario = {};
        
        (partidos || []).forEach(partido => {
          // 1. Siempre buscamos si el usuario hizo un pronóstico para este partido
          const pronostico = quinielasData?.find(q => Number(q.partido_id) === Number(partido.id) && q.usuario_id === usuarioId);
          
          if (pronostico) {
            pronosticosUsuario[partido.id] = pronostico.pronostico;
            
            // 2. Solo sumamos acierto si el partido YA tiene resultado Y el pronóstico coincide
            if (partido.resultado && pronostico.pronostico === partido.resultado) {
              aciertos++;
            }
          } else {
            // Si no hizo pronóstico, mostramos guion
            pronosticosUsuario[partido.id] = "-";
          }
        });
        
        return { usuarioId, aciertos, pronosticosUsuario };
      });

      usuariosConPuntajes.sort((a, b) => b.aciertos - a.aciertos);

      const posiciones = {};
      usuariosConPuntajes.forEach((u, index) => {
        if (index === 0) {
          posiciones[u.usuarioId] = 1;
        } else {
          const prev = usuariosConPuntajes[index - 1];
          if (u.aciertos === prev.aciertos) {
            posiciones[u.usuarioId] = posiciones[prev.usuarioId];
          } else {
            posiciones[u.usuarioId] = index + 1;
          }
        }
      });

      const columnasDef = [
        { header: "Pos", dataKey: "pos" },
        { header: "Usuario", dataKey: "usuario" },
        ...(partidos || []).map(p => ({ header: `${p.local} vs ${p.visitante}`, dataKey: `p_${p.id}` })),
        { header: "Total", dataKey: "total" }
      ];

      const head = [columnasDef.map(col => col.header)];

      const body = usuariosConPuntajes.map(u => {
        const perfil = perfiles?.find(p => p.id === u.usuarioId);
        let nombre = perfil?.nombre_usuario || perfil?.nombre || perfil?.nombre_completo || u.usuarioId;
        
        if (nombre && nombre.length > 15) {
          nombre = nombre.substring(0, 14) + "..";
        }
        
        const row = {
          pos: `#${posiciones[u.usuarioId]}`,
          usuario: nombre,
          total: u.aciertos
        };
        
        (partidos || []).forEach(p => {
          row[`p_${p.id}`] = u.pronosticosUsuario[p.id] || "-";
        });
        
        return columnasDef.map(col => row[col.dataKey]);
      });

      const doc = new jsPDF("landscape", "mm", "a4");

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 197, 94);
      doc.text(`Quinielas - ${jornadaActivaPDF?.nombre || 'Jornada'}`, 14, 15);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, 14, 21);

      autoTable(doc, {
        head: head,
        body: body,
        startY: 26,
        theme: "grid",
        styles: {
          fontSize: 6.5,
          halign: "center",
          valign: "middle",
          cellPadding: 1.5,
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [34, 197, 94],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 6,
          halign: "center",
          cellPadding: 1.5,
          minCellHeight: 28,
        },
        columnStyles: {
          0: { halign: "center", fontStyle: "bold", fillColor: [240, 240, 240], cellWidth: 12 },
          1: { halign: "left", fontStyle: "bold", fillColor: [240, 240, 240], cellWidth: 35 },
        },
        didParseCell: (data) => {
          // Estilo para la columna TOTAL
          if (data.section === "body" && data.column.index === columnasDef.length - 1) {
            data.cell.styles.fillColor = [220, 252, 231];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = [22, 101, 52];
            data.cell.styles.fontSize = 7.5;
            return;
          }

          // Resaltar aciertos en verde (solo si el partido ya tiene resultado)
          if (data.section === "body" && data.column.index >= 2 && data.column.index < columnasDef.length - 1) {
            const colDataKey = columnasDef[data.column.index].dataKey;
            const partidoId = Number(colDataKey.replace('p_', ''));
            const partido = partidos?.find(p => p.id === partidoId);
            
            if (partido && partido.resultado && data.cell.raw === partido.resultado) {
              data.cell.styles.textColor = [0, 128, 0];
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 253, 244];
            }
          }
        },
        margin: { top: 26, left: 8, right: 8, bottom: 10 },
      });

      doc.save(`Quinielas_${jornadaActivaPDF?.nombre || 'Jornada'}.pdf`);
      setModalPDFAbierto(false);
    } catch (error) {
      console.error("Error al exportar PDF:", error);
      alert("Error al generar el PDF: " + error.message);
    } finally {
      setExportandoPDF(false);
    }
  };

  //---------------------------------------
  // INTERFAZ
  //---------------------------------------
  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-green-600 border-t-transparent mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Cargando Dashboard...</p>
          <p className="text-sm text-gray-500 mt-2">Procesando datos de quinielas y survivor</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Dashboard Administrador</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={jornadaSeleccionada}
          onChange={(e) => setJornadaSeleccionada(Number(e.target.value))}
          className="border rounded px-3 py-2 bg-white"
        >
          {jornadas.map((j) => (
            <option key={j.id} value={j.id}>{j.nombre} {j.activa ? " (Activa)" : ""}</option>
          ))}
        </select>

        <button 
          onClick={exportarImagen} 
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
        >
          📸 Exportar Ranking General Quinielas (JPEG)
        </button>

        <button 
          onClick={abrirModalPDF} 
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
        >
          📄 Exportar PDF
        </button>
        
        <Link to="/admin" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Crear Jornada</Link>
        <Link to="/partidos" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition">Crear Partidos</Link>
        <Link to="/admin/resultados" className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition">Capturar Resultados</Link>
        <Link to="/posiciones" className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition">Ranking</Link>
        <Link to="/admin-survivor" className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700 transition">🏆 Admin Survivor</Link>
        <Link to="/acceso-pronosticos" className="bg-cyan-600 text-white px-4 py-2 rounded hover:bg-cyan-700 transition">🔒 Pronósticos Privados</Link>
        <button onClick={cerrarSesion} className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800 transition">🚪 Cerrar Sesión</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded shadow p-4 border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm font-semibold">JORNADA ACTIVA</p>
          <p className="text-2xl font-bold text-gray-800">{jornadaActiva ? jornadaActiva.nombre : "Sin jornada activa"}</p>
        </div>
        <div className="bg-white rounded shadow p-4 border-l-4 border-green-500">
          <p className="text-gray-500 text-sm font-semibold">TOTAL PARTICIPANTES</p>
          <p className="text-2xl font-bold text-gray-800">{participantes}</p>
        </div>
        <div className="bg-white rounded shadow p-4 border-l-4 border-purple-500">
          <p className="text-gray-500 text-sm font-semibold">QUINIELAS RECIBIDAS (ACTIVA)</p>
          <p className="text-2xl font-bold text-gray-800">{quinielasActivas}</p>
        </div>
      </div>

      <div className="bg-white rounded shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Participación por Jornada</h2>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={datosGrafica}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nombre" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="quinielas" name="Quinielas" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="survivor" name="Survivor" fill="#db2777" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {jornadaActiva && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">{ausentesQuiniela.length}</span>
                ❌ Faltan Quiniela
              </h2>
            </div>
            {ausentesQuiniela.length > 0 ? (
              <div className="max-h-64 overflow-y-auto pr-2">
                <ul className="space-y-2">
                  {ausentesQuiniela.map((p) => (
                    <li key={p.id} className="flex items-center justify-between p-2 border rounded text-sm bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-red-600 font-bold">•</span>
                        <span className="text-gray-800 font-medium">{getNombreUsuario(p)}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        p.tipo === 'inactivo' ? 'bg-gray-200 text-gray-700' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {p.motivo}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-8 text-green-600 bg-green-50 rounded border border-green-200">
                <p className="font-semibold">✅ ¡Todos han registrado su quiniela!</p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-bold">{ausentesSurvivor.length}</span>
                🦖 Faltan Survivor
              </h2>
            </div>
            {ausentesSurvivor.length > 0 ? (
              <div className="max-h-64 overflow-y-auto pr-2">
                <ul className="space-y-2">
                  {ausentesSurvivor.map((p) => (
                    <li key={p.id} className="flex items-center justify-between p-2 border rounded text-sm bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-600 font-bold">•</span>
                        <span className="text-gray-800 font-medium">{getNombreUsuario(p)}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        p.tipo === 'eliminado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {p.motivo}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-8 text-green-600 bg-green-50 rounded border border-green-200">
                <p className="font-semibold">✅ ¡Todos los no eliminados han registrado su survivor!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {modalPDFAbierto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !exportandoPDF && setModalPDFAbierto(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">📄 Exportar PDF</h3>
              <button
                onClick={() => setModalPDFAbierto(false)}
                disabled={exportandoPDF}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <p className="text-gray-600 mb-4 text-sm">
              Selecciona la jornada que deseas exportar como PDF:
            </p>

            <select
              value={jornadaParaPDF}
              onChange={(e) => setJornadaParaPDF(Number(e.target.value))}
              disabled={exportandoPDF}
              className="w-full border border-gray-300 rounded-md px-3 py-2 mb-6 focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
            >
              {jornadas.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nombre} {j.activa ? "(Activa)" : ""}
                </option>
              ))}
            </select>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModalPDFAbierto(false)}
                disabled={exportandoPDF}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => exportarPDF(jornadaParaPDF)}
                disabled={exportandoPDF || !jornadaParaPDF}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {exportandoPDF ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Generando...
                  </>
                ) : (
                  <>📄 Generar PDF</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}