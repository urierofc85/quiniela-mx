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

  // Estados para ranking de quinielas
  const [rankingQuinielas, setRankingQuinielas] = useState([]);
  const [tipoExportacion, setTipoExportacion] = useState("jornada");

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

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    window.location.replace("/");
  };

  const esAdmin = (p) => {
    const email = (p.email || "").toLowerCase();
    const nombre = (p.nombre_usuario || p.nombre || "").toLowerCase();
    return email.includes("admin") || nombre.includes("admin") || email.includes("root");
  };

  const cargarDashboard = async () => {
    const ahora = await obtenerHoraMexico();

    const { data: jornadasData } = await supabase.from("jornadas").select("*").order("id", { ascending: true });
    setJornadas(jornadasData || []);

    const { data: jornadaActivaData } = await supabase.from("jornadas").select("*").eq("activa", true).single();
    setJornadaActiva(jornadaActivaData);
    if (jornadaActivaData) setJornadaSeleccionada(jornadaActivaData.id);

    const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    setParticipantes(count || 0);

    const { data: perfilesData } = await supabase.from("profiles").select("id, nombre, nombre_usuario, email");
    const { data: todasQuinielas } = await supabase.from("quinielas").select("jornada_id, usuario_id, partido_id, pronostico");
    const { data: todosSurvivor } = await supabase.from("survivor").select("jornada_id, usuario_id, equipo");
    const { data: todosPartidos } = await supabase.from("partidos").select("jornada_id, id, local, visitante, resultado");

    prepararDatosGrafica(jornadasData, jornadaActivaData?.id, todasQuinielas, todosSurvivor);

    if (jornadaActivaData && perfilesData) {
      calcularAusentesInteligentes(
        jornadaActivaData.id,
        jornadasData,
        perfilesData,
        todasQuinielas,
        todosSurvivor,
        todosPartidos,
        ahora
      );
    }

    if (perfilesData && todasQuinielas && todosPartidos) {
      await calcularRankingQuinielas(perfilesData, todasQuinielas, todosPartidos, jornadasData);
    }
  };

  const prepararDatosGrafica = (jornadasData, idJornadaActiva, todasQuinielas, todosSurvivor) => {
    const datos = (jornadasData || []).map((jornada) => {
      const qJornada = (todasQuinielas || []).filter(q => Number(q.jornada_id) === Number(jornada.id));
      const sJornada = (todosSurvivor || []).filter(s => Number(s.jornada_id) === Number(jornada.id));
      
      return {
        nombre: jornada.nombre || `J${jornada.id}`,
        quinielas: new Set(qJornada.map(q => q.usuario_id)).size,
        survivor: new Set(sJornada.map(s => s.usuario_id)).size,
      };
    });
    setDatosGrafica(datos);
  };

  const calcularRankingQuinielas = async (perfilesData, todasQuinielas, todosPartidos, jornadasData) => {
    const acumulado = {};

    // Inicializar todos los participantes
    perfilesData.forEach((usuario) => {
      if (esAdmin(usuario)) return;
      
      const nombre = usuario.nombre_usuario || usuario.nombre || "Sin nombre";
      acumulado[usuario.id] = {
        usuario_id: usuario.id,
        nombre,
        aciertosPorJornada: {},
        totalAciertos: 0,
        vidas: 0,
      };

      // Inicializar aciertos por jornada en 0
      jornadasData.forEach(jornada => {
        acumulado[usuario.id].aciertosPorJornada[jornada.id] = 0;
      });
    });

    // Calcular aciertos por jornada para cada usuario
    todasQuinielas?.forEach(quiniela => {
      const usuarioId = quiniela.usuario_id;
      const jornadaId = quiniela.jornada_id;
      const partidoId = quiniela.partido_id;
      const pronostico = quiniela.pronostico;

      if (!acumulado[usuarioId]) return;

      // Buscar el partido y su resultado
      const partido = todosPartidos.find(p => 
        Number(p.id) === Number(partidoId) && 
        Number(p.jornada_id) === Number(jornadaId)
      );

      if (partido && partido.resultado && pronostico === partido.resultado) {
        acumulado[usuarioId].aciertosPorJornada[jornadaId] = 
          (acumulado[usuarioId].aciertosPorJornada[jornadaId] || 0) + 1;
        acumulado[usuarioId].totalAciertos += 1;
      }
    });

    // Calcular vidas perdidas (jornadas cerradas sin quiniela)
    const ahora = await obtenerHoraMexico();
    jornadasData.forEach(jornada => {
      const esPasadaYCerrada = jornada.fecha_limite ? ahora > new Date(jornada.fecha_limite) : false;
      
      if (esPasadaYCerrada) {
        perfilesData.forEach(usuario => {
          if (esAdmin(usuario)) return;
          
          const tieneQuiniela = todasQuinielas?.some(q => 
            q.usuario_id === usuario.id && Number(q.jornada_id) === Number(jornada.id)
          );

          if (!tieneQuiniela && acumulado[usuario.id].vidas < 3) {
            acumulado[usuario.id].vidas += 1;
          }
        });
      }
    });

    // Ordenar: primero por menos vidas, luego por más aciertos
    const rankingFinal = Object.values(acumulado).sort((a, b) => {
      if (a.vidas !== b.vidas) return a.vidas - b.vidas;
      if (b.totalAciertos !== a.totalAciertos) return b.totalAciertos - a.totalAciertos;
      return a.nombre.localeCompare(b.nombre);
    });

    setRankingQuinielas(rankingFinal);
  };

  const calcularAusentesInteligentes = (idJornadaActiva, jornadasData, perfilesData, todasQuinielas, todosSurvivor, todosPartidos, ahora) => {
    const jornadasHastaActiva = jornadasData.filter(j => j.id <= idJornadaActiva).length;
    
    const quinielasCount = {};
    const vidasPerdidas = {};

    perfilesData.forEach(p => {
      quinielasCount[p.id] = 0;
      vidasPerdidas[p.id] = 0;
    });

    todasQuinielas?.forEach(q => {
      if (q.jornada_id <= idJornadaActiva) {
        quinielasCount[q.usuario_id] = (quinielasCount[q.usuario_id] || 0) + 1;
      }
    });

    jornadasData.filter(j => j.id <= idJornadaActiva).forEach(jornada => {
      const esPasadaYCerrada = jornada.fecha_limite ? ahora > new Date(jornada.fecha_limite) : false;

      perfilesData.forEach(usuario => {
        const seleccion = todosSurvivor?.find(s => s.usuario_id === usuario.id && Number(s.jornada_id) === Number(jornada.id));

        if (!seleccion && esPasadaYCerrada) {
          if (vidasPerdidas[usuario.id] < 3) vidasPerdidas[usuario.id] += 1;
          return;
        }

        if (seleccion) {
          const partido = todosPartidos?.find(p => 
            Number(p.jornada_id) === Number(jornada.id) && 
            (p.local === seleccion.equipo || p.visitante === seleccion.equipo)
          );

          if (partido?.resultado) {
            let perdio = false;
            if (partido.local === seleccion.equipo && partido.resultado === "V") perdio = true;
            if (partido.visitante === seleccion.equipo && partido.resultado === "L") perdio = true;

            if (perdio && vidasPerdidas[usuario.id] < 3) {
              vidasPerdidas[usuario.id] += 1;
            }
          }
        }
      });
    });

    const quinielasActivaIds = new Set(todasQuinielas?.filter(q => q.jornada_id === idJornadaActiva).map(q => q.usuario_id) || []);
    const survivorActivaIds = new Set(todosSurvivor?.filter(s => s.jornada_id === idJornadaActiva).map(s => s.usuario_id) || []);

    const ausentesQ = perfilesData.filter(p => {
      if (esAdmin(p)) return false;
      if (!quinielasActivaIds.has(p.id)) {
        const totalQ = quinielasCount[p.id] || 0;
        const jornadasFaltadas = jornadasHastaActiva - totalQ;
        return jornadasFaltadas <= 1;
      }
      return false;
    });

    const ausentesS = perfilesData.filter(p => {
      if (esAdmin(p)) return false;
      if (!survivorActivaIds.has(p.id)) {
        return (vidasPerdidas[p.id] || 0) < 3;
      }
      return false;
    });

    setAusentesQuiniela(ausentesQ);
    setAusentesSurvivor(ausentesS);
    setQuinielasActivas(quinielasActivaIds.size);
  };

  const getNombreUsuario = (p) => {
    return p.nombre_usuario || p.nombre || (p.email ? p.email.split('@')[0] : 'Usuario');
  };

  //---------------------------------------
  // EXPORTAR A IMAGEN (JPEG) - QUINIELAS
  //---------------------------------------
  const exportarImagen = async (tipo) => {
    try {
      const contenedorTemp = document.createElement('div');
      contenedorTemp.style.position = 'fixed';
      contenedorTemp.style.top = '0';
      contenedorTemp.style.left = '0';
      contenedorTemp.style.width = '1400px';
      contenedorTemp.style.background = 'white';
      contenedorTemp.style.padding = '40px';
      contenedorTemp.style.boxShadow = '0 0 20px rgba(0,0,0,0.1)';
      contenedorTemp.style.zIndex = '9999';
      
      // Título
      const titulo = document.createElement('h2');
      if (tipo === "acumulado") {
        titulo.textContent = '🏆 Ranking Acumulado General - Quinielas';
      } else {
        const jornada = jornadas.find(j => j.id === jornadaSeleccionada);
        titulo.textContent = `📊 Quiniela - ${jornada?.nombre || 'Jornada'}`;
      }
      titulo.style.fontSize = '28px';
      titulo.style.fontWeight = 'bold';
      titulo.style.marginBottom = '20px';
      titulo.style.textAlign = 'center';
      contenedorTemp.appendChild(titulo);

      // Tabla
      const tabla = document.createElement('table');
      tabla.style.width = '100%';
      tabla.style.borderCollapse = 'collapse';
      tabla.style.fontSize = '13px';

      // Encabezados
      const thead = document.createElement('thead');
      let encabezadosHTML = `
        <tr style="background-color: #e5e7eb;">
          <th style="border: 1px solid #9ca3af; padding: 8px; text-align: center; width: 50px;">Pos</th>
          <th style="border: 1px solid #9ca3af; padding: 8px; text-align: left; width: 150px;">Usuario</th>
      `;

      if (tipo === "acumulado") {
        // Mostrar todas las jornadas
        jornadas.forEach(jornada => {
          encabezadosHTML += `<th style="border: 1px solid #9ca3af; padding: 8px; text-align: center; width: 50px;">J${jornada.id}</th>`;
        });
        encabezadosHTML += `<th style="border: 1px solid #9ca3af; padding: 8px; text-align: center; width: 70px; background-color: #d1d5db;">TOTAL</th>`;
      } else {
        // Solo mostrar la jornada seleccionada
        const jornada = jornadas.find(j => j.id === jornadaSeleccionada);
        encabezadosHTML += `<th style="border: 1px solid #9ca3af; padding: 8px; text-align: center; width: 70px; background-color: #d1d5db;">J${jornada?.id || ''}</th>`;
      }

      encabezadosHTML += `</tr>`;
      thead.innerHTML = encabezadosHTML;
      tabla.appendChild(thead);

      // Filas
      const tbody = document.createElement('tbody');
      
      // Filtrar ranking según tipo
      let rankingMostrar = rankingQuinielas;
      if (tipo === "jornada") {
        // Para jornada individual, mostrar todos los que participaron
        rankingMostrar = rankingQuinielas.filter(r => 
          r.aciertosPorJornada[jornadaSeleccionada] > 0 || r.vidas < 3
        );
      }

      rankingMostrar.forEach((fila, index) => {
        let bgColor = '#ffffff';
        if (fila.vidas >= 3) bgColor = '#ef4444'; // Rojo - eliminado
        else if (fila.vidas === 2) bgColor = '#fbbf24'; // Amarillo
        else if (index < 3) bgColor = '#22c55e'; // Verde - top 3

        const tr = document.createElement('tr');
        tr.style.backgroundColor = bgColor;

        let filaHTML = `
          <td style="border: 1px solid #9ca3af; padding: 8px; text-align: center; font-weight: bold;">${index + 1}</td>
          <td style="border: 1px solid #9ca3af; padding: 8px; font-weight: 600;">${fila.nombre}</td>
        `;

        if (tipo === "acumulado") {
          // Mostrar aciertos por cada jornada
          jornadas.forEach(jornada => {
            const aciertos = fila.aciertosPorJornada[jornada.id] || 0;
            filaHTML += `<td style="border: 1px solid #9ca3af; padding: 8px; text-align: center;">${aciertos}</td>`;
          });
          // Total
          filaHTML += `<td style="border: 1px solid #9ca3af; padding: 8px; text-align: center; font-weight: bold; background-color: #d1d5db;">${fila.totalAciertos}</td>`;
        } else {
          // Solo mostrar la jornada seleccionada
          const aciertos = fila.aciertosPorJornada[jornadaSeleccionada] || 0;
          filaHTML += `<td style="border: 1px solid #9ca3af; padding: 8px; text-align: center; font-weight: bold; background-color: #d1d5db;">${aciertos}</td>`;
        }

        filaHTML += `</tr>`;
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
      
      if (tipo === "acumulado") {
        link.download = `Ranking_Acumulado_Quinielas.jpg`;
      } else {
        const jornada = jornadas.find(j => j.id === jornadaSeleccionada);
        link.download = `Quiniela_${jornada?.nombre || 'Jornada'}.jpg`;
      }
      
      link.href = imagenData;
      link.click();
      
    } catch (error) {
      console.error("Error al exportar:", error);
      alert("Error al generar la imagen: " + error.message);
    }
  };

  //---------------------------------------
  // EXPORTAR PDF
  //---------------------------------------
  const exportarPDF = async () => {
    if (!jornadaSeleccionada) {
      alert("Selecciona una jornada.");
      return;
    }

    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const { data: jornadaActivaPDF } = await supabase.from("jornadas").select("*").eq("id", jornadaSeleccionada).single();
    const { data: partidos } = await supabase.from("partidos").select("id, local, visitante, resultado").eq("jornada_id", jornadaSeleccionada).order("id");
    const { data: quinielasData } = await supabase.from("quinielas").select("usuario_id, partido_id, pronostico").eq("jornada_id", jornadaSeleccionada);
    const { data: perfiles } = await supabase.from("profiles").select("id, nombre, nombre_usuario, nombre_completo");

    const usuarios = [...new Set(quinielasData?.map(q => q.usuario_id) || [])];
    const columnas = ["Partido", "Resultado", ...usuarios.map(usuarioId => {
      const perfil = perfiles?.find(p => p.id === usuarioId);
      return perfil?.nombre_usuario || perfil?.nombre || perfil?.nombre_completo || usuarioId;
    })];

    const aciertos = {};
    usuarios.forEach(usuarioId => { aciertos[usuarioId] = 0; });

    const filas = (partidos || []).map(partido => {
      const fila = [`${partido.local} vs ${partido.visitante}`, partido.resultado || "-"];
      usuarios.forEach(usuarioId => {
        const pronostico = quinielasData?.find(q => Number(q.partido_id) === Number(partido.id) && q.usuario_id === usuarioId);
        let valor = "-";
        if (pronostico) {
          valor = pronostico.pronostico;
          if (partido.resultado && pronostico.pronostico === partido.resultado) aciertos[usuarioId]++;
        }
        fila.push(valor);
      });
      return fila;
    });

    const filaTotales = ["TOTAL", "", ...usuarios.map(usuarioId => aciertos[usuarioId])];
    filas.push(filaTotales);

    const doc = new jsPDF("landscape");
    doc.setFontSize(18);
    doc.text(`Quinielas - ${jornadaActivaPDF?.nombre || 'Jornada'}`, 14, 15);

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
        if (fila[1] !== "-" && fila[1] !== null && data.cell.raw === fila[1]) {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    doc.save(`Quinielas_${jornadaActivaPDF?.nombre || 'Jornada'}.pdf`);
  };

  //---------------------------------------
  // INTERFAZ
  //---------------------------------------
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

        <select
          value={tipoExportacion}
          onChange={(e) => setTipoExportacion(e.target.value)}
          className="border rounded px-3 py-2 bg-white"
        >
          <option value="jornada"> Por Jornada</option>
          <option value="acumulado"> Acumulado General</option>
        </select>

        <button 
          onClick={() => exportarImagen(tipoExportacion)} 
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
        >
          📸 Exportar Imagen Quinielas (JPEG)
        </button>

        <button onClick={exportarPDF} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">📄 Exportar PDF</button>
        
        <Link to="/admin" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Crear Jornada</Link>
        <Link to="/partidos" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition">Crear Partidos</Link>
        <Link to="/admin/resultados" className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition">Capturar Resultados</Link>
        <Link to="/posiciones" className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition">Ranking</Link>
        <Link to="/admin-survivor" className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700 transition"> Admin Survivor</Link>
        <Link to="/acceso-pronosticos" className="bg-cyan-600 text-white px-4 py-2 rounded hover:bg-cyan-700 transition">🔒 Pronósticos Privados</Link>
        <button onClick={cerrarSesion} className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800 transition">🚪 Cerrar Sesión</button>
      </div>

      {/* TARJETAS DE RESUMEN */}
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

      {/* GRÁFICA DINÁMICA */}
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

      {/* SECCIÓN DE AUSENTES EN JORNADA ACTIVA */}
      {jornadaActiva && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">{ausentesQuiniela.length}</span>
                 Faltan Quiniela
              </h2>
            </div>
            {ausentesQuiniela.length > 0 ? (
              <div className="max-h-64 overflow-y-auto pr-2">
                <ul className="space-y-2">
                  {ausentesQuiniela.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                      <span className="text-red-600 font-bold">•</span>
                      <span className="text-gray-800 font-medium">{getNombreUsuario(p)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-8 text-green-600 bg-green-50 rounded border border-green-200">
                <p className="font-semibold">✅ ¡Todos los activos han registrado su quiniela!</p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-bold">{ausentesSurvivor.length}</span>
                 Faltan Survivor
              </h2>
            </div>
            {ausentesSurvivor.length > 0 ? (
              <div className="max-h-64 overflow-y-auto pr-2">
                <ul className="space-y-2">
                  {ausentesSurvivor.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                      <span className="text-orange-600 font-bold">•</span>
                      <span className="text-gray-800 font-medium">{getNombreUsuario(p)}</span>
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
    </div>
  );
}