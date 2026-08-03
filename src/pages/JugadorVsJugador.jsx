import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { Link } from "react-router-dom";

export default function JugadorVsJugador() {

  const [jugadores, setJugadores] =
    useState([]);

  const [jugador1, setJugador1] =
    useState("");

  const [jugador2, setJugador2] =
    useState("");

  const [datos1, setDatos1] =
    useState(null);

  const [datos2, setDatos2] =
    useState(null);

  useEffect(() => {
    cargarJugadores();
  }, []);

  const cargarJugadores = async () => {

    const { data, error } =
      await supabase
        .from("comparativa_jugadores")
        .select("*")
        .order(
          "nombre_usuario"
        );

    if (error) {
      console.error(error);
      return;
    }

    setJugadores(
      data || []
    );
  };

  const comparar = () => {

    const j1 =
      jugadores.find(
        (j) =>
          String(
            j.usuario_id
          ) ===
          String(
            jugador1
          )
      );

    const j2 =
      jugadores.find(
        (j) =>
          String(
            j.usuario_id
          ) ===
          String(
            jugador2
          )
      );

    setDatos1(j1);
    setDatos2(j2);
  };

  return (

    <div className="max-w-5xl mx-auto p-6">

      <div className="flex justify-between mb-6">

        <h1 className="text-3xl font-bold">
          ⚔️ Comparador de Jugadores
        </h1>

        <Link
          to="/historico"
          className="
            bg-blue-600
            text-white
            px-4
            py-2
            rounded
          "
        >
          Regresar
        </Link>

      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">

        <select
          value={jugador1}
          onChange={(e) =>
            setJugador1(
              e.target.value
            )
          }
          className="
            border
            rounded
            p-2
          "
        >

          <option value="">
            Jugador 1
          </option>

          {jugadores.map(
            (j) => (

              <option
                key={j.usuario_id}
                value={j.usuario_id}
              >
                {j.nombre_usuario}
              </option>

            )
          )}

        </select>

        <select
          value={jugador2}
          onChange={(e) =>
            setJugador2(
              e.target.value
            )
          }
          className="
            border
            rounded
            p-2
          "
        >

          <option value="">
            Jugador 2
          </option>

          {jugadores.map(
            (j) => (

              <option
                key={j.usuario_id}
                value={j.usuario_id}
              >
                {j.nombre_usuario}
              </option>

            )
          )}

        </select>

      </div>

      <button
        onClick={comparar}
        className="
          bg-green-600
          text-white
          px-4
          py-2
          rounded
          mb-6
        "
      >
        Comparar
      </button>

      {datos1 && datos2 && (

        <div
          className="
            bg-white
            shadow
            rounded
            p-6
          "
        >

          <table className="w-full">

            <thead>

              <tr>

                <th></th>

                <th>
                  {datos1.nombre_usuario}
                </th>

                <th>
                  {datos2.nombre_usuario}
                </th>

              </tr>

            </thead>

            <tbody>

              <tr>

                <td className="p-2 font-semibold">
                  🏆 Aciertos
                </td>

                <td className="p-2 text-center">
                  {datos1.aciertos_totales}
                </td>

                <td className="p-2 text-center">
                  {datos2.aciertos_totales}
                </td>

              </tr>

              <tr>

                <td className="p-2 font-semibold">
                  📅 Jornadas
                </td>

                <td className="p-2 text-center">
                  {datos1.jornadas_jugadas}
                </td>

                <td className="p-2 text-center">
                  {datos2.jornadas_jugadas}
                </td>

              </tr>

              <tr>

                <td className="p-2 font-semibold">
                  🎯 Promedio
                </td>

                <td className="p-2 text-center">
                  {datos1.promedio}
                </td>

                <td className="p-2 text-center">
                  {datos2.promedio}
                </td>

              </tr>

            </tbody>

          </table>

        </div>

      )}

    </div>

  );
}