import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { Link } from "react-router-dom";
import { obtenerHoraMexico } from "../services/horario";

export default function Survivor() {
  const [equipos, setEquipos] = useState([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState("");
  const [jornadaActiva, setJornadaActiva] = useState(null);
  const [jornadaCerrada, setJornadaCerrada] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [usoEquipos, setUsoEquipos] = useState([]);
  const [puntosTotales, setPuntosTotales] = useState(0);
  const [vidasPerdidas, setVidasPerdidas] = useState(0);
  
  // Estado para controlar el Popup/Modal de Reglas
  const [mostrarReglas, setMostrarReglas] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    await cargarJornada();
    await cargarEquipos();
    await cargarHistorial();
    await cargarUsoEquipos();
  };

  const cargarJornada = async () => {
    const { data } = await supabase
      .from("jornadas")
      .select("*")
      .eq("activa", true)
      .single();

    if (!data) return;

    setJornadaActiva(data);

    if (data.fecha_limite) {
      const limite = new Date(data.fecha_limite);
      const horaMexico = await obtenerHoraMexico();
      setJornadaCerrada(horaMexico > limite);
    }

    await cargarSeleccionActual(data.id);
  };

  const cargarEquipos = async () => {
    const { data, error } = await supabase
      .from("equipos")
      .select("nombre")
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error cargando equipos:", error);
      return;
    }

    setEquipos(data.map((e) => e.nombre));
  };

  const cargarSeleccionActual = async (jornadaId) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("survivor")
      .select("*")
      .eq("usuario_id", user.id)
      .eq("jornada_id", jornadaId)
      .maybeSingle();

    if (data) {
      setEquipoSeleccionado(data.equipo);
    }
  };

  const cargarUsoEquipos = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("survivor")
      .select("equipo")
      .eq("usuario_id", user.id);

    const conteo = {};

    // Inicializamos el conteo con los equipos cargados
    equipos.forEach((equipo) => {
      conteo[equipo] = 0;
    });

    data?.forEach((item) => {
      conteo[item.equipo] = (conteo[item.equipo] || 0) + 1;
    });

    const resultado = Object.entries(conteo).map(([equipo, usos]) => ({
      equipo,
      usos,
    }));

    setUsoEquipos(resultado);
  };

  const cargarHistorial = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const { data: partidos } = await supabase.from("partidos").select("*");
    const horaMexico = await obtenerHoraMexico();

    let total = 0;
    let vidas = 0;

    const procesado = (jornadas || []).map((jornada) => {
      // Validamos si esta jornada ya pasó su fecha límite para considerarla cerrada/expirada
      const esPasadaYCerrada = jornada.fecha_limite ? horaMexico > new Date(jornada.fecha_limite) : false;

      const seleccion = selecciones?.find(
        (s) => Number(s.jornada_id) === Number(jornada.id)
      );

      // CASO 1: No seleccionó equipo y la jornada ya cerró/pasó
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

      // CASO 2: La jornada aún está activa o abierta y no seleccionó nada todavía
      if (!seleccion) {
        return {
          id: `jornada-${jornada.id}`,
          nombreJornada: jornada.nombre || `Jornada ${jornada.id}`,
          equipo: "Sin selección",
          resultado: "Pendiente",
          puntos: 0,
        };
      }

      // CASO 3: Sí tiene selección, calculamos puntos y resultados normales
      const partido = partidos?.find(
        (p) =>
          Number(p.jornada_id) === Number(jornada.id) &&
          (p.local === seleccion.equipo || p.visitante === seleccion.equipo)
      );

      let puntos = 0;
      let resultado = "Pendiente";

      if (partido?.resultado) {
        if (partido.local === seleccion.equipo) {
          if (partido.resultado === "L") {
            puntos = 3;
            resultado = "✅ Ganó";
          } else if (partido.resultado === "E") {
            puntos = 1;
            resultado = "🤝 Empató";
          } else if (partido.resultado === "V") {
            puntos = 0;
            resultado = "❌ Perdió";
          }
        }

        if (partido.visitante === seleccion.equipo) {
          if (partido.resultado === "V") {
            puntos = 3;
            resultado = "✅ Ganó";
          } else if (partido.resultado === "E") {
            puntos = 1;
            resultado = "🤝 Empató";
          } else if (partido.resultado === "L") {
            puntos = 0;
            resultado = "❌ Perdió";
          }
        }
      }

      total += puntos;

      if (resultado === "❌ Perdió") {
        vidas++;
      }

      return {
        ...seleccion,
        nombreJornada: jornada.nombre || `Jornada ${seleccion.jornada_id}`,
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const usos =
      actual?.equipo === equipoSeleccionado ? (count || 0) - 1 : count || 0;

    if (usos >= 3) {
      alert(
        `Ya no puedes seleccionar ${equipoSeleccionado}. Máximo 3 usos.`
      );
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

    await cargarHistorial();
    await cargarUsoEquipos();
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Survivor Liga MX</h1>

      {/* Enlaces de Navegación y Botón de Reglas */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link
          to="/quiniela"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition"
        >
          Regresar a Quiniela
        </Link>

        <Link
          to="/ranking-survivor"
          className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded font-medium flex items-center gap-1 transition"
        >
          🏆 Ranking Survivor
        </Link>

        {/* Botón para abrir las Reglas y Premios */}
        <button
          onClick={() => setMostrarReglas(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded font-medium flex items-center gap-1 transition"
        >
          📜 Reglas y Premios
        </button>
      </div>

      <div className="bg-gray-100 rounded p-4 my-6 border border-gray-200">
        <p className="font-bold text-lg">🏆 Puntos Totales: {puntosTotales}</p>
        <p className={`font-bold text-lg mt-2 ${vidasPerdidas >= 3 ? 'text-red-600' : 'text-gray-800'}`}>
          💀 Vidas Perdidas: {vidasPerdidas} {vidasPerdidas >= 3 && "💀"}
        </p>
      </div>

      <h2 className="text-xl font-bold mb-3">📊 Uso de Equipos</h2>

      <table className="w-full border mb-8 rounded overflow-hidden">
        <thead className="bg-gray-200">
          <tr>
            <th className="border p-2 text-left">Equipo</th>
            <th className="border p-2 text-center">Usos</th>
          </tr>
        </thead>
        <tbody>
          {usoEquipos.map((item) => (
            <tr key={item.equipo} className="hover:bg-gray-50">
              <td className="border p-2">{item.equipo}</td>
              <td className="border p-2 text-center font-semibold">
                <span className={item.usos >= 3 ? "text-red-600" : "text-gray-700"}>
                  {item.usos}/3
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {jornadaActiva && (
        <div className="border rounded p-4 mb-8 bg-white shadow-sm">
          <h2 className="font-bold text-xl mb-4">{jornadaActiva.nombre}</h2>

          <select
            value={equipoSeleccionado}
            onChange={(e) => setEquipoSeleccionado(e.target.value)}
            className="border p-2 rounded w-full max-w-xs mb-4 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          >
            <option value="">Selecciona un equipo</option>
            {equipos.map((equipo) => (
              <option key={equipo} value={equipo}>
                {equipo}
              </option>
            ))}
          </select>

          <div>
            <button
              onClick={guardarSeleccion}
              disabled={jornadaCerrada}
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
            <th className="border p-2 text-left">Equipo</th>
            <th className="border p-2 text-center">Resultado</th>
            <th className="border p-2 text-center">Puntos</th>
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

      {/* POPUP / MODAL DE REGLAS Y PREMIOS */}
      {mostrarReglas && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setMostrarReglas(false)}
        >
          <div 
            className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()} // Evita cerrar al hacer clic dentro del modal
          >
            {/* Botón de cerrar (X) */}
            <button
              onClick={() => setMostrarReglas(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold transition"
              aria-label="Cerrar"
            >
              &times;
            </button>

            <h2 className="text-2xl font-bold mb-4 text-center text-purple-700 border-b pb-3">
              🦖 Survivor Liga MX
            </h2>
            
            <div className="space-y-4 text-gray-700 text-sm md:text-base leading-relaxed mb-6">
              {/* Sección de Reglas */}
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  📋 Reglas del Juego
                </h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Cada participante puede elegir <strong>3 veces a un mismo equipo</strong> durante todo el torneo, un equipo a elegir por Jornada.</li>
                  <li>Cada jornada el equipo seleccionado puede tener tres resultados: <strong>Ganar, Empatar o Perder</strong>.</li>
                  <li>Si Gana obtienes 3 Puntos, si Empata 1 Punto y si Pierde 0 puntos. <strong>Cuando pierde tu equipo, tú pierdes 1 Vida</strong>.</li>
                  <li>Solamente tenemos <strong>3 VIDAS</strong> en la temporada. Gana el que seleccione mejor.</li>
                </ul>
              </div>

              {/* Sección de Premios */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  🏆 Premios Survivor
                </h3>
                <ul className="list-decimal list-inside space-y-1 ml-1">
                  <li>Primer Lugar gana <strong>$3,030.00</strong></li>
                  <li>Segundo Lugar gana <strong>$1,550.00</strong></li>
                  <li>Tercer Lugar gana <strong>$750.00</strong></li>
                  <li>Cuarto Lugar gana <strong>$360.00</strong></li>
                  <li>Quinto Lugar gana <strong>$200.00</strong></li>
                </ul>
                <p className="text-xs text-gray-600 mt-3 italic text-right">
                  *(Valores calculados sobre 31 participantes)*
                </p>
              </div>
            </div>

            <button
              onClick={() => setMostrarReglas(false)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-lg transition-colors shadow-md"
            >
              ¡Entendido, a sobrevivir!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}