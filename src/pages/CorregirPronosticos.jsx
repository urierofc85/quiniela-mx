import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function CorregirPronosticos() {
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");
  const [partidos, setPartidos] = useState([]);

  useEffect(() => {
    cargarJornadas();
  }, []);

  const cargarJornadas = async () => {
    const { data, error } = await supabase
      .from("jornadas")
      .select("*")
      .order("id");

    if (error) {
      console.error(error);
      return;
    }

    setJornadas(data || []);
  };

  const cargarPartidos = async (jornadaId) => {
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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Corrección de Pronósticos
      </h1>

      <div className="mb-6">
        <select
          className="border p-2 rounded"
          value={jornadaSeleccionada}
          onChange={(e) => {
            setJornadaSeleccionada(e.target.value);
            cargarPartidos(e.target.value);
          }}
        >
          <option value="">Selecciona una jornada</option>

          {jornadas.map((jornada) => (
            <option
              key={jornada.id}
              value={jornada.id}
            >
              {jornada.nombre}
            </option>
          ))}
        </select>
      </div>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Local</th>
            <th className="border p-2">Visitante</th>
            <th className="border p-2">Resultado</th>
            <th className="border p-2">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {partidos.map((partido) => (
            <tr key={partido.id}>
              <td className="border p-2">{partido.local}</td>
              <td className="border p-2">{partido.visitante}</td>
              <td className="border p-2">
                {partido.resultado || "Sin resultado"}
              </td>

              <td className="border p-2">
                <button className="bg-blue-600 text-white px-3 py-1 rounded">
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}