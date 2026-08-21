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
    const rol = (p.rol || "").toLowerCase();
    const email = (p.email || "").toLowerCase();
    const nombre = (p.nombre_usuario || p.nombre || "").toLowerCase();
    return rol === "admin" || email.includes("admin") || nombre.includes("admin") || email.includes("root");
  };

  //---------------------------------------
  // CARGA OPTIMIZADA Y BLINDADA DEL DASHBOARD
  //---------------------------------------
  const cargarDashboard = async () => {
    console.log("🚨🚨🚨 VERSIÓN BLINDADA CON ORDER DESC ACTIVADA 🚨🚨🚨");
    
    setCargando(true);
    const t0 = performance.now();

    try {
      const ahora = await obtenerHoraMexico();

      // ✅ SOLUCIÓN BLINDADA: Ordenar de más reciente a más antiguo + rango amplio
      // Esto garantiza que los registros de la Jornada 29 (la más reciente) lleguen primero
      const [
        jornadasRes,
        jornadaActivaRes,
        participantesRes,
        perfilesRes,
        quinielasRes,
        survivorRes,
        partidosRes
      ] = await Promise.all([
        supabase.from("jornadas").select("id, nombre, activa, fecha_limite").order("id", { ascending: true }),
        supabase.from("jornadas").select("id, nombre").eq("activa", true).single(),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("id, nombre, nombre_usuario, email, rol, solo_survivor"),
        
        supabase.from("quinielas")
          .select("jornada_id, usuario_id, partido_id, pronostico", { count: "exact" })
          .order("id", { ascending: false }) 
          .range(0, 5000),
          
        supabase.from("survivor")
          .select("jornada_id, usuario_id, equipo")
          .order("id", { ascending: false })
          .range(0, 5000),
          
        supabase.from("partidos")
          .select("id, jornada_id, local, visitante, resultado")
          .order("id", { ascending: false })
          .range(0, 5000)
      ]);

      const jornadasData = jornadasRes.data || [];
      const jornadaActivaData = jornadaActivaRes.data;
      const perfilesData = perfilesRes.data || [];
      const todasQuinielas = quinielasRes.data || [];
      const todosSurvivor = survivorRes.data || [];
      const todosPartidos = partidosRes.data || [];

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
      
      // Logs de verificación final para confirmar que el límite ya no es un problema
      console.log("🔍 Total de filas que dice Supabase que existen:", quinielasRes.count);
      console.log("🔍 Total de filas que REALMENTE llegaron al navegador:", todasQuinielas.length);

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

      const partidosDeJornada = todosPartidos.filter(p => String(p.jornada_id) === String(jornadaId));
      const quinielasDeJornada = todasQuinielas.filter(q => String(q.jornada_id) === String(jornadaId));
      const survivorDeJornada = todosSurvivor.filter(s => String(s.jornada_id) === String(jornadaId));

      perfilesData.forEach(usuario => {
        if (esAdmin(usuario)) return;
        const reg = acumulado[usuario.id];
        if (!reg) return;

        const esJugadorSurvivor = usuariosQueJueganSurvivor.has(usuario.id);

        // --- QUINIELA ---
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

        // --- SURVIVOR ---
        if (!esJugadorSurvivor) return;

        const seleccionSurvivor = survivorDeJornada.find(s => s.usuario_id === usuario.id);
        if (seleccionSurvivor && seleccionSurvivor.equipo) {
          reg.survivorEnviados++;
          survivorPorJornadaCount[jornadaId].add(usuario.id);
          if (esPasadaYCerrada) {
            const partido = partidosDeJornada.find(p => p.local === seleccionSurvivor.equipo || p.visitante === seleccionSurvivor.equipo);
            if (partido?.resultado) {
              let perdio = false;
              if (partido.local === seleccionSurvivor.equipo && partido.resultado === "V") perdio = true;
              if (partido.visitante === seleccionSurvivor.equipo && partido.resultado === "L") perdio = true;
              if (perdio && reg.vidas < 3) reg.vidas++;
            }
          }
        } else if (esPasadaYCerrada && reg.vidas < 3) {
          reg.vidas++;
        }
      });
    });

    const rankingQuinielas = Object.values(acumulado)
      .filter(u => !u.soloSurvivor)
      .sort((a, b) => {
        if (a.vidas !== b.vidas) return a.vidas - b.vidas;
        if (b.totalAciertos !== a.totalAciertos) return b.totalAciertos - a.totalAciertos;
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

      console.log("🔍 Debug - Jornada activa ID:", idJornadaActiva);
      console.log("🔍 Debug - Quinielas filtradas para jornada activa:", quinielasDeJornadaActiva.length);
      console.log("🔍 Debug - Usuarios únicos en jornada activa:", quinielasActivaSet.size);

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

      ausentesSurvivor = perfilesData
        .filter(p => {
          if (esAdmin(p)) return false;
          if (!usuariosQueJueganSurvivor.has(p.id)) return false;
          if (survivorActivaSet.has(p.id)) return false;
          return true;
        })
        .map(p => {
          const reg = acumulado[p.id];
          let motivo = "Falta en jornada actual";
          let tipo = "normal";
          if (reg.vidas >= 3) {
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
        <tr style="background-color: #e5e7eb;">
          <th style="border: 1px solid #9ca3af; padding: 8px; text-align: center; width: 50px;">Pos</th>
          <th style="border: 1px solid #9ca3af; padding: 8px; text-align: left; width: 150px;">Usuario</th>
      `;

      jornadasSecuenciales.forEach(jornadaSec => {
        encabezadosHTML += `<th style="border: 1px solid #9ca3af; padding: 8px; text-align: center; width: 50px;">${jornadaSec.nombre}</th>`;
      });
      encabezadosHTML += `<th style="border: 1px solid #9ca3af; padding: 8px; text-align: center; width: 70px; background-color: #d1d5db; font-weight: bold;">TOTAL</th></tr>`;
      thead.innerHTML = encabezadosHTML;
      tabla.appendChild(thead);

      const tbody = document.createElement('tbody');
      rankingQuinielas.forEach((fila, index) => {
        let bgColor = '#ffffff';
        if (fila.vidas >= 3) bgColor = '#ef4444';
        else if (fila.vidas === 2) bgColor = '#fbbf24';
        else if (index < 3) bgColor = '#22c55e';

        const tr = document.createElement('tr');
        tr.style.backgroundColor = bgColor;

        let filaHTML = `
          <td style="border: 1px solid #9ca3af; padding: 8px; text-align: center; font-weight: bold;">${index + 1}</td>
          <td style="border: 1px solid #9ca3af; padding: 8px; font-weight: 600;">${fila.nombre}</td>
        `;

        jornadasSecuenciales.forEach(jornadaSec => {
          const aciertos = fila.aciertosPorJornada[jornadaSec.numero] || 0;
          filaHTML += `<td style="border: 1px solid #9ca3af; padding: 8px; text-align: center;">${aciertos}</td>`;
        });
        filaHTML += `<td style="border: 1px solid #9ca3af; padding: 8px; text-align: center; font-weight: bold; background-color: #d1d5db;">${fila.totalAciertos}</td></tr>`;
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

        <button onClick={exportarPDF} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">📄 Exportar PDF</button>
        
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
    </div>
  );
}