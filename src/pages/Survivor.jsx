import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { Link } from "react-router-dom";
import { obtenerHoraMexico } from "../services/horario";

export default function Survivor() {
  const [equiposDisponibles, setEquiposDisponibles] = useState([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState("");
  const [jornadaActiva, setJornadaActiva] = useState(null);
  const [jornadaCerrada, setJornadaCerrada] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [usoEquipos, setUsoEquipos] = useState([]);
  const [puntosTotales, setPuntosTotales] = useState(0);
  const [vidasPerdidas, setVidasPerdidas] = useState(0);
  const [todosLosPartidos, setTodosLosPartidos] = useState([]);
  
  const [mensajeAdvertencia, setMensajeAdvertencia] = useState("");
  const [mostrarReglas, setMostrarReglas] = useState(false);
  const [mostrarModalEliminado, setMostrarModalEliminado] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const estaEliminado = vidasPerdidas >= 3;

  useEffect(() => {
    if (estaEliminado) {
      setMostrarModalEliminado(true);
    }
  }, [estaEliminado]);

  const cargarDatos = async () => {
    const { data: jornadaData } = await supabase
      .from("jornadas")
      .select("*")
      .eq("activa", true)
      .single();

    if (jornadaData) {
      setJornadaActiva(jornadaData);
      if (jornadaData.fecha_limite) {
        const limite = new Date(jornadaData.fecha_limite);
        const horaMexico = await obtenerHoraMexico();
        setJornadaCerrada(horaMexico > limite);
      }
    }

    let partidosData = [];
    let { data, error } = await supabase
      .from("partidos")
      .select("id, jornada_id, local, visitante, pospuesto, resultado");
    
    if (error) {
      const { data: fallbackData } = await supabase
        .from("partidos")
        .select("id, jornada_id, local, visitante, resultado");
      partidosData = fallbackData || [];
    } else {
      partidosData = data || [];
    }
    
    setTodosLosPartidos(partidosData);

    if (jornadaData) {
      await cargarEquiposDisponibles(jornadaData, partidosData);
      await cargarSeleccionActual(jornadaData, partidosData);
    }

    await cargarHistorial(partidosData);
    await cargarUsoEquipos(partidosData);
  };

  const cargarEquiposDisponibles = async (jornada = jornadaActiva, partidos = todosLosPartidos) => {
    if (!jornada) return;

    const partidosJornada = partidos.filter(
      (p) => String(p.jornada_id) === String(jornada.id)
    );

    const opciones = [];
    partidosJornada.forEach((p) => {
      if (p.pospuesto !== true) {
        if (p.local && p.visitante) {
          opciones.push({ nombre: p.local, rival: p.visitante });
          opciones.push({ nombre: p.visitante, rival: p.local });
        }
      }
    });

    const unicos = [];
    const vistos = new Set();
    
    opciones.forEach((op) => {
      const claveUnica = `${op.nombre.trim().toLowerCase()}_vs_${op.rival.trim().toLowerCase()}`;
      if (!vistos.has(claveUnica)) {
        vistos.add(claveUnica);
        unicos.push(op);
      }
    });

    unicos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setEquiposDisponibles(unicos);
  };

  const cargarSeleccionActual = async (jornada = jornadaActiva, partidos = todosLosPartidos) => {
    if (!jornada) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("survivor")
      .select("*")
      .eq("usuario_id", user.id)
      .eq("jornada_id", jornada.id)
      .maybeSingle();

    if (data) {
      let nombreEquipo = data.equipo;
      let nombreRival = null;
      
      if (data.equipo.includes(' (vs ')) {
        const partes = data.equipo.split(' (vs ');
        nombreEquipo = partes[0].trim();
        nombreRival = partes[1].replace(')', '').trim();
      }

      const partidoDeMiSeleccion = partidos.find((p) => {
        const matchJornada = String(p.jornada_id) === String(jornada.id);
        const matchEquipo = p.local.trim().toLowerCase() === nombreEquipo.trim().toLowerCase() || 
                           p.visitante.trim().toLowerCase() === nombreEquipo.trim().toLowerCase();
        
        if (nombreRival) {
          const matchRival = p.local.trim().toLowerCase() === nombreRival.trim().toLowerCase() || 
                            p.visitante.trim().toLowerCase() === nombreRival.trim().toLowerCase();
          return matchJornada && matchEquipo && matchRival;
        }
        return matchJornada && matchEquipo;
      });

      if (partidoDeMiSeleccion?.pospuesto === true) {
        setEquipoSeleccionado("");
        setMensajeAdvertencia(
          `⚠️ Tu selección anterior (${data.equipo}) fue pospuesta. Por favor elige un nuevo equipo.`
        );
      } else {
        setEquipoSeleccionado(data.equipo);
        setMensajeAdvertencia("");
      }
    } else {
      setEquipoSeleccionado("");
      setMensajeAdvertencia("");
    }
  };

  const cargarUsoEquipos = async (partidos = todosLosPartidos) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("survivor")
      .select("equipo")
      .eq("usuario_id", user.id);

    const usoDetallado = {};

    data?.forEach((sel) => {
      if (!sel.equipo) return;
      
      let nombreEquipo = sel.equipo;
      if (nombreEquipo.includes(' (vs ')) {
        nombreEquipo = nombreEquipo.split(' (vs ')[0].trim();
      } else {
        nombreEquipo = nombreEquipo.trim();
      }

      const clave = nombreEquipo.toLowerCase();
      if (!usoDetallado[clave]) {
        usoDetallado[clave] = { nombre: nombreEquipo, usos: 0 };
      }
      usoDetallado[clave].usos += 1;
    });

    const resultado = Object.values(usoDetallado).map(item => ({
      detalle: item.nombre,
      usos: item.usos
    }));
    
    resultado.sort((a, b) => b.usos - a.usos);
    setUsoEquipos(resultado);
  };

  const cargarHistorial = async (partidos = todosLosPartidos) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: selecciones } = await supabase
      .from("survivor")
      .select("*")
      .eq("usuario_id", user.id)
      .order("jornada_id", { ascending: true });

    const { data: jornadas } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: true });

    const horaMexico = await obtenerHoraMexico();

    let total = 0;
    let vidas = 0; // Contador local de vidas perdidas

    const procesado = (jornadas || []).map((jornada) => {
      const esPasadaYCerrada = jornada.fecha_limite ? horaMexico > new Date(jornada.fecha_limite) : false;
      const seleccion = selecciones?.find((s) => String(s.jornada_id) === String(jornada.id));

      // CASO 1: No hubo selección y la jornada ya cerró
      if (!seleccion && esPasadaYCerrada) {
        vidas++;
        return {
          id: `jornada-${jornada.id}`,
          nombreJornada: jornada.nombre || `Jornada ${jornada.id}`,
          equipo: "Sin selección",
          resultado: "❌ Perdió (Sin selección)",
          puntos: 0,
        };
      }

      // CASO 2: No hubo selección pero la jornada aún no cierra
      if (!seleccion) {
        return {
          id: `jornada-${jornada.id}`,
          nombreJornada: jornada.nombre || `Jornada ${jornada.id}`,
          equipo: "Sin selección",
          resultado: "Pendiente",
          puntos: 0,
        };
      }

      let nombreEquipoLimpio = seleccion.equipo;
      let nombreRival = null;
      
      if (seleccion.equipo.includes(' (vs ')) {
        const partes = seleccion.equipo.split(' (vs ');
        nombreEquipoLimpio = partes[0].trim().toLowerCase();
        nombreRival = partes[1].replace(')', '').trim().toLowerCase();
      } else {
        nombreEquipoLimpio = seleccion.equipo.trim().toLowerCase();
      }

      const partido = partidos?.find((p) => {
        const matchJornada = String(p.jornada_id) === String(jornada.id);
        const matchEquipo = p.local.trim().toLowerCase() === nombreEquipoLimpio || 
                           p.visitante.trim().toLowerCase() === nombreEquipoLimpio;
        if (nombreRival) {
          const matchRival = p.local.trim().toLowerCase() === nombreRival || 
                            p.visitante.trim().toLowerCase() === nombreRival;
          return matchJornada && matchEquipo && matchRival;
        }
        return matchJornada && matchEquipo;
      });

      let puntos = 0;
      let resultado = "Pendiente";
      let nombreEquipoConRival = seleccion.equipo;

      if (partido) {
        const rival = partido.local.trim().toLowerCase() === nombreEquipoLimpio ? partido.visitante : partido.local;
        const equipoOriginal = seleccion.equipo.includes(' (vs ') ? seleccion.equipo.split(' (vs ')[0].trim() : seleccion.equipo;
        nombreEquipoConRival = `${equipoOriginal} (vs ${rival})`;

        if (partido.pospuesto === true) {
          resultado = "⏸️ Pospuesto";
          puntos = 0;
        } else if (partido.resultado) {
          const res = partido.resultado.toUpperCase();
          const esLocal = partido.local.trim().toLowerCase() === nombreEquipoLimpio;
          
          if (esLocal) {
            if (res === "L") { puntos = 3; resultado = "✅ Ganó"; } 
            else if (res === "E") { puntos = 1; resultado = "🤝 Empató"; } 
            else if (res === "V") { puntos = 0; resultado = "❌ Perdió"; }
          } else {
            if (res === "V") { puntos = 3; resultado = "✅ Ganó"; } 
            else if (res === "E") { puntos = 1; resultado = "🤝 Empató"; } 
            else if (res === "L") { puntos = 0; resultado = "❌ Perdió"; }
          }
        }
      }

      total += puntos;
      
      // CORRECCIÓN: Usar .includes para ser más robusto contra variaciones de texto
      if (resultado.includes("Perdió")) {
        vidas++;
      }

      return {
        ...seleccion,
        nombreJornada: jornada.nombre || `Jornada ${seleccion.jornada_id}`,
        equipo: nombreEquipoConRival,
        puntos,
        resultado,
      };
    });

    setHistorial(procesado);
    setPuntosTotales(total);
    setVidasPerdidas(vidas); // Actualizar estado global
  };

  const guardarSeleccion = async () => {
    if (!jornadaActiva) return;
    
    const horaMexico = await obtenerHoraMexico();
    const fechaLimite = new Date(jornadaActiva.fecha_limite);

    if (horaMexico > fechaLimite) {
      alert("La jornada ya fue cerrada");
      return;
    }

    if (!equipoSeleccionado) {
      alert("Selecciona un equipo");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    let nombreEquipo, nombreRival;
    if (equipoSeleccionado.includes(' (vs ')) {
      const partes = equipoSeleccionado.split(' (vs ');
      nombreEquipo = partes[0].trim();
      nombreRival = partes[1].replace(')', '').trim();
    } else {
      nombreEquipo = equipoSeleccionado;
      const partido = todosLosPartidos.find(p => 
        String(p.jornada_id) === String(jornadaActiva.id) &&
        (p.local.trim().toLowerCase() === nombreEquipo.trim().toLowerCase() || 
         p.visitante.trim().toLowerCase() === nombreEquipo.trim().toLowerCase())
      );
      if (partido) {
        nombreRival = partido.local.trim().toLowerCase() === nombreEquipo.trim().toLowerCase() 
          ? partido.visitante : partido.local;
      }
    }

    const valorAGuardar = `${nombreEquipo} (vs ${nombreRival})`;

    const { data: seleccionesUsuario } = await supabase
      .from("survivor")
      .select("equipo")
      .eq("usuario_id", user.id);

    const usosActuales = seleccionesUsuario?.filter(s => {
      const nombre = s.equipo.includes(' (vs ') ? s.equipo.split(' (vs ')[0].trim() : s.equipo.trim();
      return nombre.toLowerCase() === nombreEquipo.toLowerCase();
    }).length || 0;

    if (usosActuales >= 3) {
      alert(`Ya no puedes seleccionar a ${nombreEquipo}. Máximo 3 usos permitidos.`);
      return;
    }

    await supabase
      .from("survivor")
      .delete()
      .eq("usuario_id", user.id)
      .eq("jornada_id", jornadaActiva.id);

    const { error } = await supabase.from("survivor").insert({
      usuario_id: user.id,
      usuario: user.email,
      jornada_id: jornadaActiva.id,
      equipo: valorAGuardar,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert(`Selección guardada: ${valorAGuardar}`);
    setMensajeAdvertencia("");
    await cargarSeleccionActual(jornadaActiva, todosLosPartidos);
    await cargarHistorial(todosLosPartidos);
    await cargarUsoEquipos(todosLosPartidos);
  };

  // CÁLCULO SEGURO DE VIDAS RESTANTES
  const vidasRestantes = Math.max(0, 3 - vidasPerdidas);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              🦖 Survivor <span className="text-indigo-600">Liga MX</span>
            </h1>
            <p className="text-slate-500 mt-1">Elige sabiamente, sobrevive al torneo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/quiniela" className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition shadow-sm flex items-center gap-2">
              ← Quiniela
            </Link>
            <Link to="/ranking-survivor" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm flex items-center gap-2">
              🏆 Ranking
            </Link>
            <button onClick={() => setMostrarReglas(true)} className="px-4 py-2 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-medium hover:bg-amber-200 transition shadow-sm flex items-center gap-2">
              📜 Reglas
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Puntos Totales</span>
            <span className="text-4xl md:text-5xl font-extrabold text-emerald-600 mt-1">{puntosTotales}</span>
          </div>
          <div className={`p-5 rounded-2xl shadow-sm border flex flex-col items-center justify-center text-center transition-all ${estaEliminado ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Vidas Restantes</span>
            <div className="flex items-center gap-1 mt-1">
              {[...Array(3)].map((_, i) => {
                // Lógica corregida y blindada:
                const estaViva = i < vidasRestantes;
                return (
                  <span 
                    key={i} 
                    className={`text-2xl md:text-3xl transition-all duration-300 ${
                      estaViva 
                        ? 'text-red-500 scale-100 drop-shadow-sm' 
                        : 'text-slate-200 scale-90 grayscale opacity-50'
                    }`}
                  >
                    ❤️
                  </span>
                );
              })}
            </div>
            {estaEliminado && (
              <span className="text-red-600 font-bold text-sm mt-2 animate-pulse bg-red-100 px-3 py-1 rounded-full">
                ¡ELIMINADO!
              </span>
            )}
          </div>
        </div>

        {/* Team Usage Chips */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            📊 Uso de Equipos <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">(Máx. 3 veces)</span>
          </h2>
          {usoEquipos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {usoEquipos.map((item, index) => {
                const isFull = item.usos >= 3;
                return (
                  <div key={index} className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium transition ${isFull ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <span>{item.detalle}</span>
                    <span className="flex gap-1 ml-1">
                      {[...Array(3)].map((_, i) => (
                        <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < item.usos ? (isFull ? 'bg-red-500' : 'bg-indigo-500') : 'bg-slate-300'}`}></span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">Aún no has seleccionado ningún equipo.</p>
          )}
        </div>

        {/* Active Jornada Selection */}
        {jornadaActiva && (
          <div className={`bg-white p-5 md:p-6 rounded-2xl shadow-md border-2 transition-all ${estaEliminado ? 'border-slate-200 opacity-75' : 'border-indigo-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                ⚽ {jornadaActiva.nombre}
                {jornadaCerrada && <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide">Cerrada</span>}
              </h2>
            </div>

            {mensajeAdvertencia && !estaEliminado && (
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4 rounded-r-lg text-sm text-amber-800 flex items-start gap-3">
                <span className="text-xl mt-0.5">⚠️</span>
                <span className="font-medium">{mensajeAdvertencia}</span>
              </div>
            )}

            {estaEliminado ? (
              <div className="text-center py-8">
                <p className="text-slate-600 mb-6 text-lg">Has agotado tus 3 vidas. Ya no puedes hacer más selecciones en este torneo.</p>
                <button
                  onClick={() => setMostrarModalEliminado(true)}
                  className="bg-slate-800 hover:bg-slate-900 text-white text-lg font-bold px-8 py-3 rounded-xl shadow-lg transition transform hover:scale-105 flex items-center gap-2 mx-auto"
                >
                  🏳️ Ver Estado de Eliminación
                </button>
              </div>
            ) : jornadaCerrada ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                <p className="text-slate-600 font-medium">⏰ El tiempo para seleccionar en esta jornada ha terminado.</p>
              </div>
            ) : (
              <>
                <p className="text-slate-600 mb-3 font-medium">Selecciona un equipo para esta jornada:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  {equiposDisponibles.map((op, idx) => {
                    const valorCompleto = `${op.nombre} (vs ${op.rival})`;
                    const uso = usoEquipos.find(u => u.detalle.toLowerCase() === op.nombre.toLowerCase())?.usos || 0;
                    const isDisabled = uso >= 3;
                    const isSelected = equipoSeleccionado === valorCompleto;

                    return (
                      <button
                        key={`${op.nombre}_${op.rival}_${idx}`}
                        disabled={isDisabled}
                        onClick={() => setEquipoSeleccionado(valorCompleto)}
                        className={`relative p-4 rounded-xl border-2 text-left transition-all flex flex-col gap-1 ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' 
                            : isDisabled 
                              ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed' 
                              : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className={`font-bold text-lg ${isDisabled ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                            {op.nombre}
                          </span>
                          {isSelected && <span className="text-indigo-600 text-xl font-bold">✓</span>}
                        </div>
                        <span className="text-sm text-slate-500">vs {op.rival}</span>
                        
                        <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-slate-100">
                          <div className="flex gap-1">
                            {[...Array(3)].map((_, i) => (
                              <span key={i} className={`w-3 h-3 rounded-full ${i < uso ? (isDisabled ? 'bg-red-400' : 'bg-indigo-500') : 'bg-slate-200'}`}></span>
                            ))}
                          </div>
                          <span className={`text-xs font-bold ${isDisabled ? 'text-red-600' : 'text-slate-400'}`}>
                            {uso}/3 usos
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {equiposDisponibles.length === 0 && (
                  <div className="text-center py-6 bg-orange-50 rounded-xl border border-orange-200 text-orange-800 font-medium">
                    ⚠️ No se encontraron equipos disponibles para esta jornada.
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 items-center pt-2">
                  <button
                    onClick={guardarSeleccion}
                    disabled={!equipoSeleccionado || jornadaCerrada || equiposDisponibles.length === 0}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-8 py-3.5 rounded-xl font-bold text-lg shadow-md transition transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    💾 Confirmar Selección
                  </button>
                  {equipoSeleccionado && (
                    <span className="text-sm text-slate-500 bg-slate-100 px-4 py-2 rounded-lg">
                      Elegido: <span className="font-bold text-slate-800">{equipoSeleccionado}</span>
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* History Timeline */}
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            📜 Historial de Selecciones
          </h2>
          {historial.length > 0 ? (
            <div className="space-y-3">
              {historial.map((item, index) => {
                let statusColor = "bg-slate-100 text-slate-600 border-slate-200";
                let statusIcon = "⏳";
                
                if (item.resultado.includes("Ganó")) {
                  statusColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  statusIcon = "✅";
                } else if (item.resultado.includes("Empató")) {
                  statusColor = "bg-amber-50 text-amber-700 border-amber-200";
                  statusIcon = "🤝";
                } else if (item.resultado.includes("Perdió") || item.resultado.includes("No elegible")) {
                  statusColor = "bg-red-50 text-red-700 border-red-200";
                  statusIcon = "❌";
                } else if (item.resultado.includes("Pospuesto")) {
                  statusColor = "bg-blue-50 text-blue-700 border-blue-200";
                  statusIcon = "⏸️";
                }

                return (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition gap-3">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-500 font-bold text-[10px] text-center leading-tight shadow-sm uppercase">
                        Jor<br/>{index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{item.nombreJornada}</p>
                        <p className="text-sm text-slate-600">{item.equipo}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 sm:gap-6 pl-16 sm:pl-0">
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-bold border flex items-center gap-1.5 whitespace-nowrap ${statusColor}`}>
                        {statusIcon} {item.resultado.replace(/✅ |❌ |🤝 |⏸️ /g, '')}
                      </span>
                      <div className="text-center min-w-[3rem]">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pts</span>
                        <span className={`text-xl font-extrabold ${item.puntos > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          +{item.puntos}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No hay historial disponible aún. ¡Haz tu primera selección!
            </div>
          )}
        </div>

        {/* Modal de Eliminación */}
        {mostrarModalEliminado && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity" onClick={() => setMostrarModalEliminado(false)}>
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center relative border-4 border-red-100" onClick={(e) => e.stopPropagation()}>
              <div className="text-6xl mb-4 animate-bounce">🦖💀</div>
              <h2 className="text-3xl font-extrabold text-slate-800 mb-3">¡Fin del Camino!</h2>
              <p className="text-lg text-slate-600 mb-2">
                Has perdido tus <span className="font-bold text-red-600">Tres Vidas</span> en este torneo.
              </p>
              <p className="text-base text-emerald-700 font-semibold mb-8 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                ¡Pero no te preocupes, nos vemos en el próximo torneo! 🎉🍻
              </p>
              <button
                onClick={() => setMostrarModalEliminado(false)}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-lg py-3.5 px-6 rounded-xl shadow-lg transition transform hover:scale-[1.02] active:scale-95"
              >
                ¡Entendido! 👍
              </button>
            </div>
          </div>
        )}

        {/* Modal de Reglas */}
        {mostrarReglas && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setMostrarReglas(false)}>
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setMostrarReglas(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 text-2xl font-bold transition bg-slate-100 rounded-full w-9 h-9 flex items-center justify-center">&times;</button>
              <h2 className="text-2xl font-bold mb-4 text-center text-indigo-700 border-b pb-3">🦖 Survivor Liga MX</h2>
              <div className="space-y-4 text-slate-700 text-sm md:text-base leading-relaxed mb-6">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">📋 Reglas del Juego</h3>
                  <ul className="list-disc list-inside space-y-2 text-slate-600">
                    <li>Cada participante puede elegir <strong className="text-slate-800">máximo 3 veces</strong> al mismo equipo durante todo el torneo.</li>
                    <li><strong className="text-emerald-700">Gana:</strong> +3 Puntos | <strong className="text-amber-700">Empata:</strong> +1 Punto | <strong className="text-red-700">Pierde:</strong> 0 Puntos y <strong>-1 Vida</strong>.</li>
                    <li>Solamente tenemos <strong className="text-red-600">3 VIDAS</strong> en la temporada. Gana quien sobreviva con más puntos.</li>
                    <li>Si un partido es <strong className="text-blue-700">pospuesto</strong>, no contará y podrás cambiar tu selección cuando se reactive.</li>
                  </ul>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">🏆 Premios Survivor</h3>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex justify-between items-center"><span>🥇 Primer Lugar</span> <strong className="text-emerald-700 text-lg">$3,030.00</strong></li>
                    <li className="flex justify-between items-center"><span>🥈 Segundo Lugar</span> <strong className="text-emerald-700 text-lg">$1,550.00</strong></li>
                    <li className="flex justify-between items-center"><span>🥉 Tercer Lugar</span> <strong className="text-emerald-700 text-lg">$750.00</strong></li>
                    <li className="flex justify-between items-center"><span>4️⃣ Cuarto Lugar</span> <strong className="text-emerald-700 text-lg">$360.00</strong></li>
                    <li className="flex justify-between items-center"><span>5️⃣ Quinto Lugar</span> <strong className="text-emerald-700 text-lg">$200.00</strong></li>
                  </ul>
                </div>
              </div>
              <button onClick={() => setMostrarReglas(false)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md text-lg">
                ¡Entendido, a sobrevivir! 🚀
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}