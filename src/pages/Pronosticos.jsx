import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

export default function Pronosticos() {
  const navigate = useNavigate();
  const [partidos, setPartidos] = useState([]);
  const [equiposMap, setEquiposMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [tabActiva, setTabActiva] = useState("proximos");

  useEffect(() => {
    const autorizado = sessionStorage.getItem("pronosticos_autorizado");
    if (!autorizado) {
      navigate("/acceso-pronosticos");
      return;
    }
    cargarDatos();
  }, [navigate]);

  const cargarDatos = async () => {
    try {
      setLoading(true);

      const [{ data: partidosData, error: errorPartidos }, { data: equiposData, error: errorEquipos }] = await Promise.all([
        supabase.from("pronosticos_partidos").select("*").order("fecha_partido", { ascending: false }),
        supabase.from("pronosticos_equipos").select("*"),
      ]);

      if (errorPartidos || errorEquipos) {
        console.error("Error cargando datos:", errorPartidos || errorEquipos);
        return;
      }

      // 🆕 Crear mapa con normalización y aliases
      const normalizar = (texto) => texto?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      
      const mapa = new Map();
      equiposData?.forEach((eq) => {
        mapa.set(normalizar(eq.equipo), eq);
      });
      
      // 🆕 Diccionario de aliases (mismo que en AdminPronosticosPartidos)
      const alias = {
        "san luis": "san luis",
        "atletico san luis": "san luis",
        "santos": "santos",
        "santos laguna": "santos",
        "necaxa": "necaxa",
        "club necaxa": "necaxa",
        guadalajara: "chivas",
        "chivas rayadas del guadalajara": "chivas",
        "cd guadalajara": "chivas",
        chivas: "chivas",
        "tigres uanl": "tigres",
        tigres: "tigres",
        "cruz azul": "cruz azul",
        "cd cruz azul": "cruz azul",
        "club cruz azul": "cruz azul",
        cruzazul: "cruz azul",
        "fc juarez": "juarez",
        "fc juárez": "juarez",
        juarez: "juarez",
        "juárez": "juarez",
        "club america": "america",
        "club américa": "america",
        "cf america": "america",
        "cf américa": "america",
        america: "america",
        "pumas unam": "pumas",
        "unam pumas": "pumas",
        pumas: "pumas",
        "cf monterrey": "monterrey",
        monterrey: "monterrey",
        rayados: "monterrey",
        "deportivo toluca": "toluca",
        "deportivo toluca fc": "toluca",
        toluca: "toluca",
        "club leon": "leon",
        "club león": "leon",
        "club leon fc": "leon",
        leon: "leon",
        "león": "leon",
        "cf pachuca": "pachuca",
        pachuca: "pachuca",
        tuzos: "pachuca",
        "club tijuana": "tijuana",
        tijuana: "tijuana",
        xolos: "tijuana",
        "atlas guadalajara": "atlas",
        "club atlas": "atlas",
        atlas: "atlas",
        "queretaro fc": "queretaro",
        "querétaro fc": "queretaro",
        queretaro: "queretaro",
        "querétaro": "queretaro",
        "club puebla": "puebla",
        puebla: "puebla",
        "mazatlan fc": "mazatlan",
        "mazatlán fc": "mazatlan",
        mazatlan: "mazatlan",
        "mazatlán": "mazatlan",
        "cf atlante": "atlante",
        atlante: "atlante",
      };

      const obtenerEquipo = (nombre) => {
        const clave = normalizar(nombre);
        return mapa.get(alias[clave] || clave);
      };

      setEquiposMap(mapa);

      // Fusionar datos de partidos con las estadísticas de los equipos
      const datosFusionados = partidosData.map((partido) => {
        const local = obtenerEquipo(partido.local) || {};
        const visita = obtenerEquipo(partido.visita) || {};

        // 🆕 Calcular confianza basada en la diferencia de probabilidades
        const probMax = Math.max(
          partido.prob_local || 0,
          partido.prob_empate || 0,
          partido.prob_visita || 0
        );
        
        // Confianza = qué tan alta es la probabilidad del pronóstico ganador
        // Si el sistema dice LOCAL con 60%, confianza = 60%
        const confianza = partido.pronostico ? probMax : 0;

        return {
          ...partido,
          confianza: confianza,
          statsLocal: {
            rating: local.rating_total || 0,
            forma: local.puntos_ultimos5 || 0,
            posicion: local.posicion || "-",
            puntos: local.puntos || 0,
            valor: local.valor_plantilla || 0,
          },
          statsVisita: {
            rating: visita.rating_total || 0,
            forma: visita.puntos_ultimos5 || 0,
            posicion: visita.posicion || "-",
            puntos: visita.puntos || 0,
            valor: visita.valor_plantilla || 0,
          },
        };
      });

      setPartidos(datosFusionados);
    } catch (error) {
      console.error("Error crítico:", error);
    } finally {
      setLoading(false);
    }
  };

  const partidosProximos = partidos.filter((p) => !p.resultado_real);
  const partidosFinalizados = partidos.filter((p) => p.resultado_real);

  const totalValidados = partidosFinalizados.length;
  const aciertos = partidosFinalizados.filter((p) => p.acerto === true).length;
  const efectividad = totalValidados > 0 ? ((aciertos / totalValidados) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-screen">
        <div className="text-xl font-semibold text-gray-600 animate-pulse">Cargando datos y estadísticas...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">📈 Centro de Validación de Pronósticos</h1>
          <p className="text-gray-500 text-sm mt-1">Revisa las predicciones, estadísticas de los equipos y la efectividad del modelo.</p>
        </div>
        <button
          onClick={cargarDatos}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 shadow-sm"
        >
          🔄 Actualizar Datos
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTabActiva("proximos")}
          className={`pb-3 px-4 font-semibold transition border-b-2 ${
            tabActiva === "proximos" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          🔮 Próximos Partidos ({partidosProximos.length})
        </button>
        <button
          onClick={() => setTabActiva("historial")}
          className={`pb-3 px-4 font-semibold transition border-b-2 ${
            tabActiva === "historial" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          ✅ Historial y Validación ({totalValidados})
        </button>
      </div>

      {tabActiva === "proximos" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {partidosProximos.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No hay próximos partidos registrados o todos ya tienen resultado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3">Fecha / Jornada</th>
                    <th className="px-4 py-3">Partido</th>
                    <th className="px-4 py-3 text-center">Pronóstico del Sistema</th>
                    <th className="px-4 py-3 text-center">Confianza</th>
                    <th className="px-4 py-3 text-center">Stats Clave (Rating / Forma / Valor)</th>
                  </tr>
                </thead>
                <tbody>
                  {partidosProximos.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50 transition">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{p.fecha_partido?.split("T")[0]}</div>
                        <div className="text-xs text-gray-500">Jornada {p.jornada || "-"}</div>
                      </td>
                      <td className="px-4 py-4 font-bold text-gray-800 whitespace-nowrap">
                        {p.local} <span className="text-gray-400 font-normal">vs</span> {p.visita}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            p.pronostico === "LOCAL" ? "bg-blue-100 text-blue-800" :
                            p.pronostico === "EMPATE" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                          }`}
                        >
                          {p.pronostico || "Sin generar"}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {p.prob_local}% / {p.prob_empate}% / {p.prob_visita}%
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-bold text-gray-700">{p.confianza.toFixed(0)}%</span>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                p.confianza >= 60 ? 'bg-green-500' : 
                                p.confianza >= 45 ? 'bg-yellow-500' : 'bg-red-500'
                              }`} 
                              style={{ width: `${p.confianza}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-600">
                        <div className="flex justify-between mb-1">
                          <span>🏠 Rating: {p.statsLocal.rating} | Forma: {p.statsLocal.forma} | Valor: {p.statsLocal.valor}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>✈️ Rating: {p.statsVisita.rating} | Forma: {p.statsVisita.forma} | Valor: {p.statsVisita.valor}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tabActiva === "historial" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="text-sm text-gray-500 uppercase font-semibold">Partidos Validados</div>
              <div className="text-3xl font-bold text-gray-800 mt-1">{totalValidados}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="text-sm text-gray-500 uppercase font-semibold">Aciertos del Sistema</div>
              <div className="text-3xl font-bold text-green-600 mt-1">{aciertos}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="text-sm text-gray-500 uppercase font-semibold">Efectividad Global</div>
              <div className={`text-3xl font-bold mt-1 ${efectividad >= 55 ? "text-green-600" : "text-yellow-600"}`}>
                {efectividad}%
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {totalValidados === 0 ? (
              <div className="p-8 text-center text-gray-500">Aún no hay partidos finalizados para validar.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Partido</th>
                      <th className="px-4 py-3 text-center">Pronóstico Sistema</th>
                      <th className="px-4 py-3 text-center">Resultado Real</th>
                      <th className="px-4 py-3 text-center">¿Acierto?</th>
                      <th className="px-4 py-3 text-center">Goles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partidosFinalizados.map((p) => (
                      <tr key={p.id} className={`border-b hover:bg-gray-50 transition ${p.acerto ? "bg-green-50/30" : "bg-red-50/30"}`}>
                        <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                          {p.fecha_partido?.split("T")[0]}
                        </td>
                        <td className="px-4 py-4 font-bold text-gray-800 whitespace-nowrap">
                          {p.local} <span className="text-gray-400 font-normal">vs</span> {p.visita}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-semibold text-gray-700">{p.pronostico}</span>
                          <div className="text-xs text-gray-500">({p.prob_local}/{p.prob_empate}/{p.prob_visita})</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                            p.resultado_real === "LOCAL" ? "bg-blue-100 text-blue-800" :
                            p.resultado_real === "EMPATE" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                          }`}>
                            {p.resultado_real}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-2xl">
                          {p.acerto ? "✅" : "❌"}
                        </td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-gray-700">
                          {p.goles_local_real} - {p.goles_visita_real}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}