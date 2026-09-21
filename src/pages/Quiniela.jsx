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
  
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionadaPDF, setJornadaSeleccionadaPDF] = useState("");
  const [cargandoPDF, setCargandoPDF] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  
  const [esSoloSurvivor, setEsSoloSurvivor] = useState(false);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    const validarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/");
    };
    validarSesion();
  }, [navigate]);

  const cargarDatosIniciales = async () => {
    setCargandoPerfil(true);
    const ahora = await obtenerHoraMexico();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("solo_survivor")
        .eq("id", user.id)
        .single();
      setEsSoloSurvivor(perfil?.solo_survivor === true);
    }
    setCargandoPerfil(false);

    const { data: todasJornadas } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: false });

    if (todasJornadas) {
      const cerradas = todasJornadas.filter((j) => {
        if (!j.fecha_limite) return false;
        const limiteQ = new Date(j.fecha_limite);
        const limiteS = j.fecha_limite_survivor ? new Date(j.fecha_limite_survivor) : limiteQ;
        return ahora > limiteQ && ahora > limiteS;
      });
      setJornadas(cerradas);
      if (cerradas.length > 0) setJornadaSeleccionadaPDF(cerradas[0].id.toString());
    }

    const { data: activa } = await supabase
      .from("jornadas")
      .select("*")
      .eq("activa", true)
      .single();

    if (activa) {
      setJornadaActiva(activa);
      await cargarMiQuiniela(activa.id);
      await cargarPartidos(activa.id);

      if (activa.fecha_limite) {
        const limiteQ = new Date(activa.fecha_limite);
        const limiteS = activa.fecha_limite_survivor ? new Date(activa.fecha_limite_survivor) : limiteQ;
        setJornadaCerrada(ahora > limiteQ && ahora > limiteS);
      }
    }
  };

  const cargarPartidos = async (jornadaId) => {
    if (!jornadaId) return;
    const { data, error } = await supabase
      .from("partidos")
      .select("id, jornada_id, jornada_original, local, visitante, resultado, pospuesto, reactivado")
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
    data?.forEach((item) => { nuevosPronosticos[item.partido_id] = item.pronostico; });
    setPronosticos(nuevosPronosticos);
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const actualizarPronostico = (partidoId, valor) => {
    setPronosticos({ ...pronosticos, [partidoId]: valor });
  };

  const guardarQuiniela = async () => {
    if (esSoloSurvivor === true) {
      alert("⚠️ Tu cuenta está configurada solo para jugar Survivor. No puedes guardar quinielas.");
      return;
    }

    const horaMexico = await obtenerHoraMexico();
    const { data: { user } } = await supabase.auth.getUser();

    if (!jornadaActiva) {
      alert("No existe una jornada activa");
      return;
    }

    if (jornadaCerrada) {
      alert("🔒 La jornada ya fue cerrada. No se permiten modificaciones.");
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
      alert(deleteError.message);
      return;
    }

    const { data, error } = await supabase.from("quinielas").insert(registros).select();

    if (error) {
      alert(error.message);
      return;
    }

    setQuinielaGuardada(data || []);
    const nuevosPronosticos = {};
    data?.forEach((item) => { nuevosPronosticos[item.partido_id] = item.pronostico; });
    setPronosticos(nuevosPronosticos);

    alert("✅ Quiniela guardada correctamente");
  };

  const exportarPDF = async () => {
    if (!jornadaSeleccionadaPDF) {
      alert("Por favor selecciona una jornada para descargar.");
      return;
    }

    const jornadaAExportar = jornadas.find((j) => j.id.toString() === jornadaSeleccionadaPDF);

    try {
      setCargandoPDF(true);
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const { data: partidosData } = await supabase
        .from("partidos")
        .select("id, local, visitante, resultado")
        .eq("jornada_id", jornadaSeleccionadaPDF)
        .order("id");

      const { data: quinielasData } = await supabase
        .from("quinielas")
        .select("usuario_id, partido_id, pronostico")
        .eq("jornada_id", jornadaSeleccionadaPDF);

      const { data: perfiles } = await supabase
        .from("profiles")
        .select("id, nombre, nombre_usuario, nombre_completo");

      const usuarios = [...new Set(quinielasData?.map((q) => q.usuario_id) || [])];

      const columnas = [
        "Partido",
        "Resultado",
        ...usuarios.map((usuarioId) => {
          const perfil = perfiles?.find((p) => p.id === usuarioId);
          return perfil?.nombre_usuario || perfil?.nombre || perfil?.nombre_completo || usuarioId;
        }),
      ];

      const aciertos = {};
      usuarios.forEach((usuarioId) => { aciertos[usuarioId] = 0; });

      const filas = (partidosData || []).map((partido) => {
        const fila = [`${partido.local} vs ${partido.visitante}`, partido.resultado || "-"];
        usuarios.forEach((usuarioId) => {
          const pronostico = quinielasData?.find(
            (q) => Number(q.partido_id) === Number(partido.id) && q.usuario_id === usuarioId
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

      const filaTotales = ["TOTAL", "", ...usuarios.map((usuarioId) => aciertos[usuarioId])];
      filas.push(filaTotales);

      const doc = new jsPDF("landscape");
      doc.setFontSize(18);
      doc.text(`Quinielas - ${jornadaAExportar ? jornadaAExportar.nombre : `Jornada ${jornadaSeleccionadaPDF}`}`, 14, 15);

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

  if (cargandoPerfil) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#E2E8F0] text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#F97316] border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-[#111827]">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  const puedeGuardar = !jornadaCerrada;
  const pronosticosCompletados = Object.keys(pronosticos).length;
  const partidosDisponibles = partidos.filter(p => !p.pospuesto || p.reactivado).length;

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-12">
      <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {/* ENCABEZADO */}
        <div className="text-center sm:text-left mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-[#111827] tracking-tight flex items-center justify-center sm:justify-start gap-3">
            <span className="text-[#F97316]">⚽</span> Captura tu Quiniela
          </h1>
          {jornadaActiva && (
            <p className="text-[#64748B] font-medium mt-2 flex items-center justify-center sm:justify-start gap-2 text-lg">
              <span className="bg-[#111827] text-white text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wide">
                {jornadaActiva.nombre}
              </span>
              <span>Jornada activa</span>
            </p>
          )}
        </div>

        {/* COMPONENTE DESTACADO: SURVIVOR */}
        <Link 
          to="/survivor" 
          className="block bg-[#FFF7ED] border-2 border-[#F97316]/20 rounded-2xl p-6 hover:border-[#F97316]/50 hover:shadow-lg hover:shadow-orange-100 transition-all duration-300 group"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="bg-[#F97316] text-white p-3 rounded-xl shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
              </div>
              <div>
                <h3 className="text-[#F97316] font-black text-2xl tracking-tight">SURVIVOR</h3>
                <p className="text-[#111827]/70 text-sm mt-1 font-medium">Participación activa · Elige al equipo que sobrevivirá esta jornada</p>
              </div>
            </div>
            <span className="self-center sm:self-auto bg-[#F97316] text-white px-6 py-3 rounded-xl font-bold text-sm group-hover:translate-x-1 transition-transform duration-300 flex items-center gap-2 shadow-md shadow-orange-200">
              ENTRAR 
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </Link>

        {/* NAVEGACIÓN SECUNDARIA */}
        <nav className="flex flex-wrap items-center justify-center sm:justify-start gap-3 py-2">
          <Link to="/posiciones" className="px-5 py-2.5 text-sm font-bold text-[#64748B] bg-white border border-[#E2E8F0] rounded-xl hover:border-[#2563EB] hover:text-[#2563EB] transition-colors">
            Ranking
          </Link>
          <Link to="/historico" className="px-5 py-2.5 text-sm font-bold text-[#64748B] bg-white border border-[#E2E8F0] rounded-xl hover:border-[#2563EB] hover:text-[#2563EB] transition-colors">
            Histórico
          </Link>
          <Link to="/perfil" className="px-5 py-2.5 text-sm font-bold text-[#64748B] bg-white border border-[#E2E8F0] rounded-xl hover:border-[#2563EB] hover:text-[#2563EB] transition-colors">
            Mi Perfil
          </Link>
          <button 
            onClick={cerrarSesion} 
            className="ml-auto px-5 py-2.5 text-sm font-medium text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            Cerrar Sesión
          </button>
        </nav>

        {/* FECHA DE CIERRE */}
        {jornadaActiva && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-center gap-4">
            <div className="bg-[#2563EB] text-white p-3 rounded-xl shadow-sm shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[#2563EB] font-black text-xs uppercase tracking-widest mb-0.5">Cierre de Jornada</p>
              <p className="text-[#111827] font-bold text-lg">{jornadaActiva.nombre} · {new Date(jornadaActiva.fecha_limite).toLocaleString("es-MX")}</p>
            </div>
          </div>
        )}

        {/* ACCIONES SUPERIORES (PDF Y REGLAS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setMostrarModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-3.5 bg-white border border-[#E2E8F0] text-[#111827] font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Reglas, premios y costos
          </button>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 w-full">
              <label className="block text-xs font-black text-[#64748B] uppercase tracking-wider mb-1.5">
                Descargar quiniela general
              </label>
              <select
                value={jornadaSeleccionadaPDF}
                onChange={(e) => setJornadaSeleccionadaPDF(e.target.value)}
                disabled={jornadas.length === 0}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm text-[#111827] bg-[#F5F7FA] focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all disabled:opacity-50 font-medium"
              >
                {jornadas.length === 0 ? (
                  <option value="">Sin jornadas cerradas</option>
                ) : (
                  jornadas.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nombre} {j.id === jornadaActiva?.id ? "(Actual)" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              onClick={exportarPDF}
              disabled={jornadas.length === 0 || cargandoPDF}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-bold text-white shadow-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                jornadas.length > 0 && !cargandoPDF 
                  ? "bg-[#111827] hover:bg-gray-800 hover:shadow-md" 
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {cargandoPDF ? "Generando..." : "PDF"}
            </button>
          </div>
        </div>

        {/* MODO SOLO SURVIVOR */}
        {esSoloSurvivor ? (
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-8 text-center shadow-sm">
            <div className="text-5xl mb-4">🦖</div>
            <h2 className="text-2xl font-black text-purple-900 mb-3">Modo Solo Survivor Activado</h2>
            <p className="text-purple-800 mb-6 max-w-lg mx-auto leading-relaxed">
              Tu cuenta está configurada para participar <strong>únicamente en el juego de Survivor</strong>. 
              No tienes permitido realizar selecciones de quiniela.
            </p>
            <Link 
              to="/survivor" 
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-purple-200 transition-all transform hover:-translate-y-0.5"
            >
              Ir a mi selección de Survivor
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        ) : (
          <>
            {/* LISTA DE PARTIDOS */}
            <div className="space-y-4 mt-8">
              {partidos.map((partido, index) => {
                const estaPospuesto = partido.pospuesto && !partido.reactivado;
                const estaReactivado = partido.reactivado;
                const tieneResultado = !!partido.resultado;
                const fueMovido = partido.jornada_original && partido.jornada_original !== partido.jornada_id;
                const estaDeshabilitado = jornadaCerrada || tieneResultado || estaPospuesto;

                return (
                  <div 
                    key={partido.id} 
                    className={`relative bg-white rounded-2xl border p-5 sm:p-6 transition-all duration-200 ${
                      estaDeshabilitado 
                        ? "border-[#E2E8F0] bg-gray-50/50" 
                        : "border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-[#F97316]/30"
                    } ${estaReactivado && !tieneResultado ? "ring-2 ring-[#16A34A] ring-offset-2" : ""}`}
                  >
                    {/* Numeración Visual */}
                    <span className="absolute -top-3 -left-3 bg-[#111827] text-white text-xs font-black w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    {/* Encabezado del Partido */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pl-2 sm:pl-0">
                      <h3 className="text-xl sm:text-2xl font-black text-[#111827] text-center sm:text-left tracking-tight">
                        {partido.local.toUpperCase()} <span className="text-[#64748B] font-medium text-lg mx-1">vs</span> {partido.visitante.toUpperCase()}
                      </h3>
                      
                      <div className="flex flex-wrap justify-center sm:justify-end gap-2">
                        {estaPospuesto && !fueMovido && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                            ⏸️ Pospuesto
                          </span>
                        )}
                        {fueMovido && !jornadaCerrada && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            ⚠️ Reprogramado J{partido.jornada_original}
                          </span>
                        )}
                        {estaReactivado && !tieneResultado && !jornadaCerrada && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-[#16A34A] border border-green-200 animate-pulse">
                            ✅ Editable
                          </span>
                        )}
                        {tieneResultado && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-[#2563EB] border border-blue-200">
                            🔒 Resultado capturado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mensaje Pospuesto */}
                    {estaPospuesto && !fueMovido && (
                      <div className="bg-orange-50 border-l-4 border-orange-400 p-3 mb-4 rounded-r-lg text-sm text-orange-800 flex items-start gap-2">
                        <span className="text-lg">ℹ️</span>
                        <span>Este partido fue pospuesto. No puedes hacer pronóstico hasta que sea reactivado en otra jornada.</span>
                      </div>
                    )}
                    
                    {/* Botones de Pronóstico (Radio Buttons Estilizados) */}
                    <div className="grid grid-cols-3 gap-3 pl-2 sm:pl-0">
                      {["L", "E", "V"].map((valor) => {
                        const isSelected = pronosticos[partido.id] === valor;
                        const labels = { L: "LOCAL", E: "EMPATE", V: "VISITANTE" };
                        
                        return (
                          <label 
                            key={valor}
                            className={`relative flex flex-col items-center justify-center py-4 px-2 rounded-xl border-2 font-black text-sm cursor-pointer transition-all duration-200 ${
                              estaDeshabilitado 
                                ? "opacity-60 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400" 
                                : isSelected 
                                  ? "bg-[#F97316] border-[#F97316] text-white shadow-md shadow-orange-200 scale-[1.02]" 
                                  : "bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#F97316]/50 hover:bg-[#FFF7ED]"
                            }`}
                          >
                            {/* Input original oculto pero funcional */}
                            <input 
                              type="radio" 
                              name={`partido-${partido.id}`} 
                              value={valor}
                              checked={isSelected} 
                              onChange={() => actualizarPronostico(partido.id, valor)} 
                              disabled={estaDeshabilitado} 
                              className="sr-only" 
                            />
                            <span className="tracking-wider">{labels[valor]}</span>
                            {isSelected && (
                              <span className="absolute top-2 right-2 text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ALERTA JORNADA CERRADA */}
            {jornadaCerrada && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800 font-bold mt-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>La jornada activa ya fue cerrada. Todos los pronósticos están bloqueados.</span>
              </div>
            )}

            {/* SECCIÓN DE GUARDADO */}
            <div className="pt-6 pb-8 text-center">
              {puedeGuardar && (
                <p className="text-[#64748B] font-medium mb-4 flex items-center justify-center gap-2">
                  <span className="bg-[#16A34A] text-white text-xs font-bold px-2 py-0.5 rounded-full">{pronosticosCompletados}</span>
                  de {partidosDisponibles} pronósticos completados
                </p>
              )}
              <button
                disabled={!puedeGuardar}
                onClick={guardarQuiniela}
                className={`w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl font-black text-lg shadow-lg transition-all duration-200 transform ${
                  puedeGuardar 
                    ? "bg-[#F97316] hover:bg-orange-600 text-white hover:shadow-orange-200 hover:-translate-y-0.5" 
                    : "bg-gray-300 text-gray-500 cursor-not-allowed shadow-none"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                GUARDAR QUINIELA
              </button>
            </div>

            {/* RESUMEN DE PRONÓSTICOS ENVIADOS */}
            {quinielaGuardada.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden mt-8">
                <div className="bg-[#F5F7FA] px-6 py-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h2 className="text-lg font-black text-[#111827] flex items-center gap-2">
                    <span className="text-[#16A34A]">✓</span> Mis Pronósticos Enviados
                  </h2>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-[#111827] text-white">
                    {quinielaGuardada.length} / {partidosDisponibles} enviados
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white text-[#64748B] text-xs font-black uppercase tracking-wider border-b border-[#E2E8F0]">
                        <th className="px-6 py-4">Partido</th>
                        <th className="px-6 py-4 text-center">Tu Pronóstico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {quinielaGuardada.map((item) => {
                        const partido = partidos.find((p) => String(p.id) === String(item.partido_id));
                        let badgeColor = "bg-gray-100 text-gray-700";
                        let badgeText = "Empate";
                        
                        if (item.pronostico === "L") { badgeColor = "bg-blue-100 text-[#2563EB]"; badgeText = "Local"; }
                        if (item.pronostico === "V") { badgeColor = "bg-orange-100 text-[#F97316]"; badgeText = "Visitante"; }

                        return (
                          <tr key={item.id} className="hover:bg-[#F5F7FA] transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-[#111827]">
                                {partido ? `${partido.local} vs ${partido.visitante}` : "Partido no encontrado"}
                              </p>
                              {partido?.jornada_original && partido.jornada_original !== partido.jornada_id && (
                                <span className="inline-block mt-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  Reprogramado de J{partido.jornada_original}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center px-4 py-1.5 rounded-lg text-sm font-black ${badgeColor}`}>
                                {badgeText}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL DE REGLAS */}
      {mostrarModal && (
        <div 
          className="fixed inset-0 bg-[#111827]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity" 
          onClick={() => setMostrarModal(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-200" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setMostrarModal(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors" 
              aria-label="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="p-6 sm:p-8">
              <div className="text-center mb-8">
                <span className="text-4xl mb-2 block">📜</span>
                <h2 className="text-2xl font-black text-[#111827]">Reglas, Premios y Costos</h2>
                <div className="h-1.5 w-20 bg-[#F97316] mx-auto mt-3 rounded-full"></div>
              </div>
              
              <div className="space-y-6">
                <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                  <h3 className="text-lg font-black text-green-900 mb-4 flex items-center gap-2">
                    🏆 Pronósticos y Premios
                  </h3>
                  <ul className="space-y-3 text-green-800 font-medium">
                    <li className="flex items-start gap-3">
                      <span className="font-black mt-0.5 text-[#16A34A]">•</span>
                      <span>Premio semanal de <strong>$180.00</strong>.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-black mt-0.5 text-[#16A34A]">•</span>
                      <span>Ganador de liguilla se lleva <strong>$250.00</strong>.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-black mt-0.5 text-[#16A34A]">•</span>
                      <span>Se elimina el ganador a 4to lugar.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-black mt-0.5 text-[#16A34A]">•</span>
                      <span>Primer Lugar gana <strong>$3,620.00</strong>.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-black mt-0.5 text-[#16A34A]">•</span>
                      <span>Segundo Lugar gana <strong>$1,300.00</strong>.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-black mt-0.5 text-[#16A34A]">•</span>
                      <span>Tercer Lugar gana <strong>$550.00</strong>.</span>
                    </li>
                  </ul>
                  <p className="text-xs text-green-700 mt-4 italic text-right border-t border-green-200 pt-3 font-medium">
                    *(Valores calculados sobre 32 jugadores)*
                  </p>
                </div>

                <div className="bg-[#F5F7FA] rounded-2xl p-6 border border-[#E2E8F0]">
                  <h3 className="text-lg font-black text-[#111827] mb-4 flex items-center gap-2">
                    📋 Reglas del Juego
                  </h3>
                  <ul className="space-y-4 text-[#111827] font-medium">
                    <li className="flex items-start gap-3">
                      <span className="bg-[#F97316] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">1</span>
                      <span>Cada jornada el participante hará la selección de sus pronósticos: <strong>Local, Empate o Visitante</strong>.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="bg-[#F97316] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">2</span>
                      <span>Se llevará un <strong>ranking semanal</strong>.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="bg-[#F97316] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">3</span>
                      <span>Los aciertos semanales se sumarán al acumulado de pronósticos acertados.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="bg-[#F97316] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">4</span>
                      <span>En esta aplicación, se tiene un <strong>cronómetro para el inicio de la jornada</strong>.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 text-center">
                <button 
                  onClick={() => setMostrarModal(false)} 
                  className="w-full sm:w-auto bg-[#111827] hover:bg-gray-800 text-white font-black px-8 py-3.5 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                  Entendido, ¡a jugar! ⚽
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}