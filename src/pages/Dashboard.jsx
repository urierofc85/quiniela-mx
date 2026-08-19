import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { obtenerHoraMexico } from "../services/horario";

export default function Dashboard() {
  const [participantes, setParticipantes] = useState(0);
  const [jornadas, setJornadas] = useState(0);
  const [partidos, setPartidos] = useState(0);
  
  const [jornadasLista, setJornadasLista] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");
  const [jornadaActivaId, setJornadaActivaId] = useState(null);
  
  const [datosGrafica, setDatosGrafica] = useState([]);
  const [maxRegistros, setMaxRegistros] = useState(1);
  
  const [ausentesQuiniela, setAusentesQuiniela] = useState([]);
  const [ausentesSurvivor, setAusentesSurvivor] = useState([]);

  useEffect(() => {
    cargarDashboard();
  }, []);

  // Función para identificar al admin (AJUSTA ESTO si tu admin tiene otro formato de email/nombre)
  const esAdmin = (p) => {
    const email = (p.email || "").toLowerCase();
    const nombre = (p.nombre_usuario || p.nombre || "").toLowerCase();
    return email.includes("admin") || nombre.includes("admin") || email.includes("root");
  };

  const cargarDashboard = async () => {
    const ahora = await obtenerHoraMexico();

    // 1. Conteos generales
    const { count: participantesCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    const { count: jornadasCount } = await supabase.from("jornadas").select("*", { count: "exact", head: true });
    const { count: partidosCount } = await supabase.from("partidos").select("*", { count: "exact", head: true });

    // 2. Obtener todas las jornadas
    const { data: jornadasData } = await supabase.from("jornadas").select("*").order("id", { ascending: true });
    setJornadasLista(jornadasData || []);

    // 3. Obtener jornada activa
    const { data: jornadaActiva } = await supabase.from("jornadas").select("id, nombre").eq("activa", true).single();
    if (jornadaActiva) {
      setJornadaSeleccionada(jornadaActiva.id);
      setJornadaActivaId(jornadaActiva.id);
    }

    setParticipantes(participantesCount || 0);
    setJornadas(jornadasCount || 0);
    setPartidos(partidosCount || 0);

    // 4. Obtener todos los participantes y datos históricos para los filtros
    const { data: participantesData } = await supabase.from("profiles").select("id, nombre, nombre_usuario, email");
    const listaParticipantes = participantesData || [];

    const { data: todasQuinielas } = await supabase.from("quinielas").select("jornada_id, usuario_id");
    const { data: todosSurvivor } = await supabase.from("survivor").select("jornada_id, usuario_id, equipo");
    const { data: todosPartidos } = await supabase.from("partidos").select("jornada_id, local, visitante, resultado");

    // 5. Procesar datos para la gráfica
    await cargarDatosGrafica(jornadasData, jornadaActiva?.id, todasQuinielas, todosSurvivor);

    // 6. Calcular ausentes con filtros inteligentes
    if (jornadaActiva?.id && listaParticipantes.length > 0) {
      calcularAusentesInteligentes(
        jornadaActiva.id, 
        jornadasData, 
        listaParticipantes, 
        todasQuinielas, 
        todosSurvivor, 
        todosPartidos,
        ahora
      );
    }
  };

  const calcularAusentesInteligentes = (
    idJornadaActiva, 
    jornadasData, 
    listaParticipantes, 
    todasQuinielas, 
    todosSurvivor, 
    todosPartidos,
    ahora
  ) => {
    // --- PREPARACIÓN DE DATOS ---
    const jornadasHastaActiva = jornadasData.filter(j => j.id <= idJornadaActiva).length;
    
    // Contadores por usuario
    const quinielasCount = {};
    const survivorCount = {};
    const vidasPerdidas = {};

    // Inicializar contadores
    listaParticipantes.forEach(p => {
      quinielasCount[p.id] = 0;
      survivorCount[p.id] = 0;
      vidasPerdidas[p.id] = 0;
    });

    // Contar quinielas y survivor por usuario
    todasQuinielas?.forEach(q => {
      if (q.jornada_id <= idJornadaActiva) {
        quinielasCount[q.usuario_id] = (quinielasCount[q.usuario_id] || 0) + 1;
      }
    });

    todosSurvivor?.forEach(s => {
      if (s.jornada_id <= idJornadaActiva) {
        survivorCount[s.usuario_id] = (survivorCount[s.usuario_id] || 0) + 1;
      }
    });

    // Calcular vidas perdidas en Survivor (Lógica idéntica al Ranking)
    jornadasData.filter(j => j.id <= idJornadaActiva).forEach(jornada => {
      const esPasadaYCerrada = jornada.fecha_limite ? ahora > new Date(jornada.fecha_limite) : false;

      listaParticipantes.forEach(usuario => {
        const seleccion = todosSurvivor?.find(s => s.usuario_id === usuario.id && Number(s.jornada_id) === Number(jornada.id));

        // Caso A: No seleccionó y la jornada cerró
        if (!seleccion && esPasadaYCerrada) {
          if (vidasPerdidas[usuario.id] < 3) vidasPerdidas[usuario.id] += 1;
          return;
        }

        // Caso B: Sí seleccionó, verificar si perdió
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

    // --- FILTRADO DE AUSENTES ---
    const quinielasActivaIds = new Set(todasQuinielas?.filter(q => q.jornada_id === idJornadaActiva).map(q => q.usuario_id) || []);
    const survivorActivaIds = new Set(todosSurvivor?.filter(s => s.jornada_id === idJornadaActiva).map(s => s.usuario_id) || []);

    // 1. Filtro Quiniela: Faltan en la activa Y no han faltado más de 1 jornada en total
    const ausentesQ = listaParticipantes.filter(p => {
      if (esAdmin(p)) return false; // Excluir admin
      if (!quinielasActivaIds.has(p.id)) {
        const totalQ = quinielasCount[p.id] || 0;
        const jornadasFaltadas = jornadasHastaActiva - totalQ;
        // Si faltó 1 o menos jornadas, sigue participando. Si faltó > 1, está inactivo.
        return jornadasFaltadas <= 1; 
      }
      return false;
    });

    // 2. Filtro Survivor: Faltan en la activa Y NO están eliminados (vidas < 3)
    const ausentesS = listaParticipantes.filter(p => {
      if (esAdmin(p)) return false; // Excluir admin
      if (!survivorActivaIds.has(p.id)) {
        const vidas = vidasPerdidas[p.id] || 0;
        // Solo mostrar si tiene menos de 3 vidas (no está eliminado)
        // Opcional: Si quieres excluir a los que NUNCA han jugado survivor, agrega: && survivorCount[p.id] > 0
        return vidas < 3; 
      }
      return false;
    });

    setAusentesQuiniela(ausentesQ);
    setAusentesSurvivor(ausentesS);

    console.log("📊 Depuración Ausentes:", {
      totalParticipantes: listaParticipantes.length,
      ausentesQuinielaFiltrados: ausentesQ.length,
      ausentesSurvivorFiltrados: ausentesS.length,
    });
  };

  const cargarDatosGrafica = async (jornadasData, idJornadaActiva, todasQuinielas, todosSurvivor) => {
    const datosProcesados = (jornadasData || []).map((jornada) => {
      const qJornada = (todasQuinielas || []).filter(q => Number(q.jornada_id) === Number(jornada.id));
      const sJornada = (todosSurvivor || []).filter(s => Number(s.jornada_id) === Number(jornada.id));
      
      return {
        jornada_id: jornada.id,
        nombre: jornada.nombre || `Jornada ${jornada.id}`,
        quinielas: new Set(qJornada.map(q => q.usuario_id)).size,
        survivor: new Set(sJornada.map(s => s.usuario_id)).size,
        esActiva: jornada.id === idJornadaActiva,
      };
    });

    setDatosGrafica(datosProcesados);
    const max = Math.max(...datosProcesados.map((d) => Math.max(d.quinielas, d.survivor)), 1);
    setMaxRegistros(max);
  };

  const getNombreUsuario = (p) => {
    return p.nombre_usuario || p.nombre || (p.email ? p.email.split('@')[0] : 'Usuario');
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">📊 Dashboard Administrativo</h1>

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
          <h2 className="text-lg font-medium opacity-90">🎯 Jornada Activa</h2>
          <p className="text-xl font-bold mt-2">
            {jornadasLista.find(j => j.id === jornadaActivaId)?.nombre || 'Ninguna'}
          </p>
        </div>
      </div>

      {/* SECCIÓN DE LA GRÁFICA COMPARATIVA */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">📈 Participación por Jornada</h2>
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
                  <div className="w-full flex gap-1 items-end justify-center h-64">
                    <div className="flex-1 flex flex-col items-center relative">
                      <div className="absolute -top-8 bg-blue-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-semibold">
                        Q: {dato.quinielas}
                      </div>
                      <div 
                        className={`w-full rounded-t transition-all duration-500 ease-out ${dato.esActiva ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-400 hover:bg-blue-500"}`}
                        style={{ height: `${Math.max(quinielaHeight, 2)}%`, minHeight: "4px" }}
                      ></div>
                    </div>
                    <div className="flex-1 flex flex-col items-center relative">
                      <div className="absolute -top-8 bg-emerald-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-semibold">
                        S: {dato.survivor}
                      </div>
                      <div 
                        className={`w-full rounded-t transition-all duration-500 ease-out ${dato.esActiva ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-400 hover:bg-emerald-500"}`}
                        style={{ height: `${Math.max(survivorHeight, 2)}%`, minHeight: "4px" }}
                      ></div>
                    </div>
                  </div>
                  <div className={`text-xs mt-2 text-center font-medium truncate w-full ${dato.esActiva ? "text-indigo-700 font-bold" : "text-gray-600"}`}>
                    {dato.nombre}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">No hay datos de participación para mostrar.</div>
        )}
      </div>

      {/* SECCIÓN DE AUSENTES EN JORNADA ACTIVA */}
      {jornadaActivaId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Ausentes Quiniela */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">
                  {ausentesQuiniela.length}
                </span>
                ❌ Faltan Quiniela
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

          {/* Ausentes Survivor */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-bold">
                  {ausentesSurvivor.length}
                </span>
                🦖 Faltan Survivor
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

      {/* SELECTOR DE JORNADA */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <label className="block mb-2 font-semibold text-gray-700">🔍 Consultar jornada específica:</label>
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