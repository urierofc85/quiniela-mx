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

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    await cargarJornada();
    await cargarTodosLosPartidos(); 
    await cargarEquiposDisponibles();
    await cargarSeleccionActual(); 
    await cargarHistorial();
    await cargarUsoEquipos();
  };

  const cargarJornada = async () => {
    const { data } = await supabase
      .from("jornadas")
      .select("*")
      .eq("activa", true)
      .single();

    if (!data) {
      console.error("❌ No se encontró jornada activa");
      return;
    }

    console.log("✅ Jornada activa encontrada:", data);
    setJornadaActiva(data);

    if (data.fecha_limite) {
      const limite = new Date(data.fecha_limite);
      const horaMexico = await obtenerHoraMexico();
      setJornadaCerrada(horaMexico > limite);
    }
  };

  const cargarTodosLosPartidos = async () => {
    console.log("🔍 Intentando cargar partidos con columna 'pospuesto'...");
    
    let { data, error } = await supabase
      .from("partidos")
      .select("id, jornada_id, local, visitante, pospuesto");
    
    if (error) {
      console.warn("⚠️ Error con columna 'pospuesto':", error.message);
      console.log("🔄 Reintentando sin la columna 'pospuesto'...");
      
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("partidos")
        .select("id, jornada_id, local, visitante");
      
      if (fallbackError) {
        console.error("❌ Error en fallback:", fallbackError);
        setTodosLosPartidos([]);
      } else {
        console.log("✅ Fallback exitoso. Partidos cargados:", fallbackData?.length);
        setTodosLosPartidos(fallbackData || []);
      }
    } else {
      console.log("✅ Partidos cargados con 'pospuesto':", data?.length);
      setTodosLosPartidos(data || []);
    }
  };

  const cargarEquiposDisponibles = async () => {
    if (!jornadaActiva) {
      console.error("❌ No hay jornada activa para cargar equipos");
      return;
    }

    console.log("\n🔍 === DIAGNÓSTICO DE EQUIPOS DISPONIBLES ===");
    console.log("Jornada activa ID:", jornadaActiva.id, "Nombre:", jornadaActiva.nombre);
    console.log("Total de partidos en memoria:", todosLosPartidos.length);

    // Mostrar todos los partidos de la jornada activa
    const partidosJornada = todosLosPartidos.filter(
      (p) => String(p.jornada_id) === String(jornadaActiva.id)
    );

    console.log("Partidos encontrados para esta jornada:", partidosJornada.length);
    console.log("Detalle de partidos:");
    partidosJornada.forEach(p => {
      console.log(`  - ${p.local} vs ${p.visitante} | pospuesto: ${p.pospuesto} | tipo: ${typeof p.pospuesto}`);
    });

    const opciones = [];
    partidosJornada.forEach((p) => {
      // ✅ Solo excluimos si pospuesto es EXPLÍCITAMENTE true
      if (p.pospuesto !== true) {
        opciones.push({ nombre: p.local, rival: p.visitante });
        opciones.push({ nombre: p.visitante, rival: p.local });
      } else {
        console.log(`  ⏸️ EXCLUIDO por pospuesto: ${p.local} vs ${p.visitante}`);
      }
    });

    console.log("Opciones antes de eliminar duplicados:", opciones.length);

    const unicos = [];
    const vistos = new Set();
    opciones.forEach((op) => {
      if (!vistos.has(op.nombre)) {
        vistos.add(op.nombre);
        unicos.push(op);
      }
    });

    unicos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    console.log("Equipos únicos disponibles:", unicos.length);
    console.log("Lista de equipos:", unicos.map(e => e.nombre));
    console.log("=== FIN DIAGNÓSTICO ===\n");

    setEquiposDisponibles(unicos);
  };

  const cargarSeleccionActual = async () => {
    if (!jornadaActiva) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("survivor")
      .select("*")
      .eq("usuario_id", user.id)
      .eq("jornada_id", jornadaActiva.id)
      .maybeSingle();

    if (data) {
      const partidoDeMiSeleccion = todosLosPartidos.find(
        (p) =>
          String(p.jornada_id) === String(jornadaActiva.id) &&
          (p.local === data.equipo || p.visitante === data.equipo)
      );

      if (partidoDeMiSeleccion?.pospuesto === true) {
        setEquipoSeleccionado("");
        setMensajeAdvertencia(
          `⚠️ Tu selección anterior (${data.equipo}) fue pospuesta. Por favor elige un nuevo equipo para esta jornada.`
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

  const cargarUsoEquipos = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("survivor")
      .select("equipo, jornada_id")
      .eq("usuario_id", user.id);

    const usoDetallado = {};

    data?.forEach((sel) => {
      const partido = todosLosPartidos.find(
        (p) =>
          String(p.jornada_id) === String(sel.jornada_id) &&
          (p.local === sel.equipo || p.visitante === sel.equipo)
      );

      let clave = sel.equipo;
      if (partido) {
        const rival = partido.local === sel.equipo ? partido.visitante : partido.local;
        clave = `${sel.equipo} (vs ${rival})`;
      } else {
        const partidoMovido = todosLosPartidos.find(p => p.local === sel.equipo || p.visitante === sel.equipo);
        if (partidoMovido) {
           const rival = partidoMovido.local === sel.equipo ? partidoMovido.visitante : partidoMovido.local;
           clave = `${sel.equipo} (vs ${rival} - Movido J${partidoMovido.jornada_id})`;
        }
      }
      
      usoDetallado[clave] = (usoDetallado[clave] || 0) + 1;
    });

    const resultado = Object.entries(usoDetallado).map(([detalle, usos]) => ({ detalle, usos }));
    resultado.sort((a, b) => b.usos - a.usos);
    setUsoEquipos(resultado);
  };

  const cargarHistorial = async () => {
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
    let vidas = 0;

    const procesado = (jornadas || []).map((jornada) => {
      const esPasadaYCerrada = jornada.fecha_limite ? horaMexico > new Date(jornada.fecha_limite) : false;
      const seleccion = selecciones?.find((s) => String(s.jornada_id) === String(jornada.id));

      if (!seleccion && esPasadaYCerrada) {
        vidas++;
        return {
          id: `jornada-${jornada.id}`,
          nombreJornada: jornada.nombre || `Jornada ${jornada.id}`,
          equipo: "Sin selección",
          resultado: "❌ No elegible (Perdió vida)",
          puntos: 0,
        };
      }

      if (!seleccion) {
        return {
          id: `jornada-${jornada.id}`,
          nombreJornada: jornada.nombre || `Jornada ${jornada.id}`,
          equipo: "Sin selección",
          resultado: "Pendiente",
          puntos: 0,
        };
      }

      const partido = todosLosPartidos?.find(
        (p) =>
          String(p.jornada_id) === String(jornada.id) &&
          (p.local === seleccion.equipo || p.visitante === seleccion.equipo)
      );

      let puntos = 0;
      let resultado = "Pendiente";
      let nombreEquipoConRival = seleccion.equipo;

      if (partido) {
        const rival = partido.local === seleccion.equipo ? partido.visitante : partido.local;
        nombreEquipoConRival = `${seleccion.equipo} (vs ${rival})`;

        if (partido.pospuesto === true) {
          resultado = "⏸️ Pospuesto";
          puntos = 0;
        } else if (partido.resultado) {
          if (partido.local === seleccion.equipo) {
            if (partido.resultado === "L") { puntos = 3; resultado = "✅ Ganó"; } 
            else if (partido.resultado === "E") { puntos = 1; resultado = "🤝 Empató"; } 
            else if (partido.resultado === "V") { puntos = 0; resultado = "❌ Perdió"; }
          } else {
            if (partido.resultado === "V") { puntos = 3; resultado = "✅ Ganó"; } 
            else if (partido.resultado === "E") { puntos = 1; resultado = "🤝 Empató"; } 
            else if (partido.resultado === "L") { puntos = 0; resultado = "❌ Perdió"; }
          }
        }
      } else {
        const partidoMovido = todosLosPartidos.find(
          (p) => p.local === seleccion.equipo || p.visitante === seleccion.equipo
        );
        if (partidoMovido) {
          const rival = partidoMovido.local === seleccion.equipo ? partidoMovido.visitante : partidoMovido.local;
          nombreEquipoConRival = `${seleccion.equipo} (vs ${rival})`;
          resultado = `⚠️ Movido a J${partidoMovido.jornada_id}`;
        }
      }

      total += puntos;
      if (resultado === "❌ Perdió") vidas++;

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
    setVidasPerdidas(vidas);
  };

  const guardarSeleccion = async () => {
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

    const { count } = await supabase
      .from("survivor")
      .select("*", { count: "exact", head: true })
      .eq("usuario_id", user.id)
      .eq("equipo", equipoSeleccionado);

    const { data: actual } = await supabase
      .from("survivor")
      .select("*")
      .eq("usuario_id", user.id)
      .eq("jornada_id", jornadaActiva.id)
      .maybeSingle();

    const usos = actual?.equipo === equipoSeleccionado ? (count || 0) - 1 : count || 0;

    if (usos >= 3) {
      alert(`Ya no puedes seleccionar a ${equipoSeleccionado}. Máximo 3 usos permitidos.`);
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
      equipo: equipoSeleccionado,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Selección guardada correctamente");
    setMensajeAdvertencia("");
    await cargarSeleccionActual();
    await cargarHistorial();
    await cargarUsoEquipos();
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Survivor Liga MX</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <Link to="/quiniela" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition">
          Regresar a Quiniela
        </Link>
        <Link to="/ranking-survivor" className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded font-medium flex items-center gap-1 transition">
          🏆 Ranking Survivor
        </Link>
        <button
          onClick={() => setMostrarReglas(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded font-medium flex items-center gap-1 transition"
        >
          📜 Reglas y Premios
        </button>
      </div>

      <div className="bg-gray-100 rounded p-4 my-6 border border-gray-200 flex flex-wrap gap-6">
        <p className="font-bold text-lg">🏆 Puntos Totales: <span className="text-green-700">{puntosTotales}</span></p>
        <p className={`font-bold text-lg ${vidasPerdidas >= 3 ? 'text-red-600' : 'text-gray-800'}`}>
          💀 Vidas Perdidas: {vidasPerdidas} {vidasPerdidas >= 3 && "💀"}
        </p>
      </div>

      <h2 className="text-xl font-bold mb-3">📊 Uso de Equipos</h2>
      <table className="w-full border mb-8 rounded overflow-hidden">
        <thead className="bg-gray-200">
          <tr>
            <th className="border p-2 text-left">Equipo (vs Rival)</th>
            <th className="border p-2 text-center w-32">Usos</th>
          </tr>
        </thead>
        <tbody>
          {usoEquipos.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="border p-2 font-medium">{item.detalle}</td>
              <td className="border p-2 text-center font-semibold">
                <span className={item.usos >= 3 ? "text-red-600 bg-red-50 px-2 py-1 rounded" : "text-gray-700"}>
                  {item.usos}/3
                </span>
              </td>
            </tr>
          ))}
          {usoEquipos.length === 0 && (
            <tr><td colSpan="2" className="border p-4 text-center text-gray-500">Aún no has seleccionado ningún equipo.</td></tr>
          )}
        </tbody>
      </table>

      {jornadaActiva && (
        <div className="border rounded p-4 mb-8 bg-white shadow-sm">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2">
            {jornadaActiva.nombre}
            {jornadaCerrada && <span className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded font-normal">Cerrada</span>}
          </h2>

          {mensajeAdvertencia && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 rounded text-sm text-yellow-800">
              {mensajeAdvertencia}
            </div>
          )}

          <select
            value={equipoSeleccionado}
            onChange={(e) => setEquipoSeleccionado(e.target.value)}
            disabled={jornadaCerrada}
            className="border p-2 rounded w-full max-w-xs mb-4 focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="">Selecciona un equipo</option>
            {equiposDisponibles.map((op) => (
              <option key={op.nombre} value={op.nombre}>
                {op.nombre} (vs {op.rival})
              </option>
            ))}
          </select>

          {equiposDisponibles.length === 0 && !jornadaCerrada && (
            <p className="text-orange-600 text-sm mb-4 bg-orange-50 p-3 rounded border border-orange-200">
              ⚠️ No se encontraron equipos disponibles. Abre la consola (F12) para ver el diagnóstico detallado.
            </p>
          )}

          <div>
            <button
              onClick={guardarSeleccion}
              disabled={jornadaCerrada || equiposDisponibles.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-semibold shadow-md transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Guardar Selección
            </button>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">Historial Survivor</h2>
      <table className="w-full border rounded overflow-hidden">
        <thead className="bg-gray-200">
          <tr>
            <th className="border p-2 text-left">Jornada</th>
            <th className="border p-2 text-left">Selección</th>
            <th className="border p-2 text-center">Resultado</th>
            <th className="border p-2 text-center w-24">Puntos</th>
          </tr>
        </thead>
        <tbody>
          {historial.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="border p-2">{item.nombreJornada}</td>
              <td className="border p-2 font-medium">{item.equipo}</td>
              <td className="border p-2 text-center">{item.resultado}</td>
              <td className="border p-2 text-center font-bold">{item.puntos}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {mostrarReglas && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setMostrarReglas(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMostrarReglas(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold transition" aria-label="Cerrar">&times;</button>
            <h2 className="text-2xl font-bold mb-4 text-center text-purple-700 border-b pb-3">🦖 Survivor Liga MX</h2>
            <div className="space-y-4 text-gray-700 text-sm md:text-base leading-relaxed mb-6">
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">📋 Reglas del Juego</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Cada participante puede elegir <strong>3 veces a un mismo equipo</strong> durante todo el torneo.</li>
                  <li>Si Gana obtienes 3 Puntos, si Empata 1 Punto y si Pierde 0 puntos. <strong>Cuando pierde tu equipo, tú pierdes 1 Vida</strong>.</li>
                  <li>Solamente tenemos <strong>3 VIDAS</strong> en la temporada. Gana el que seleccione mejor.</li>
                  <li>Si un partido es <strong>pospuesto</strong>, no estará disponible para selección hasta que el administrador lo reactive en una jornada futura.</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">🏆 Premios Survivor</h3>
                <ul className="list-decimal list-inside space-y-1 ml-1">
                  <li>Primer Lugar gana <strong>$3,030.00</strong></li>
                  <li>Segundo Lugar gana <strong>$1,550.00</strong></li>
                  <li>Tercer Lugar gana <strong>$750.00</strong></li>
                  <li>Cuarto Lugar gana <strong>$360.00</strong></li>
                  <li>Quinto Lugar gana <strong>$200.00</strong></li>
                </ul>
                <p className="text-xs text-gray-600 mt-3 italic text-right">*(Valores calculados sobre 31 participantes)*</p>
              </div>
            </div>
            <button onClick={() => setMostrarReglas(false)} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-lg transition-colors shadow-md">¡Entendido, a sobrevivir!</button>
          </div>
        </div>
      )}
    </div>
  );
}