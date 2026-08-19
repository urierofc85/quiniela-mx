import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function Dashboard() {
  const [participantes, setParticipantes] = useState(0);
  const [jornadas, setJornadas] = useState(0);
  const [partidos, setPartidos] = useState(0);
  
  const [jornadasLista, setJornadasLista] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");
  const [jornadaActivaId, setJornadaActivaId] = useState(null);
  
  // Estados para la gráfica
  const [datosGrafica, setDatosGrafica] = useState([]);
  const [maxRegistros, setMaxRegistros] = useState(1);
  
  // Estados para lista de ausentes
  const [ausentesQuiniela, setAusentesQuiniela] = useState([]);
  const [ausentesSurvivor, setAusentesSurvivor] = useState([]);
  const [todosParticipantes, setTodosParticipantes] = useState([]);

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

    // 2. Obtener todas las jornadas
    const { data: jornadasData } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: true });

    setJornadasLista(jornadasData || []);

    // 3. Obtener jornada activa
    const { data: jornadaActiva } = await supabase
      .from("jornadas")
      .select("id, nombre")
      .eq("activa", true)
      .single();

    if (jornadaActiva) {
      setJornadaSeleccionada(jornadaActiva.id);
      setJornadaActivaId(jornadaActiva.id);
    }

    setParticipantes(participantesCount || 0);
    setJornadas(jornadasCount || 0);
    setPartidos(partidosCount || 0);

    // 4. Cargar todos los participantes para comparar
    await cargarTodosParticipantes();
    
    // 5. Cargar datos para la gráfica
    await cargarDatosGrafica(jornadasData, jornadaActiva?.id);
    
    // 6. Si hay jornada activa, cargar ausentes
    if (jornadaActiva?.id) {
      await cargarAusentesJornadaActiva(jornadaActiva.id);
    }
  };

  const cargarTodosParticipantes = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, nombre, nombre_usuario, email");
    
    if (data) {
      setTodosParticipantes(data);
    }
  };

  const cargarAusentesJornadaActiva = async (jornadaId) => {
    // Obtener quienes SÍ tienen quiniela en esta jornada
    const { data: quinielasData } = await supabase
      .from("quinielas")
      .select("usuario_id")
      .eq("jornada_id", jornadaId);
    
    // Obtener quienes SÍ tienen survivor en esta jornada
    const { data: survivorData } = await supabase
      .from("survivor")
      .select("usuario_id")
      .eq("jornada_id", jornadaId);
    
    // Crear sets de usuarios que ya registraron
    const usuariosConQuiniela = new Set(quinielasData?.map(q => q.usuario_id) || []);
    const usuariosConSurvivor = new Set(survivorData?.map(s => s.usuario_id) || []);
    
    // Filtrar quienes NO han registrado
    const ausentesQ = todosParticipantes.filter(p => !usuariosConQuiniela.has(p.id));
    const ausentesS = todosParticipantes.filter(p => !usuariosConSurvivor.has(p.id));
    
    setAusentesQuiniela(ausentesQ);
    setAusentesSurvivor(ausentesS);
  };

  const cargarDatosGrafica = async (jornadasData, idJornadaActiva) => {
    // Obtener TODAS las quinielas
    const { data: todasQuinielas } = await supabase
      .from("quinielas")
      .select("jornada_id, usuario_id");

    // Obtener TODOS los registros de survivor
    const { data: todosSurvivor } = await supabase
      .from("survivor")
      .select("jornada_id, usuario_id");

    if (!todasQuinielas && !todosSurvivor) return;

    // Procesar datos para la gráfica: agrupar por jornada
    const datosProcesados = (jornadasData || []).map((jornada) => {
      // Contar usuarios ÚNICOS con quiniela en esta jornada
      const quinielasDeEstaJornada = (todasQuinielas || []).filter(
        (q) => Number(q.jornada_id) === Number(jornada.id)
      );
      const usuariosUnicosQuiniela = new Set(quinielasDeEstaJornada.map((q) => q.usuario_id));
      
      // Contar usuarios ÚNICOS con survivor en esta jornada
      const survivorDeEstaJornada = (todosSurvivor || []).filter(
        (s) => Number(s.jornada_id) === Number(jornada.id)
      );
      const usuariosUnicosSurvivor = new Set(survivorDeEstaJornada.map((s) => s.usuario_id));
      
      return {
        jornada_id: jornada.id,
        nombre: jornada.nombre || `Jornada ${jornada.id}`,
        quinielas: usuariosUnicosQuiniela.size,
        survivor: usuariosUnicosSurvivor.size,
        total: usuariosUnicosQuiniela.size + usuariosUnicosSurvivor.size,
        esActiva: jornada.id === idJornadaActiva,
      };
    });

    setDatosGrafica(datosProcesados);

    // Calcular el valor máximo para escalar las barras
    const max = Math.max(...datosProcesados.map((d) => Math.max(d.quinielas, d.survivor)), 1);
    setMaxRegistros(max);
  };

  const getNombreUsuario = (participante) => {
    return participante.nombre_usuario || 
           participante.nombre || 
           participante.email || 
           'Sin nombre';
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        📊 Dashboard Administrativo
      </h1>

      {/* TARJETAS DE RESUMEN (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-600 text-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
          <h2 className="text-lg font-medium opacity-90"> Participantes</h2>
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
          <h2 className="text-lg font-medium opacity-90"> Jornada Activa</h2>
          <p className="text-xl font-bold mt-2">
            {jornadasLista.find(j => j.id === jornadaActivaId)?.nombre || 'Ninguna'}
          </p>
        </div>
      </div>

      {/* SECCIÓN DE LA GRÁFICA COMPARATIVA */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800"> Participación por Jornada</h2>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-gray-600">Quiniela</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded"></div>
              <span className="text-gray-600">Survivor</span>
            </div>
          </div>
        </div>

        {datosGrafica.length > 0 ? (
          <div className="flex items-end gap-3 sm:gap-4 h-72 mt-6 px-2">
            {datosGrafica.map((dato) => {
              const quinielaHeight = (dato.quinielas / maxRegistros) * 100;
              const survivorHeight = (dato.survivor / maxRegistros) * 100;
              
              return (
                <div key={dato.jornada_id} className="flex-1 flex flex-col items-center gap-2 group">
                  {/* Contenedor de las dos barras */}
                  <div className="w-full flex gap-1 items-end justify-center h-64">
                    {/* Barra Quiniela */}
                    <div className="flex-1 flex flex-col items-center relative">
                      <div className="absolute -top-8 bg-blue-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-semibold">
                        Q: {dato.quinielas}
                      </div>
                      <div 
                        className={`w-full rounded-t transition-all duration-500 ease-out ${
                          dato.esActiva ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-400 hover:bg-blue-500"
                        }`}
                        style={{ 
                          height: `${Math.max(quinielaHeight, 2)}%`,
                          minHeight: "4px"
                        }}
                      ></div>
                    </div>
                    
                    {/* Barra Survivor */}
                    <div className="flex-1 flex flex-col items-center relative">
                      <div className="absolute -top-8 bg-emerald-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-semibold">
                        S: {dato.survivor}
                      </div>
                      <div 
                        className={`w-full rounded-t transition-all duration-500 ease-out ${
                          dato.esActiva ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-400 hover:bg-emerald-500"
                        }`}
                        style={{ 
                          height: `${Math.max(survivorHeight, 2)}%`,
                          minHeight: "4px"
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Nombre de la jornada */}
                  <div className={`text-xs mt-2 text-center font-medium truncate w-full ${
                    dato.esActiva ? "text-indigo-700 font-bold" : "text-gray-600"
                  }`}>
                    {dato.nombre}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            No hay datos de participación para mostrar.
          </div>
        )}
      </div>

      {/* SECCIÓN DE AUSENTES EN JORNADA ACTIVA */}
      {jornadaActivaId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Ausentes Quiniela */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  {ausentesQuiniela.length}
                </span>
                ❌ Faltan Quiniela
              </h2>
              <span className="text-sm text-gray-500">
                {jornadasLista.find(j => j.id === jornadaActivaId)?.nombre}
              </span>
            </div>
            
            {ausentesQuiniela.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                <ul className="space-y-2">
                  {ausentesQuiniela.map((participante) => (
                    <li 
                      key={participante.id} 
                      className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-sm"
                    >
                      <span className="text-red-600 font-bold">•</span>
                      <span className="text-gray-700 font-medium">
                        {getNombreUsuario(participante)}
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

          {/* Ausentes Survivor */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">
                  {ausentesSurvivor.length}
                </span>
                🦖 Faltan Survivor
              </h2>
              <span className="text-sm text-gray-500">
                {jornadasLista.find(j => j.id === jornadaActivaId)?.nombre}
              </span>
            </div>
            
            {ausentesSurvivor.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                <ul className="space-y-2">
                  {ausentesSurvivor.map((participante) => (
                    <li 
                      key={participante.id} 
                      className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm"
                    >
                      <span className="text-orange-600 font-bold">•</span>
                      <span className="text-gray-700 font-medium">
                        {getNombreUsuario(participante)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-8 text-green-600 bg-green-50 rounded border border-green-200">
                <p className="font-semibold">✅ ¡Todos han registrado su survivor!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SELECTOR DE JORNADA */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <label className="block mb-2 font-semibold text-gray-700">
          🔍 Consultar jornada específica:
        </label>
        <select
          value={jornadaSeleccionada}
          onChange={(e) => setJornadaSeleccionada(e.target.value)}
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