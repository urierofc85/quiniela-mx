import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function CorregirPronosticos() {
  const [usuarios, setUsuarios] = useState([]);
  const [jornadas, setJornadas] = useState([]);

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");

  const [pronosticos, setPronosticos] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const [survivorId, setSurvivorId] = useState(null);
  const [equipoSurvivor, setEquipoSurvivor] = useState("");
  const [equiposDisponibles, setEquiposDisponibles] = useState([]);

  useEffect(() => {
    cargarUsuarios();
    cargarJornadas();
  }, []);

  const cargarUsuarios = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
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
    try {
      if (!usuarioId || !jornadaId) return;

      const { data: partidos, error: errorPartidos } = await supabase
        .from("partidos")
        .select("*")
        .eq("jornada_id", jornadaId)
        .order("id");

      if (errorPartidos) {
        throw errorPartidos;
      }

      const { data: quinielas, error: errorQuinielas } = await supabase
        .from("quinielas")
        .select("*")
        .eq("usuario_id", usuarioId)
        .eq("jornada_id", jornadaId);

      if (errorQuinielas) {
        throw errorQuinielas;
      }

      const { data: survivorRows, error: survivorError } = await supabase
        .from("survivor")
        .select("*")
        .eq("usuario_id", usuarioId)
        .eq("jornada_id", jornadaId);

      if (survivorError) {
        throw survivorError;
      }

      const survivorData =
        survivorRows && survivorRows.length > 0
          ? survivorRows[0]
          : null;

      const equipos = [];

      partidos.forEach((p) => {
        if (p.local && !equipos.includes(p.local)) {
          equipos.push(p.local);
        }

        if (p.visitante && !equipos.includes(p.visitante)) {
          equipos.push(p.visitante);
        }
      });

      setEquiposDisponibles(equipos.sort());

      if (survivorData) {
        setSurvivorId(survivorData.id);
        setEquipoSurvivor(survivorData.equipo);
      } else {
        setSurvivorId(null);
        setEquipoSurvivor("");
      }

      const resultado = partidos.map((partido) => {
        const pronosticoExistente = quinielas.find(
          (q) => Number(q.partido_id) === Number(partido.id)
        );

        return {
          id: pronosticoExistente?.id || null,
          partido_id: partido.id,
          local: partido.local,
          visitante: partido.visitante,
          pronostico: pronosticoExistente?.pronostico || "",
        };
      });

      setPronosticos(resultado);
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  const actualizarPronostico = (partidoId, nuevoValor) => {
    setPronosticos((prev) =>
      prev.map((item) =>
        item.partido_id === partidoId
          ? { ...item, pronostico: nuevoValor }
          : item
      )
    );
  };

  const guardarCambios = async () => {
    try {
      setGuardando(true);

      // Actualizar Quiniela
      for (const item of pronosticos) {
        if (!item.id) continue;

        const { error } = await supabase
          .from("quinielas")
          .update({
            pronostico: item.pronostico,
          })
          .eq("id", item.id);

        if (error) {
          throw error;
        }
      }

      // Actualizar Survivor
      if (equipoSurvivor) {
        if (survivorId) {
          const { error } = await supabase
            .from("survivor")
            .update({
              equipo: equipoSurvivor,
            })
            .eq("id", survivorId);

          if (error) {
            throw error;
          }
        } else {
          const usuarioObj = usuarios.find(
            (u) => String(u.id) === String(usuarioSeleccionado)
          );

          const { error } = await supabase
            .from("survivor")
            .insert({
              usuario_id: usuarioSeleccionado,
              jornada_id: Number(jornadaSeleccionada),
              usuario:
                usuarioObj?.email ||
                usuarioObj?.correo ||
                usuarioObj?.nombre_usuario ||
                "",
              equipo: equipoSurvivor,
            });

          if (error) {
            throw error;
          }
        }
      }

      alert("Pronósticos y Survivor actualizados correctamente");
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setGuardando(false);
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
          <option value="">
            Selecciona un usuario
          </option>

          {usuarios.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.nombre_usuario ||
                usuario.nombre ||
                usuario.nombre_completo}
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
              cargarPronosticos(
                usuarioSeleccionado,
                jornada
              );
            }
          }}
        >
          <option value="">
            Selecciona una jornada
          </option>

          {jornadas.map((jornada) => (
            <option key={jornada.id} value={jornada.id}>
              {jornada.nombre}
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

                  <td className="border p-2 text-center">
                    <select
                      className="border rounded p-2"
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
                        Gana Local (L)
                      </option>

                      <option value="E">
                        Empate (E)
                      </option>

                      <option value="V">
                        Gana Visitante (V)
                      </option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 border rounded p-4 bg-gray-50">
            <h2 className="text-xl font-bold mb-3">
              Survivor
            </h2>

            <div className="mb-3 text-green-700 font-semibold">
              Survivor actual: {equipoSurvivor || "Sin selección"}
            </div>

            <select
              className="border p-2 rounded w-full"
              value={equipoSurvivor}
              onChange={(e) =>
                setEquipoSurvivor(e.target.value)
              }
            >
              <option value="">
                Selecciona equipo Survivor
              </option>

              {equiposDisponibles.map((equipo) => (
                <option key={equipo} value={equipo}>
                  {equipo}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={guardarCambios}
            disabled={guardando}
            className="mt-6 bg-green-600 text-white px-6 py-2 rounded"
          >
            {guardando
              ? "Guardando..."
              : "Guardar Cambios"}
          </button>
        </>
      )}

      {usuarioSeleccionado &&
        jornadaSeleccionada &&
        pronosticos.length === 0 && (
          <div className="bg-yellow-100 border border-yellow-300 rounded p-4 mt-4">
            No existen pronósticos registrados para ese usuario en esa jornada.
          </div>
        )}
    </div>
  );
}