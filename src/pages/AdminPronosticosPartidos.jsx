import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminPronosticosPartidos() {
  const [equipos, setEquipos] = useState([]);
  const [partidos, setPartidos] = useState([]);

  const [local, setLocal] = useState("");
  const [visita, setVisita] = useState("");
  const [fecha, setFecha] = useState("");
  const [jornada, setJornada] = useState("");

  useEffect(() => {
    cargarEquipos();
    cargarPartidos();
  }, []);

  const cargarEquipos = async () => {
    const { data } = await supabase
      .from("pronosticos_equipos")
      .select("*")
      .order("equipo");

    setEquipos(data || []);
  };

  const cargarPartidos = async () => {
    const { data } = await supabase
      .from("pronosticos_partidos")
      .select("*")
      .order("fecha_partido");

    setPartidos(data || []);
  };

  const crearPartido = async () => {
    if (!local || !visita) {
      alert("Selecciona ambos equipos");
      return;
    }

    if (local === visita) {
      alert("No puede repetirse el equipo");
      return;
    }

    const { error } = await supabase
      .from("pronosticos_partidos")
      .insert([
        {
          local,
          visita,
          fecha_partido: fecha,
          jornada: Number(jornada),
        },
      ]);

    if (error) {
      alert(error.message);
      return;
    }

    setLocal("");
    setVisita("");
    setFecha("");
    setJornada("");

    cargarPartidos();
  };

  const eliminarPartido = async (id) => {
    if (!window.confirm("Eliminar partido")) {
      return;
    }

    await supabase
      .from("pronosticos_partidos")
      .delete()
      .eq("id", id);

    cargarPartidos();
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        ⚽ Administración de Partidos
      </h1>

      <div className="bg-white shadow rounded p-5 mb-6">

        <h2 className="text-xl font-bold mb-4">
          Nuevo Partido
        </h2>

        <div className="grid md:grid-cols-2 gap-4">

          <select
            value={local}
            onChange={(e) =>
              setLocal(e.target.value)
            }
            className="border p-2 rounded"
          >
            <option value="">
              Equipo Local
            </option>

            {equipos.map((equipo) => (
              <option
                key={equipo.id}
                value={equipo.equipo}
              >
                {equipo.equipo}
              </option>
            ))}
          </select>

          <select
            value={visita}
            onChange={(e) =>
              setVisita(e.target.value)
            }
            className="border p-2 rounded"
          >
            <option value="">
              Equipo Visitante
            </option>

            {equipos.map((equipo) => (
              <option
                key={equipo.id}
                value={equipo.equipo}
              >
                {equipo.equipo}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fecha}
            onChange={(e) =>
              setFecha(e.target.value)
            }
            className="border p-2 rounded"
          />

          <input
            type="number"
            value={jornada}
            onChange={(e) =>
              setJornada(e.target.value)
            }
            placeholder="Jornada"
            className="border p-2 rounded"
          />

        </div>

        <button
          onClick={crearPartido}
          className="
            mt-4
            bg-green-600
            text-white
            px-4
            py-2
            rounded
            hover:bg-green-700
          "
        >
          Guardar Partido
        </button>

      </div>

      <div className="bg-white shadow rounded p-5">

        <h2 className="text-xl font-bold mb-4">
          Partidos Registrados
        </h2>

        <div className="space-y-3">

          {partidos.map((partido) => (

            <div
              key={partido.id}
              className="
                flex
                justify-between
                items-center
                border
                rounded
                p-3
              "
            >
              <div>
                <strong>
                  {partido.local}
                </strong>

                {" vs "}

                <strong>
                  {partido.visita}
                </strong>

                <div className="text-sm text-gray-500">
                  Jornada {partido.jornada}
                </div>

                <div className="text-sm text-gray-500">
                  {partido.fecha_partido}
                </div>
              </div>

              <button
                onClick={() =>
                  eliminarPartido(
                    partido.id
                  )
                }
                className="
                  bg-red-600
                  text-white
                  px-3
                  py-2
                  rounded
                "
              >
                Eliminar
              </button>
            </div>

          ))}

        </div>

      </div>
    </div>
  );
}