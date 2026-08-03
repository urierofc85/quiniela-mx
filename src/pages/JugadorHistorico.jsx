import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../services/supabase";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function JugadorHistorico() {

  const { id } = useParams();

  const nombreUsuario =
    decodeURIComponent(id);

  const [jugador, setJugador] =
    useState(null);

  const [historial, setHistorial] =
    useState([]);

  const [grafica, setGrafica] =
    useState([]);

  const [palmares, setPalmares] =
    useState({
      primeros: 0,
      segundos: 0,
      terceros: 0,
      podios: 0,
    });

  useEffect(() => {
    cargarJugador();
  }, [nombreUsuario]);

  const cargarJugador = async () => {

    const {
      data: posiciones,
      error: posicionesError,
    } = await supabase
      .from("ranking_jornada_historico")
      .select("*")
      .eq(
        "nombre_usuario",
        nombreUsuario
      );

    if (posicionesError) {
      console.error(
        posicionesError
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("historico_jugador")
      .select("*")
      .eq(
        "nombre_usuario",
        nombreUsuario
      );

    if (error) {
      console.error(error);
      return;
    }

    if (!data?.length) {
      return;
    }

    setHistorial(data);

    const datosGrafica =
      data.map((item) => ({
        jornada:
          `${item.temporada} - ${item.jornada}`,
        aciertos:
          item.aciertos,
      }));

    setGrafica(datosGrafica);

    const primeros =
      posiciones?.filter(
        (p) => p.posicion === 1
      ).length || 0;

    const segundos =
      posiciones?.filter(
        (p) => p.posicion === 2
      ).length || 0;

    const terceros =
      posiciones?.filter(
        (p) => p.posicion === 3
      ).length || 0;

    setPalmares({
      primeros,
      segundos,
      terceros,
      podios:
        primeros +
        segundos +
        terceros,
    });

    const total =
      data.reduce(
        (acc, item) =>
          acc + item.aciertos,
        0
      );

    const promedio =
      (
        total /
        data.length
      ).toFixed(2);

    const mejor =
      Math.max(
        ...data.map(
          (x) => x.aciertos
        )
      );

    const peor =
      Math.min(
        ...data.map(
          (x) => x.aciertos
        )
      );

    setJugador({
      nombre:
        data[0].nombre_usuario,
      participaciones:
        data.length,
      aciertosTotales:
        total,
      promedio,
      mejor,
      peor,
    });
  };

  if (!jugador) {

    return (
      <div className="p-6">
        Cargando...
      </div>
    );

  }

  return (

    <div className="max-w-6xl mx-auto p-6">

      <Link
        to="/historico"
        className="
          bg-blue-600
          text-white
          px-4
          py-2
          rounded
          hover:bg-blue-700
        "
      >
        ← Regresar
      </Link>

      <h1 className="text-4xl font-bold mt-6 mb-6">
        👤 {jugador.nombre}
      </h1>

      {/* Estadísticas */}
      <div className="grid md:grid-cols-5 gap-4 mb-6">

        <div className="bg-white shadow p-4 rounded">
          <h3 className="text-gray-600">
            Participaciones
          </h3>

          <p className="text-3xl font-bold">
            {jugador.participaciones}
          </p>
        </div>

        <div className="bg-white shadow p-4 rounded">
          <h3 className="text-gray-600">
            Aciertos Totales
          </h3>

          <p className="text-3xl font-bold">
            {jugador.aciertosTotales}
          </p>
        </div>

        <div className="bg-white shadow p-4 rounded">
          <h3 className="text-gray-600">
            Promedio
          </h3>

          <p className="text-3xl font-bold">
            {jugador.promedio}
          </p>
        </div>

        <div className="bg-white shadow p-4 rounded">
          <h3 className="text-gray-600">
            Mejor Jornada
          </h3>

          <p className="text-3xl font-bold text-green-600">
            {jugador.mejor}
          </p>
        </div>

        <div className="bg-white shadow p-4 rounded">
          <h3 className="text-gray-600">
            Peor Jornada
          </h3>

          <p className="text-3xl font-bold text-red-600">
            {jugador.peor}
          </p>
        </div>

      </div>

      {/* Palmarés */}
      <div className="bg-white shadow rounded p-4 mb-6">

        <h2 className="text-xl font-bold mb-4">
          🏆 Palmarés Histórico
        </h2>

        <div className="grid md:grid-cols-4 gap-4">

          <div className="bg-yellow-100 p-4 rounded">
            <p className="text-sm">
              🥇 Jornadas Ganadas
            </p>

            <p className="text-4xl font-bold">
              {palmares.primeros}
            </p>
          </div>

          <div className="bg-gray-100 p-4 rounded">
            <p className="text-sm">
              🥈 Segundos Lugares
            </p>

            <p className="text-4xl font-bold">
              {palmares.segundos}
            </p>
          </div>

          <div className="bg-orange-100 p-4 rounded">
            <p className="text-sm">
              🥉 Terceros Lugares
            </p>

            <p className="text-4xl font-bold">
              {palmares.terceros}
            </p>
          </div>

          <div className="bg-green-100 p-4 rounded">
            <p className="text-sm">
              🏆 Podios Totales
            </p>

            <p className="text-4xl font-bold">
              {palmares.podios}
            </p>
          </div>

        </div>

      </div>

      {/* Gráfica */}
      <div className="bg-white shadow rounded p-4 mb-6">

        <h2 className="text-xl font-bold mb-4">
          📈 Evolución por Jornada
        </h2>

        <div className="h-[350px]">

          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <LineChart data={grafica}>

              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="jornada"
              />

              <YAxis />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="aciertos"
                stroke="#16a34a"
                strokeWidth={3}
              />

            </LineChart>

          </ResponsiveContainer>

        </div>

      </div>

      {/* Historial */}
      <div className="bg-white shadow rounded p-4">

        <h2 className="text-xl font-bold mb-4">
          📋 Historial por Jornada
        </h2>

        <div className="overflow-x-auto">

          <table className="w-full border">

            <thead>

              <tr className="bg-gray-100">

                <th className="border p-2">
                  Temporada
                </th>

                <th className="border p-2">
                  Jornada
                </th>

                <th className="border p-2">
                  Aciertos
                </th>

              </tr>

            </thead>

            <tbody>

              {historial.map(
                (item) => (

                  <tr
                    key={`${item.temporada_id}-${item.jornada_id}-${item.nombre_usuario}`}
                  >

                    <td className="border p-2">
                      {item.temporada}
                    </td>

                    <td className="border p-2">
                      {item.jornada}
                    </td>

                    <td className="border p-2 text-center font-semibold">
                      {item.aciertos}
                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>

  );
}