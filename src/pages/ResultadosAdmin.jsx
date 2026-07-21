import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function ResultadosAdmin() {
  const [partidos, setPartidos] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] =
    useState("");

  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarJornadas();
  }, []);

  const cargarJornadas = async () => {
    const { data, error } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setJornadas(data || []);

    const activa = data?.find(
      (jornada) => jornada.activa
    );

    if (activa) {
      setJornadaSeleccionada(activa.id);
      await cargarPartidos(activa.id);
    }
  };

  const cargarPartidos = async (jornadaId) => {
    if (!jornadaId) return;

    const { data, error } = await supabase
      .from("partidos")
      .select("*")
      .eq("jornada_id", jornadaId)
      .order("id");

    if (error) {
      console.error(error);
      return;
    }

    setPartidos(data || []);
  };

  const actualizarResultadoLocal = (
    id,
    resultado
  ) => {
    setPartidos((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, resultado }
          : p
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

        if (error) {
          throw error;
        }
      }

      alert(
        "Resultados guardados correctamente"
      );
    } catch (error) {
      alert(error.message);
    } finally {
      setGuardando(false);
    }
  };
  return (
    <div className="max-w-5xl mx-auto p-6">

      <div className="flex flex-wrap gap-4 items-center justify-between mb-6">

        <h1 className="text-3xl font-bold">
          Captura de Resultados
        </h1>

        <div className="flex gap-3">

          <select
            value={jornadaSeleccionada}
            onChange={(e) => {
              const jornadaId =
                e.target.value;

              setJornadaSeleccionada(
                jornadaId
              );

              cargarPartidos(jornadaId);
            }}
            className="border px-3 py-2 rounded"
          >
            {jornadas.map((jornada) => (
              <option
                key={jornada.id}
                value={jornada.id}
              >
                {jornada.nombre}
                {jornada.activa
                  ? " (Activa)"
                  : ""}
              </option>
            ))}
          </select>

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
      </div>

      {partidos.length === 0 ? (
        <div className="text-center text-gray-500 mt-10">
          No existen partidos para esta jornada.
        </div>
      ) : (
        partidos.map((partido) => (
          <div
            key={partido.id}
            className="border rounded p-4 mb-4"
          >
            <h3 className="font-semibold">
              {partido.local} vs{" "}
              {partido.visitante}
            </h3>

            <div className="mt-3">
              <select
                value={
                  partido.resultado || ""
                }
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
        ))
      )}
    </div>
  );
}