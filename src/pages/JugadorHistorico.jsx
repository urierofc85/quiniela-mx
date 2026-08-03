import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabase";

export default function JugadorHistorico() {

  const { id } = useParams();

  const [jugador, setJugador] =
    useState(null);

  const [historial, setHistorial] =
    useState([]);

  useEffect(() => {
    cargarJugador();
  }, []);
const cargarJugador = async () => {

  const { data } = await supabase
    .from("historico_jugador")
    .select("*")
    .eq("usuario_id", id);

  if (!data?.length) return;

  setHistorial(data);

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
        x => x.aciertos
      )
    );

  const peor =
    Math.min(
      ...data.map(
        x => x.aciertos
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

  <div className="max-w-5xl mx-auto p-6">

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
      ← Regresar
    </Link>

    <h1 className="text-4xl font-bold mt-6 mb-6">
      👤 {jugador.nombre}
    </h1>

    <div className="grid md:grid-cols-5 gap-4 mb-6">

      <div className="bg-white shadow p-4 rounded">
        <h3>Participaciones</h3>
        <p className="text-3xl font-bold">
          {jugador.participaciones}
        </p>
      </div>

      <div className="bg-white shadow p-4 rounded">
        <h3>Aciertos</h3>
        <p className="text-3xl font-bold">
          {jugador.aciertosTotales}
        </p>
      </div>

      <div className="bg-white shadow p-4 rounded">
        <h3>Promedio</h3>
        <p className="text-3xl font-bold">
          {jugador.promedio}
        </p>
      </div>

      <div className="bg-white shadow p-4 rounded">
        <h3>Mejor Jornada</h3>
        <p className="text-3xl font-bold">
          {jugador.mejor}
        </p>
      </div>

      <div className="bg-white shadow p-4 rounded">
        <h3>Peor Jornada</h3>
        <p className="text-3xl font-bold">
          {jugador.peor}
        </p>
      </div>

    </div>
<table className="w-full border">

  <thead>

    <tr className="bg-gray-100">

      <th className="border p-2">
        Jornada
      </th>

      <th className="border p-2">
        Aciertos
      </th>

    </tr>

  </thead>

  <tbody>

    {historial.map(item => (

      <tr
        key={`${item.usuario_id}-${item.jornada_id}`}
      >

        <td className="border p-2">
          Jornada {item.jornada_id}
        </td>

        <td className="border p-2 text-center">
          {item.aciertos}
        </td>

      </tr>

    ))}

  </tbody>

</table>

</div>

);
}