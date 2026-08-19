import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function Dashboard() {
  const [participantes, setParticipantes] = useState(0);
  const [jornadas, setJornadas] = useState(0);
  const [partidos, setPartidos] = useState(0);
  const [quinielasTotales, setQuinielasTotales] = useState(0);
  
  const [jornadasLista, setJornadasLista] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");
  
  // Nuevo estado para la gráfica
  const [datosGrafica, setDatosGrafica] = useState([]);
  const [maxQuinielas, setMaxQuinielas] = useState(1); // Para escalar las barras

  useEffect(() => {
    cargarDashboard();
  }, []);

  const cargarDashboard = async () => {
    // 1. Conteos generales
    const { count: participantesCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const { count: jornadasCount } = await supabase
      .from("jornadas")
      .select("*", { count: "exact", head: true });

    const { count: partidosCount } = await supabase
      .from("partidos")
      .select("*", { count: "exact", head: true });

    // 2. Obtener todas las jornadas para la lista y la gráfica
    const { data: jornadasData } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: true }); // Orden ascendente para la gráfica

    setJornadasLista(jornadasData || []);

    // 3. Obtener jornada activa para el selector
    const { data: jornadaActiva } = await supabase
      .from("jornadas")
      .select("id, nombre")
      .eq("activa", true)
      .single();

    if (jornadaActiva) {
      setJornadaSeleccionada(jornadaActiva.id);
    }

    setParticipantes(participantesCount || 0);
    setJornadas(jornadasCount || 0);
    setPartidos(partidosCount || 0);

    // 4. Cargar datos para la gráfica y conteos
    await cargarDatosGrafica(jornadasData, jornadaActiva?.id);
  };

  const cargarDatosGrafica = async (jornadasData, idJornadaActiva) => {
    // Obtenemos TODAS las quinielas para procesarlas en el frontend (más eficiente que hacer N consultas)
    const { data: todasQuinielas } = await supabase
      .from("quinielas")
      .select("jornada_id, usuario_id");

    if (!todasQuinielas) return;

    // Conteo total de quinielas únicas (usuarios distintos en toda la app)
    const usuariosUnicosTotales = new Set(todasQuinielas.map((q) => q.usuario_id));
    setQuinielasTotales(usuariosUnicosTotales.size);

    // Procesar datos para la gráfica: agrupar por jornada
    const datosProcesados = (jornadasData || []).map((jornada) => {
      const quinielasDeEstaJornada = todasQuinielas.filter(
        (q) => Number(q.jornada_id) === Number(jornada.id)
      );
      
      // Contar usuarios ÚNICOS por jornada
      const usuariosUnicos = new Set(quinielasDeEstaJornada.map((q) => q.usuario_id));
      
      return {
        jornada_id: jornada.id,
        nombre: jornada.nombre || `Jornada ${jornada.id}`,
        cantidad: usuariosUnicos.size,
        esActiva: jornada.id === idJornadaActiva,
      };
    });

    setDatosGrafica(datosProcesados);

    // Calcular el valor máximo para escalar las barras de la gráfica (mínimo 1 para evitar división por cero)
    const max = Math.max(...datosProcesados.map((d) => d.cantidad), 1);
    setMaxQuinielas(max);
  };

  const cargarQuinielasJornada = (jornadaId) => {
    if (!jornadaId) {
      setJornadaSeleccionada("");
      return;
    }
    setJornadaSeleccionada(jornadaId);
    // Nota: El dato ya está en el estado `datosGrafica`, podríamos mostrarlo en un tooltip o tarjeta, 
    // pero la gráfica ya lo representa visualmente.
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        📊 Dashboard Administrativo
      </h1>

      {/* TARJETAS DE RESUMEN (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-600 text-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
          <h2 className="text-lg font-medium opacity-90">👥 Participantes</h2>
          <p className="text-4xl font-bold mt-2">{participantes}</p>
        </div>

        <div className="bg-green-600 text-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
          <h2 className="text-lg font-medium opacity-90">📅 Jornadas</h2>
          <p className="text-4xl font-bold mt-2">{jornadas}</p>
        </div>

        <div className="bg-orange-600 text-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
          <h2 className="text-lg font-medium opacity-90">⚽ Partidos</h2>
          <p className="text-4xl font-bold mt-2">{partidos}</p>
        </div>

        <div className="bg-purple-600 text-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
          <h2 className="text-lg font-medium opacity-90">✅ Quinielas (Total)</h2>
          <p className="text-4xl font-bold mt-2">{quinielasTotales}</p>
        </div>
      </div>

      {/* SECCIÓN DE LA GRÁFICA */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">📈 Participación por Jornada</h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            Usuarios únicos que enviaron quiniela
          </span>
        </div>

        {datosGrafica.length > 0 ? (
          <div className="flex items-end gap-2 sm:gap-4 h-64 mt-6 px-2">
            {datosGrafica.map((dato) => {
              // Calculamos el alto de la barra en porcentaje respecto al máximo
              const heightPercentage = (dato.cantidad / maxQuinielas) * 100;
              
              return (
                <div key={dato.jornada_id} className="flex-1 flex flex-col items-center group relative">
                  {/* Tooltip con el número exacto al pasar el mouse */}
                  <div className="absolute -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                    {dato.cantidad} quinielas
                  </div>
                  
                  {/* La barra */}
                  <div 
                    className={`w-full rounded-t-md transition-all duration-500 ease-out ${
                      dato.esActiva 
                        ? "bg-indigo-600 hover:bg-indigo-700 shadow-md" 
                        : "bg-indigo-300 hover:bg-indigo-400"
                    }`}
                    style={{ 
                      height: `${Math.max(heightPercentage, 4)}%`, // Mínimo 4% para que siempre sea visible
                      minHeight: "8px" 
                    }}
                  ></div>
                  
                  {/* Etiqueta del nombre de la jornada */}
                  <div className="text-xs mt-3 text-gray-600 truncate w-full text-center font-medium">
                    {dato.nombre}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            No hay datos de quinielas para mostrar aún.
          </div>
        )}
      </div>

      {/* SELECTOR DE JORNADA (Opcional, para filtrar vistas futuras) */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <label className="block mb-2 font-semibold text-gray-700">
          🔍 Consultar jornada específica:
        </label>
        <select
          value={jornadaSeleccionada}
          onChange={(e) => cargarQuinielasJornada(e.target.value)}
          className="border border-gray-300 p-2 rounded w-full max-w-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">-- Seleccionar Jornada --</option>
          {jornadasLista.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nombre} {j.activa ? "🟢 (Activa)" : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}