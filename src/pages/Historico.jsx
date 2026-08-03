import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { Link } from "react-router-dom";

export default function Historico() {

  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    cargarRanking();
  }, []);

  const cargarRanking = async () => {

    const { data, error } =
      await supabase
        .from("ranking_historico")
        .select("*");

    if (error) {
      console.error(error);
      return;
    }

    setRanking(data || []);
  };

  const campeon = ranking[0];

  return (

    <div className="max-w-6xl mx-auto p-6">

      <div className="flex justify-between items-center mb-6">

        <h1 className="text-3xl font-bold">
          🏆 Ranking Histórico
        </h1>

        <Link
          to="/quiniela"
          className="
            bg-blue-600
            text-white
            px-4
            py-2
            rounded
            hover:bg-blue-700
          "
        >
          Regresar
        </Link>

        <Link
  to="/comparador"
  className="
    bg-green-600
    text-white
    px-4
    py-2
    rounded
  "
>
  ⚔️ Comparador
</Link>

      </div>

      {campeon && (

        <div
          className="
            bg-yellow-100
            border
            border-yellow-300
            rounded
            p-4
            mb-6
          "
        >
          <h2 className="font-bold text-xl">
            🥇 Líder Histórico
          </h2>

          <p className="mt-2 text-lg font-semibold">
            {campeon.nombre_usuario}
          </p>

          <p>
            {campeon.aciertos_totales} aciertos
          </p>

        </div>

      )}

      <div className="overflow-x-auto">

        <table className="w-full border">

          <thead>

            <tr className="bg-gray-100">

              <th className="border p-2">
                Posición
              </th>

              <th className="border p-2">
                Jugador
              </th>

              <th className="border p-2">
                Aciertos
              </th>

              <th className="border p-2">
                Jornadas
              </th>

              <th className="border p-2">
                Promedio
              </th>

            </tr>

          </thead>

          <tbody>

            {ranking.map(
              (jugador, index) => {

                let color = "";

                if (index === 0) {
                  color = "bg-yellow-100";
                }

                if (index === 1) {
                  color = "bg-gray-100";
                }

                if (index === 2) {
                  color = "bg-orange-100";
                }

                return (

                  <tr
                    key={jugador.usuario_id}
                    className={color}
                  >

                    <td className="border p-2 text-center">
                      {index + 1}
                    </td>

                    <td className="border p-2 font-semibold">

                      <Link
                        to={`/historico/${jugador.usuario_id}`}
                        className="
                          text-blue-600
                          hover:text-blue-800
                          hover:underline
                        "
                      >
                        {jugador.nombre_usuario}
                      </Link>

                    </td>

                    <td className="border p-2 text-center">
                      {jugador.aciertos_totales}
                    </td>

                    <td className="border p-2 text-center">
                      {jugador.jornadas_jugadas}
                    </td>

                    <td className="border p-2 text-center">
                      {jugador.promedio}
                    </td>

                  </tr>

                );

              }
            )}

          </tbody>

        </table>

      </div>

    </div>

  );
}