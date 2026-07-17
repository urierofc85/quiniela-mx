import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { obtenerHoraMexico } from "../services/horario"

export default function ResultadosAdmin() {
  const [partidos, setPartidos] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarPartidos();
  }, []);

  const cargarPartidos = async () => {
    const { data } = await supabase
      .from("partidos")
      .select("*")
      .order("id");

    setPartidos(data || []);
  };

  const actualizarResultadoLocal = (id, resultado) => {
    setPartidos((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, resultado } : p
      )
    );
  };

  const guardarResultados = async () => {
    setGuardando(true);

    try {
      for (const partido of partidos) {
        const { error } = await supabase
          .from("partidos")
          .update({
            resultado: partido.resultado,
          })
          .eq("id", partido.id);

        if (error) throw error;
      }

      alert("Resultados guardados correctamente");
    } catch (error) {
      alert(error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          Captura de Resultados
        </h1>

        <button
          onClick={guardarResultados}
          disabled={guardando}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          {guardando
            ? "Guardando..."
            : "Guardar Resultados"}
        </button>
      </div>

      {partidos.map((partido) => (
        <div
          key={partido.id}
          className="border rounded p-4 mb-4"
        >
          <h3 className="font-semibold">
            {partido.local} vs {partido.visitante}
          </h3>

          <div className="mt-3">
            <select
              value={partido.resultado || ""}
              className="border p-2 rounded"
              onChange={(e) =>
                actualizarResultadoLocal(
                  partido.id,
                  e.target.value
                )
              }
            >
              <option value="">
                Seleccionar resultado
              </option>

              <option value="L">
                Gana Local
              </option>

              <option value="E">
                Empate
              </option>

              <option value="V">
                Gana Visitante
              </option>
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}