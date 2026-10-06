import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function Posiciones() {
  const [ranking, setRanking] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("general");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    cargarJornadas();
  }, []);

  useEffect(() => {
    if (jornadaSeleccionada) {
      cargarRanking();
    }
  }, [jornadaSeleccionada]);

  const cargarJornadas = async () => {
    const { data, error } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Error cargando jornadas:", error);
      return;
    }
    setJornadas(data || []);
  };

  const fetchAllRows = async (tableName, columns) => {
    let allData = [];
    let from = 0;
    let to = 999;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from(tableName)
        .select(columns)
        .order("id", { ascending: false })
        .range(from, to);

      if (error) {
        console.error(`Error fetching ${tableName}:`, error);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData = [...allData, ...data];
        if (data.length < 1000) {
          hasMore = false;
        } else {
          from += 1000;
          to += 1000;
        }
      }
    }
    return allData;
  };

  const cargarRanking = async () => {
    setCargando(true);
    try {
      const [perfilesRes, todasQuinielas, todosPartidos] = await Promise.all([
        supabase.from("profiles").select("id, nombre, nombre_usuario, email, rol, solo_survivor"),
        fetchAllRows("quinielas", "usuario_id, partido_id, pronostico"),
        fetchAllRows("partidos", "id, jornada_id, resultado, pospuesto")
      ]);

      const perfiles = perfilesRes.data || [];

      const esAdmin = (p) => {
        const rol = (p.rol || "").toLowerCase();
        const email = (p.email || "").toLowerCase();
        const nombre = (p.nombre_usuario || p.nombre || "").toLowerCase();
        return rol === "admin" || email.includes("admin") || nombre.includes("admin") || email.includes("root");
      };

      const partidosValidos = todosPartidos.filter((p) => {
        const esPospuesto = p.pospuesto === true || String(p.pospuesto).toLowerCase() === 'true';
        return !esPospuesto && p.resultado;
      });

      const partidosAContar =
        jornadaSeleccionada === "general"
          ? partidosValidos
          : partidosValidos.filter((p) => String(p.jornada_id) === String(jornadaSeleccionada));

      const scores = {};
      perfiles.forEach((p) => {
        if (esAdmin(p)) return;
        if (p.solo_survivor === true) return;

        scores[p.id] = {
          usuario_id: p.id,
          nombre_usuario: p.nombre_usuario || p.nombre || p.email || "Usuario",
          aciertos: 0,
        };
      });

      const quinielasProcesadas = new Set(); 
      
      todasQuinielas.forEach((q) => {
        const uniqueKey = `${q.usuario_id}_${q.partido_id}`;
        if (quinielasProcesadas.has(uniqueKey)) return; 
        quinielasProcesadas.add(uniqueKey);

        const partido = partidosAContar.find((p) => String(p.id) === String(q.partido_id));
        const pronosticoLimpio = String(q.pronostico || "").trim().toUpperCase();
        const resultadoLimpio = String(partido?.resultado || "").trim().toUpperCase();

        if (partido && pronosticoLimpio === resultadoLimpio) {
          if (scores[q.usuario_id]) {
            scores[q.usuario_id].aciertos += 1;
          }
        }
      });

      const rankingCalculado = Object.values(scores).sort((a, b) => {
        if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos;
        return a.nombre_usuario.localeCompare(b.nombre_usuario);
      });

      setRanking(rankingCalculado);
    } catch (error) {
      console.error("Error cargando ranking:", error);
    } finally {
      setCargando(false);
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg font-bold text-slate-800">Calculando posiciones...</p>
        </div>
      </div>
    );
  }

  const lider = ranking.length > 0 && ranking[0].aciertos > 0 ? ranking[0] : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="text-indigo-600">🏆</span> Ranking General
            </h1>
            <p className="text-slate-500 mt-1">Clasificación acumulada de aciertos en quinielas.</p>
          </div>
        </div>

        {/* Filtro de Jornada */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            <label className="text-sm font-bold text-slate-700 whitespace-nowrap">Filtrar por:</label>
            <select
              value={jornadaSeleccionada}
              onChange={(e) => setJornadaSeleccionada(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
            >
              <option value="general">🏆 Ranking General (Acumulado)</option>
              {jornadas.map((j) => (
                <option key={j.id} value={j.id}>{j.nombre}</option>
              ))}
            </select>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
            {ranking.length} Participantes
          </span>
        </div>

        {/* 🚨 Tarjeta del Líder (Solo si hay aciertos) */}
        {lider && (
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-6 shadow-sm flex items-center gap-5">
            <div className="bg-yellow-400 text-white p-4 rounded-2xl shadow-md shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-black text-yellow-800 uppercase tracking-wider mb-1">👑 Líder Actual</p>
              <h2 className="text-2xl font-black text-slate-900">{lider.nombre_usuario}</h2>
              <p className="text-yellow-700 font-medium mt-1">
                Con <span className="font-black text-yellow-900 text-lg">{lider.aciertos}</span> aciertos acumulados
              </p>
            </div>
          </div>
        )}

        {/* Tabla de Ranking */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-black uppercase tracking-wider">
                  <th className="px-6 py-4 w-24 text-center">Posición</th>
                  <th className="px-6 py-4">Participante</th>
                  <th className="px-6 py-4 w-32 text-center">Aciertos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranking.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No hay datos de ranking disponibles para esta selección.
                    </td>
                  </tr>
                ) : (
                  ranking.map((fila, index) => {
                    const pos = index + 1;
                    let rowClass = "hover:bg-slate-50 transition-colors";
                    let posBadgeClass = "bg-slate-100 text-slate-600";
                    let medalla = "";

                    if (pos === 1) {
                      rowClass = "bg-yellow-50/50 hover:bg-yellow-100/50 transition-colors";
                      posBadgeClass = "bg-yellow-100 text-yellow-700 font-black";
                      medalla = "🥇";
                    } else if (pos === 2) {
                      posBadgeClass = "bg-slate-200 text-slate-700 font-black";
                      medalla = "🥈";
                    } else if (pos === 3) {
                      posBadgeClass = "bg-orange-100 text-orange-800 font-black";
                      medalla = "🥉";
                    }

                    return (
                      <tr key={`${fila.usuario_id}-${index}`} className={rowClass}>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm ${posBadgeClass}`}>
                            {pos <= 3 ? medalla : pos}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-800">
                          {fila.nombre_usuario}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 font-black text-xl border border-indigo-100">
                            {fila.aciertos}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}