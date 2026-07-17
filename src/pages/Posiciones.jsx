import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { obtenerHoraMexico } from "../services/horario"

export default function Posiciones() {
  const [ranking, setRanking] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");

useEffect(() => {
  cargarJornadas();
}, []);

const cargarJornadas = async () => {
  const { data } = await supabase
    .from("jornadas")
    .select("*")
    .order("id", { ascending: false });

  setJornadas(data || []);

  if (data && data.length > 0) {
    setJornadaSeleccionada(data[0].id);
  }
};


  
useEffect(() => {
  if (jornadaSeleccionada) {
    cargarRanking();
  }
}, [jornadaSeleccionada]);


  const cargarRanking = async () => {
    
const { data, error } = await supabase
  .from("ranking_jornada")
  .select("*")
  .eq(
    "jornada_id",
    Number(jornadaSeleccionada)
  )
  .order("aciertos", {
    ascending: false,
  });


      console.log("RANKING:", data);

    if (error) {
      console.log(error);
      return;
      
    }

    setRanking(data || []);
  };

  
return (
  <div className="max-w-5xl mx-auto p-6">
    <h1 className="text-3xl font-bold mb-6">
      🏆 Ranking General
    </h1>


<div className="mb-4">
  <label className="font-semibold mr-3">
    Jornada:
  </label>

  <select
    value={jornadaSeleccionada}
    onChange={(e) =>
      setJornadaSeleccionada(e.target.value)
    }
    className="border p-2 rounded"
  >
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

    <div className="mb-4">
      <p className="text-lg">
        Participantes:{" "}
        <span className="font-bold">
          {ranking.length}
        </span>
      </p>
    </div>

    <div className="border rounded-lg overflow-hidden shadow">
      <table className="w-full">
        <thead className="bg-gray-200">
          <tr>
            <th className="p-3 text-left">
              Posición
            </th>

            <th className="p-3 text-left">
              Usuario
            </th>

            <th className="p-3 text-center">
              Aciertos
            </th>
          </tr>
        </thead>

        <tbody>
          {ranking.map((fila, index) => {
            let medalla = "";

            if (index === 0) medalla = "🥇";
            if (index === 1) medalla = "🥈";
            if (index === 2) medalla = "🥉";

            return (
              <tr
                key={`${fila.nombre_usuario}-${index}`}
                className={
                  index === 0
                    ? "bg-yellow-100 border-t"
                    : "border-t"
                }
              >
                <td className="p-3 font-bold">
                  {medalla} {index + 1}
                </td>

                <td className="p-3">
                  {fila.nombre_usuario}
                </td>

                <td className="p-3 text-center font-bold">
                  {fila.aciertos}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {ranking.length > 0 && (
      <div className="mt-6 bg-green-100 p-4 rounded">
        <h2 className="font-bold text-lg">
          Líder Actual
        </h2>

        <p>
          🥇 {ranking[0].nombre_usuario}
        </p>

        <p>
          Aciertos: {ranking[0].aciertos}
        </p>
      </div>
    )}
  </div>
);
}