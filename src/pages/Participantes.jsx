import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { obtenerHoraMexico } from "../services/horario"

export default function Participantes() {

  const [participantes, setParticipantes] =
    useState([]);

  const [busqueda, setBusqueda] =
    useState("");

  const [seleccionados, setSeleccionados] =
    useState([]);

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

  const toggleSeleccion = (id) => {

    if (seleccionados.includes(id)) {

      setSeleccionados(
        seleccionados.filter(
          (item) => item !== id
        )
      );

    } else {

      setSeleccionados([
        ...seleccionados,
        id,
      ]);

    }
  };

  
const eliminarUsuarios = async () => {

  if (seleccionados.length === 0) {
    alert(
      "Selecciona al menos un usuario"
    );
    return;
  }

  const confirmar = window.confirm(
    `¿Deseas eliminar completamente ${seleccionados.length} usuario(s)?`
  );

  if (!confirmar) return;

  
for (const userId of seleccionados) {

  try {

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch(
      "https://cfybuywzclttwbhafjlq.supabase.co/functions/v1/clever-action",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          userId,
        }),
      }
    );

    const resultado =
      await response.json();

    console.log(
      "RESPUESTA EDGE:",
      resultado
    );

    if (!response.ok) {

      alert(
        resultado.error ||
        "Error eliminando usuario de Authentication"
      );

      return;
    }

  } catch (error) {

    console.log(
      "Error eliminando auth user:",
      error
    );

    alert(
      "No fue posible conectar con la Edge Function."
    );

    return;
  }

}

  const { error: errorProfiles } =
    await supabase
      .from("profiles")
      .delete()
      .in(
        "id",
        seleccionados
      );

  if (errorProfiles) {
    alert(errorProfiles.message);
    return;
  }

  alert(
    "Usuarios eliminados completamente"
  );

  setSeleccionados([]);

  await cargarParticipantes();
};

  const participantesFiltrados =
    participantes.filter((p) => {

      const texto =
        busqueda.toLowerCase();

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

      <div className="flex justify-between items-center mb-4">

        <div>
          Total participantes:{" "}
          <strong>
            {participantesFiltrados.length}
          </strong>
        </div>

        <button
          onClick={eliminarUsuarios}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Eliminar Seleccionados
        </button>

      </div>

      <div className="overflow-x-auto border rounded shadow">

        <table className="w-full">

          <thead className="bg-gray-200">

            <tr>

              <th className="p-3 text-center">
                Seleccionar
              </th>

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

                  <td className="p-3 text-center">

                    {participante.rol !== "admin" && (

                      <input
                        type="checkbox"
                        checked={seleccionados.includes(
                          participante.id
                        )}
                        onChange={() =>
                          toggleSeleccion(
                            participante.id
                          )
                        }
                      />

                    )}

                  </td>

                  <td className="p-3">
                    {participante.nombre_usuario || "-"}
                  </td>

                  <td className="p-3">
                    {participante.nombre_completo || "-"}
                  </td>

                  <td className="p-3">
                    {participante.email}
                  </td>

                  <td className="p-3">
                    {participante.telefono || "-"}
                  </td>

                  <td className="p-3">
                    {participante.banco || "-"}
                  </td>

                  <td className="p-3">
                    {participante.clabe || "-"}
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
