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

  // 🚨 FUNCIÓN PARA TRAER TODOS LOS REGISTROS (SIN LÍMITE DE 1000)
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
      // 1. Traer todos los datos necesarios (agregamos 'rol' y 'solo_survivor')
      const [perfilesRes, todasQuinielas, todosPartidos] = await Promise.all([
        supabase.from("profiles").select("id, nombre, nombre_usuario, email, rol, solo_survivor"),
        fetchAllRows("quinielas", "usuario_id, partido_id, pronostico"),
        fetchAllRows("partidos", "id, jornada_id, resultado, pospuesto")
      ]);

      const perfiles = perfilesRes.data || [];

      // Función auxiliar para identificar admins (misma lógica que en AdminDashboard)
      const esAdmin = (p) => {
        const rol = (p.rol || "").toLowerCase();
        const email = (p.email || "").toLowerCase();
        const nombre = (p.nombre_usuario || p.nombre || "").toLowerCase();
        return rol === "admin" || email.includes("admin") || nombre.includes("admin") || email.includes("root");
      };

      // 2. Filtrar partidos válidos: NO pospuestos y CON resultado
      const partidosValidos = todosPartidos.filter(
        (p) => p.pospuesto !== true && p.resultado
      );

      // 3. Si es una jornada específica, filtrar aún más
      const partidosAContar =
        jornadaSeleccionada === "general"
          ? partidosValidos
          : partidosValidos.filter(
              (p) => String(p.jornada_id) === String(jornadaSeleccionada)
            );

      // 4. Inicializar marcador SOLO para usuarios válidos
      const scores = {};
      perfiles.forEach((p) => {
        // 🚨 EXCLUIR ADMINS Y USUARIOS SOLO SURVIVOR
        if (esAdmin(p)) return;
        if (p.solo_survivor === true) return;

        scores[p.id] = {
          usuario_id: p.id,
          nombre_usuario: p.nombre_usuario || p.nombre || p.email || "Usuario",
          aciertos: 0,
        };
      });

      // 5. Contar aciertos solo en partidos válidos
      todasQuinielas.forEach((q) => {
        const partido = partidosAContar.find(
          (p) => String(p.id) === String(q.partido_id)
        );
        
        // Si el partido es válido y el pronóstico coincide con el resultado
        if (partido && q.pronostico === partido.resultado) {
          if (scores[q.usuario_id]) {
            scores[q.usuario_id].aciertos += 1;
          }
        }
      });

      // 6. Convertir a array y ordenar (Primero por aciertos desc, luego por nombre)
      const rankingCalculado = Object.values(scores).sort((a, b) => {
        if (b.aciertos !== a.aciertos) {
          return b.aciertos - a.aciertos;
        }
        return a.nombre_usuario.localeCompare(b.nombre_usuario);
      });

      setRanking(rankingCalculado);
    } catch (error) {
      console.error("Error cargando ranking:", error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">🏆 Ranking</h1>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="font-semibold">Jornada:</label>
        <select
          value={jornadaSeleccionada}
          onChange={(e) => setJornadaSeleccionada(e.target.value)}
          className="border p-2 rounded bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
        >
          <option value="general">🏆 Ranking General (Acumulado)</option>
          {jornadas.map((jornada) => (
            <option key={jornada.id} value={jornada.id}>
              {jornada.nombre}
            </option>
          ))}
        </select>
      </div>

      {cargando ? (
        <div className="text-center py-8 text-gray-600">
          Calculando posiciones...
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-lg">
              Participantes:{" "}
              <span className="font-bold text-green-700">
                {ranking.length}
              </span>
            </p>
          </div>

          <div className="border rounded-lg overflow-hidden shadow bg-white">
            <table className="w-full">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-3 text-left w-24">Posición</th>
                  <th className="p-3 text-left">Usuario</th>
                  <th className="p-3 text-center w-32">Aciertos</th>
                </tr>
              </thead>

              <tbody>
                {ranking.map((fila, index) => {
                  let medalla = "";
                  let rowClass = "border-t hover:bg-gray-50 transition";
                  
                  if (index === 0) {
                    medalla = "🥇";
                    rowClass = "border-t bg-yellow-50";
                  } else if (index === 1) {
                    medalla = "🥈";
                    rowClass = "border-t bg-gray-50";
                  } else if (index === 2) {
                    medalla = "🥉";
                    rowClass = "border-t bg-orange-50";
                  }

                  return (
                    <tr key={`${fila.usuario_id}-${index}`} className={rowClass}>
                      <td className="p-3 font-bold text-gray-800">
                        {medalla} {index + 1}
                      </td>
                      <td className="p-3 text-gray-800 font-medium">
                        {fila.nombre_usuario}
                      </td>
                      <td className="p-3 text-center font-bold text-green-700 text-lg">
                        {fila.aciertos}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {ranking.length > 0 && ranking[0].aciertos > 0 && (
            <div className="mt-6 bg-green-50 border border-green-200 p-4 rounded-lg shadow-sm">
              <h2 className="font-bold text-lg text-green-800 flex items-center gap-2">
                👑 Líder Actual
              </h2>
              <p className="text-green-900 font-semibold text-xl mt-1">
                {ranking[0].nombre_usuario}
              </p>
              <p className="text-green-700">
                Aciertos acumulados: <span className="font-bold">{ranking[0].aciertos}</span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}