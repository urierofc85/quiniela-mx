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

    const { data: jornadas } = await supabase.from("jornadas").select("*");
    const { data: partidos } = await supabase.from("partidos").select("*");

    let total = 0;
    let vidas = 0;

    const procesado = (selecciones || []).map((item) => {
      const jornada = jornadas?.find(
        (j) => Number(j.id) === Number(item.jornada_id)
      );

      const partido = partidos?.find(
        (p) =>
          Number(p.jornada_id) === Number(item.jornada_id) &&
          (p.local === item.equipo || p.visitante === item.equipo)
      );

      let puntos = 0;
      let resultado = "Pendiente";

      if (partido?.resultado) {
        if (partido.local === item.equipo) {
          if (partido.resultado === "L") {
            puntos = 3;
            resultado = "✅ Ganó";
          }
          if (partido.resultado === "E") {
            puntos = 1;
            resultado = "🤝 Empató";
          }
          if (partido.resultado === "V") {
            puntos = 0;
            resultado = "❌ Perdió";
          }
        }

        if (partido.visitante === item.equipo) {
          if (partido.resultado === "V") {
            puntos = 3;
            resultado = "✅ Ganó";
          }
          if (partido.resultado === "E") {
            puntos = 1;
            resultado = "🤝 Empató";
          }
          if (partido.resultado === "L") {
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
        ...item,
        nombreJornada: jornada?.nombre || `Jornada ${item.jornada_id}`,
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
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
        >
          Regresar a Quiniela
        </Link>

        <Link
          to="/ranking-survivor"
          className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded font-medium flex items-center gap-1"
        >
          🏆 Ranking Survivor
        </Link>

        {/* Botón para abrir las Reglas */}
        <button
          onClick={() => setMostrarReglas(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded font-medium flex items-center gap-1"
        >
          📜 Reglas del Juego
        </button>
      </div>

      <div className="bg-gray-100 rounded p-4 my-6">
        <p className="font-bold">🏆 Puntos Totales: {puntosTotales}</p>
        <p className="font-bold mt-2">💀 Vidas Perdidas: {vidasPerdidas}</p>
      </div>

      <h2 className="text-xl font-bold mb-3">📊 Uso de Equipos</h2>

      <table className="w-full border mb-8">
        <thead className="bg-gray-200">
          <tr>
            <th className="border p-2">Equipo</th>
            <th className="border p-2">Usos</th>
          </tr>
        </thead>
        <tbody>
          {usoEquipos.map((item) => (
            <tr key={item.equipo}>
              <td className="border p-2">{item.equipo}</td>
              <td className="border p-2">{item.usos}/3</td>
            </tr>
          ))}
        </tbody>
      </table>

      {jornadaActiva && (
        <div className="border rounded p-4 mb-8">
          <h2 className="font-bold text-xl mb-4">{jornadaActiva.nombre}</h2>

          <select
            value={equipoSeleccionado}
            onChange={(e) => setEquipoSeleccionado(e.target.value)}
            className="border p-2 rounded w-full max-w-xs"
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
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mt-4 disabled:bg-gray-400"
            >
              Guardar Selección
            </button>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">Historial Survivor</h2>

      <table className="w-full border">
        <thead className="bg-gray-200">
          <tr>
            <th className="border p-2">Jornada</th>
            <th className="border p-2">Equipo</th>
            <th className="border p-2">Resultado</th>
            <th className="border p-2">Puntos</th>
          </tr>
        </thead>
        <tbody>
          {historial.map((item) => (
            <tr key={item.id}>
              <td className="border p-2">{item.nombreJornada}</td>
              <td className="border p-2">{item.equipo}</td>
              <td className="border p-2">{item.resultado}</td>
              <td className="border p-2">{item.puntos}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* POPUP / MODAL DE REGLAS */}
      {mostrarReglas && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl relative animate-fade-in">
            <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">
              Bienvenidos al Survivor Liga MX
            </h2>
            
            <div className="space-y-3 text-gray-700 text-sm md:text-base leading-relaxed mb-6">
              <p>
                • Cada participante puede elegir <strong>3 veces a un mismo equipo</strong> durante todo el torneo, un equipo a elegir por Jornada.
              </p>
              <p>
                • Cada jornada el equipo seleccionado puede tener tres resultados: <strong>Ganar, Empatar o Perder</strong>.
              </p>
              <p>
                • Si Gana Obtienes 3 Puntos, si Empata 1 Punto y si Pierde 0 puntos <strong>Cuando Pierde tu equipo, tu Pierdes 1 Vida</strong>.
              </p>
              <p>
                • Solamente Tenemos 3 VIDAS en la temporada <strong>Gana el que Seleccione Mejor</strong>.
              </p>
            </div>

            <button
              onClick={() => setMostrarReglas(false)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded transition-colors"
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}