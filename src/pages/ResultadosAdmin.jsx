import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function ResultadosAdmin() {
  const [partidos, setPartidos] = useState([]);

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

  const guardarResultado = async (
    partidoId,
    resultado
  ) => {
    const { error } = await supabase
      .from("partidos")
      .update({ resultado })
      .eq("id", partidoId);

    if (error) {
      alert(error.message);
      return;
    }

    await cargarPartidos();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Captura de Resultados
      </h1>

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
                guardarResultado(
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
