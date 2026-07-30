import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function CorregirPronosticos() {
  const [usuarios, setUsuarios] = useState([]);
  const [jornadas, setJornadas] = useState([]);

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");

  const [pronosticos, setPronosticos] = useState([]);

  useEffect(() => {
    cargarUsuarios();
    cargarJornadas();
  }, []);

  const cargarUsuarios = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,nombre_usuario,nombre,nombre_completo")
      .order("nombre_usuario");

    if (error) {
      console.error(error);
      return;
    }

    setUsuarios(data || []);
  };

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

  const cargarPronosticos = async (usuarioId, jornadaId) => {
    if (!usuarioId || !jornadaId) return;

    const { data: partidos, error } = await supabase
      .from("partidos")
      .select("*")
      .eq("jornada_id", jornadaId)
      .order("id");

    if (error) {
      console.error(error);
      return;
    }

    const { data: quinielas } = await supabase
      .from("quinielas")
      .select("*")
      .eq("usuario_id", usuarioId);

    const resultado = partidos.map((partido) => {
      const pronosticoUsuario = quinielas?.find(
        (q) => q.partido_id === partido.id
      );

      return {
        partido_id: partido.id,
        local: partido.local,
        visitante: partido.visitante,
        pronostico_id: pronosticoUsuario?.id || null,
        pronostico: pronosticoUsuario?.pronostico || "",
      };
    });

    setPronosticos(resultado);
  };

  const actualizarPronostico = (partidoId, valor) => {
    setPronosticos((prev) =>
      prev.map((item) =>
        item.partido_id === partidoId
          ? { ...item, pronostico: valor }
          : item
      )
    );
  };

  const guardarCambios = async () => {
    try {
      for (const item of pronosticos) {
        if (!item.pronostico) continue;

        if (item.pronostico_id) {
          const { error } = await supabase
            .from("quinielas")
            .update({
              pronostico: item.pronostico,
            })
            .eq("id", item.pronostico_id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("quinielas")
            .insert({
              usuario_id: usuarioSeleccionado,
              partido_id: item.partido_id,
              pronostico: item.pronostico,
            });

          if (error) throw error;
        }
      }

      alert("Pronósticos actualizados correctamente");
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">

      <h1 className="text-3xl font-bold mb-6">
        Corrección de Pronósticos
      </h1>

      <div className="grid md:grid-cols-2 gap-4 mb-6">

        <select
          className="border p-2 rounded"
          value={usuarioSeleccionado}
          onChange={(e) => {
            const usuario = e.target.value;
            setUsuarioSeleccionado(usuario);

            if (jornadaSeleccionada) {
              cargarPronosticos(usuario, jornadaSeleccionada);
            }
          }}
        >
          <option value="">Selecciona usuario</option>

          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre_usuario ||
                u.nombre ||
                u.nombre_completo}
            </option>
          ))}
        </select>

        <select
          className="border p-2 rounded"
          value={jornadaSeleccionada}
          onChange={(e) => {
            const jornada = e.target.value;
            setJornadaSeleccionada(jornada);

            if (usuarioSeleccionado) {
              cargarPronosticos(usuarioSeleccionado, jornada);
            }
          }}
        >
          <option value="">Selecciona jornada</option>

          {jornadas.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nombre}
            </option>
          ))}
        </select>

      </div>

      {pronosticos.length > 0 && (
        <>
          <table className="w-full border-collapse border">

            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Local</th>
                <th className="border p-2">Visitante</th>
                <th className="border p-2">Pronóstico</th>
              </tr>
            </thead>

            <tbody>
              {pronosticos.map((partido) => (
                <tr key={partido.partido_id}>
                  <td className="border p-2">
                    {partido.local}
                  </td>

                  <td className="border p-2">
                    {partido.visitante}
                  </td>

                  <td className="border p-2">
                    <select
                      className="border rounded p-1"
                      value={partido.pronostico}
                      onChange={(e) =>
                        actualizarPronostico(
                          partido.partido_id,
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        Seleccionar
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
                  </td>
                </tr>
              ))}
            </tbody>

          </table>

          <button
            onClick={guardarCambios}
            className="mt-6 bg-green-600 text-white px-6 py-2 rounded"
          >
            Guardar Cambios
          </button>
        </>
      )}
    </div>
  );
}