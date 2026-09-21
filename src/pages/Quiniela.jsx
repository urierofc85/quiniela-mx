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
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#F97316] border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-[#111827]">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  const puedeGuardar = !jornadaCerrada;

  return (
    <div className="min-h-screen bg-[#F4F6F8] pb-12">
      {/* HEADER MODERNO */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight flex items-center gap-2">
                <span className="text-[#F97316]">⚽</span> Captura tu Quiniela
              </h1>
              {jornadaActiva && (
                <p className="text-[#64748B] font-medium mt-1 flex items-center gap-2">
                  <span className="bg-[#F97316] text-white text-xs font-bold px-2 py-0.5 rounded-md">
                    {jornadaActiva.nombre}
                  </span>
                  <span>Jornada Activa</span>
                </p>
              )}
            </div>
            
            {/* NAVEGACIÓN COMPACTA */}
            <nav className="flex flex-wrap items-center gap-2">
              <Link to="/posiciones" className="px-4 py-2 text-sm font-semibold text-[#111827] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Ranking
              </Link>
              <Link to="/historico" className="px-4 py-2 text-sm font-semibold text-[#111827] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Histórico
              </Link>
              <Link to="/perfil" className="px-4 py-2 text-sm font-semibold text-[#111827] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Mi Perfil
              </Link>
              <Link to="/survivor" className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg shadow-sm transition-colors">
                Survivor
              </Link>
              <button 
                onClick={cerrarSesion} 
                className="px-4 py-2 text-sm font-medium text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
              >
                Cerrar Sesión
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {/* ACCIONES SUPERIORES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setMostrarModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-200 text-[#111827] font-semibold rounded-xl shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
          >
            <span>📋</span> Reglas, premios y costos
          </button>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                Descargar quiniela general
              </label>
              <select
                value={jornadaSeleccionadaPDF}
                onChange={(e) => setJornadaSeleccionadaPDF(e.target.value)}
                disabled={jornadas.length === 0}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#111827] bg-gray-50 focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all disabled:opacity-50"
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
              {cargandoPDF ? "Generando..." : "📄 Descargar PDF"}
            </button>
          </div>
        </div>

        {/* ALERTA DE FECHA LÍMITE */}
        {jornadaActiva && (
          <div className={`rounded-xl p-4 flex items-start sm:items-center gap-4 border transition-colors ${
            jornadaCerrada 
              ? "bg-red-50 border-red-100" 
              : "bg-blue-50 border-blue-100"
          }`}>
            <div className={`p-2 rounded-full ${jornadaCerrada ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className={`text-sm font-bold ${jornadaCerrada ? "text-red-800" : "text-blue-900"}`}>
                {jornadaCerrada ? "Jornada Cerrada" : "Cierre de jornada"}
              </p>
              <p className={`text-sm ${jornadaCerrada ? "text-red-700" : "text-blue-700"}`}>
                {jornadaActiva.nombre} · {new Date(jornadaActiva.fecha_limite).toLocaleString("es-MX")}
              </p>
            </div>
          </div>
        )}

        {/* MODO SOLO SURVIVOR */}
        {esSoloSurvivor ? (
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-8 text-center shadow-sm">
            <div className="text-5xl mb-4">🦖</div>
            <h2 className="text-2xl font-bold text-purple-900 mb-3">Modo Solo Survivor Activado</h2>
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
            <div className="space-y-4">
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
                        ? "border-gray-100 bg-gray-50/50" 
                        : "border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300"
                    } ${estaReactivado && !tieneResultado ? "ring-2 ring-[#22C55E] ring-offset-2" : ""}`}
                  >
                    {/* Numeración Visual */}
                    <span className="absolute -top-3 -left-3 bg-[#111827] text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    {/* Encabezado del Partido */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                      <h3 className="text-xl sm:text-2xl font-black text-[#111827] text-center sm:text-left tracking-tight">
                        {partido.local.toUpperCase()} <span className="text-[#64748B] font-medium text-lg">vs</span> {partido.visitante.toUpperCase()}
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
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200 animate-pulse">
                            ✅ Editable
                          </span>
                        )}
                        {tieneResultado && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            🔒 Resultado Capturado
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
                    
                    {/* Botones de Pronóstico */}
                    <div className="grid grid-cols-3 gap-3">
                      {["L", "E", "V"].map((valor) => {
                        const isSelected = pronosticos[partido.id] === valor;
                        const labels = { L: "LOCAL", E: "EMPATE", V: "VISITANTE" };
                        
                        return (
                          <label 
                            key={valor}
                            className={`relative flex flex-col items-center justify-center py-4 px-2 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                              estaDeshabilitado 
                                ? "opacity-60 cursor-not-allowed bg-gray-100 border-gray-200" 
                                : isSelected 
                                  ? "border-[#F97316] bg-orange-50 text-[#F97316] shadow-sm scale-[1.02]" 
                                  : "border-gray-200 bg-white text-[#64748B] hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <input 
                              type="radio" 
                              name={`partido-${partido.id}`} 
                              value={valor}
                              checked={isSelected} 
                              onChange={() => actualizarPronostico(partido.id, valor)} 
                              disabled={estaDeshabilitado} 
                              className="sr-only" 
                            />
                            <span className="text-xs font-bold tracking-wider mb-1">{labels[valor]}</span>
                            {isSelected && (
                              <span className="absolute top-2 right-2 text-[#F97316]">
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
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800 font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>La jornada activa ya fue cerrada. Todos los pronósticos están bloqueados.</span>
              </div>
            )}

            {/* BOTÓN GUARDAR (CTA PRINCIPAL) */}
            <div className="pt-4 pb-8">
              <button
                disabled={!puedeGuardar}
                onClick={guardarQuiniela}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all duration-200 transform ${
                  puedeGuardar 
                    ? "bg-[#F97316] hover:bg-orange-600 text-white hover:shadow-orange-200 hover:-translate-y-0.5" 
                    : "bg-gray-300 text-gray-500 cursor-not-allowed shadow-none"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                GUARDAR QUINIELA
              </button>
            </div>

            {/* RESUMEN DE PRONÓSTICOS ENVIADOS */}
            {quinielaGuardada.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                    <span className="text-[#22C55E]">✓</span> Mis Pronósticos Enviados
                  </h2>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-[#111827] text-white">
                    {quinielaGuardada.length} / {partidos.filter(p => !p.pospuesto || p.reactivado).length} enviados
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 text-[#64748B] text-xs font-bold uppercase tracking-wider">
                        <th className="px-6 py-4 border-b border-gray-100">Partido</th>
                        <th className="px-6 py-4 border-b border-gray-100 text-center">Tu Pronóstico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {quinielaGuardada.map((item) => {
                        const partido = partidos.find((p) => String(p.id) === String(item.partido_id));
                        let badgeColor = "bg-gray-100 text-gray-700";
                        let badgeText = "Empate";
                        
                        if (item.pronostico === "L") { badgeColor = "bg-blue-100 text-blue-800"; badgeText = "Local"; }
                        if (item.pronostico === "V") { badgeColor = "bg-orange-100 text-orange-800"; badgeText = "Visitante"; }

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-[#111827]">
                                {partido ? `${partido.local} vs ${partido.visitante}` : "Partido no encontrado"}
                              </p>
                              {partido?.jornada_original && partido.jornada_original !== partido.jornada_id && (
                                <span className="inline-block mt-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                  Reprogramado de J{partido.jornada_original}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold ${badgeColor}`}>
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
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-200" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setMostrarModal(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1 transition-colors" 
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
                <div className="h-1 w-20 bg-[#F97316] mx-auto mt-3 rounded-full"></div>
              </div>
              
              <div className="space-y-6">
                <div className="bg-green-50 rounded-xl p-5 border border-green-100">
                  <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center gap-2">
                    🏆 Pronósticos y Premios
                  </h3>
                  <ul className="space-y-2 text-green-800">
                    <li className="flex items-start gap-2">
                      <span className="font-bold mt-0.5">•</span>
                      <span>Premio semanal de <strong>$180.00</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold mt-0.5">•</span>
                      <span>Ganador de liguilla se lleva <strong>$250.00</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold mt-0.5">•</span>
                      <span>Se elimina el ganador a 4to lugar.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold mt-0.5">•</span>
                      <span>Primer Lugar gana <strong>$3,620.00</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold mt-0.5">•</span>
                      <span>Segundo Lugar gana <strong>$1,300.00</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold mt-0.5">•</span>
                      <span>Tercer Lugar gana <strong>$550.00</strong>.</span>
                    </li>
                  </ul>
                  <p className="text-xs text-green-700 mt-4 italic text-right border-t border-green-200 pt-2">
                    *(Valores calculados sobre 32 jugadores)*
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <h3 className="text-lg font-bold text-[#111827] mb-3 flex items-center gap-2">
                    📋 Reglas del Juego
                  </h3>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="bg-[#F97316] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                      <span>Cada jornada el participante hará la selección de sus pronósticos: <strong>Local, Empate o Visitante</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-[#F97316] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                      <span>Se llevará un <strong>ranking semanal</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-[#F97316] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                      <span>Los aciertos semanales se sumarán al acumulado de pronósticos acertados.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-[#F97316] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</span>
                      <span>En esta aplicación, se tiene un <strong>cronómetro para el inicio de la jornada</strong>.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 text-center">
                <button 
                  onClick={() => setMostrarModal(false)} 
                  className="w-full sm:w-auto bg-[#111827] hover:bg-gray-800 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5"
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