
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function Participantes() {

  const [participantes, setParticipantes] =
    useState([]);

  const [busqueda, setBusqueda] =
    useState("");

  useEffect(() => {
    cargarParticipantes();
  }, []);

  const cargarParticipantes = async () => {

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("nombre_usuario", {
        ascending: true,
      });

    if (error) {
      console.log(error);
      return;
    }

    setParticipantes(data || []);
  };

  const participantesFiltrados =
    participantes.filter((p) => {

      const texto = busqueda.toLowerCase();

      return (
        (p.nombre_usuario || "")
          .toLowerCase()
          .includes(texto) ||

        (p.nombre_completo || "")
          .toLowerCase()
          .includes(texto) ||

        (p.email || "")
          .toLowerCase()
          .includes(texto)
      );
    });

  return (
    <div className="max-w-7xl mx-auto p-6">

      <h1 className="text-3xl font-bold mb-6">
        👥 Participantes
      </h1>

      <input
        type="text"
        placeholder="Buscar participante..."
        value={busqueda}
        onChange={(e) =>
          setBusqueda(e.target.value)
        }
        className="border p-2 rounded w-full mb-4"
      />

      <div className="mb-4">
        Total participantes:
        {" "}
        <strong>
          {participantesFiltrados.length}
        </strong>
      </div>

      <div className="overflow-x-auto border rounded shadow">

        <table className="w-full">

          <thead className="bg-gray-200">

            <tr>

              <th className="p-3 text-left">
                Usuario
              </th>

              <th className="p-3 text-left">
                Nombre Completo
              </th>

              <th className="p-3 text-left">
                Correo
              </th>

              <th className="p-3 text-left">
                Teléfono
              </th>

              <th className="p-3 text-left">
                Banco
              </th>

              <th className="p-3 text-left">
                CLABE
              </th>

              <th className="p-3 text-left">
                Rol
              </th>

            </tr>

          </thead>

          <tbody>

            {participantesFiltrados.map(
              (participante) => (
                <tr
                  key={participante.id}
                  className="border-t"
                >

                  <td className="p-3">
                    {participante.nombre_usuario ||
                      "-"}
                  </td>

                  <td className="p-3">
                    {participante.nombre_completo ||
                      "-"}
                  </td>

                  <td className="p-3">
                    {participante.email}
                  </td>

                  <td className="p-3">
                    {participante.telefono ||
                      "-"}
                  </td>

                  <td className="p-3">
                    {participante.banco ||
                      "-"}
                  </td>

                  <td className="p-3">
                    {participante.clabe ||
                      "-"}
                  </td>

                  <td className="p-3">

                    <span
                      className={
                        participante.rol ===
                        "admin"
                          ? "text-red-600 font-bold"
                          : "text-blue-600"
                      }
                    >
                      {participante.rol}
                    </span>

                  </td>

                </tr>
              )
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}
