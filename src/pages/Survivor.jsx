import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { Link } from "react-router-dom";
import { obtenerHoraMexico } from "../services/horario"

export default function Survivor() {
  const [equipos, setEquipos] = useState([]);
  const [equipoSeleccionado, setEquipoSeleccionado] =
    useState("");

  const [jornadaActiva, setJornadaActiva] =
    useState(null);

  const [jornadaCerrada, setJornadaCerrada] =
    useState(false);

  const [historial, setHistorial] =
    useState([]);

  const [usoEquipos, setUsoEquipos] =
    useState([]);

  const [puntosTotales, setPuntosTotales] =
    useState(0);

  const [vidasPerdidas, setVidasPerdidas] =
    useState(0);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    await cargarJornada();
    await cargarEquipos();
    await cargarHistorial();
    await cargarUsoEquipos();
  };

  const cargarJornada = async () => {
    const { data } = await supabase
      .from("jornadas")
      .select("*")
      .eq("activa", true)
      .single();

    if (!data) return;

    setJornadaActiva(data);

    if (data.fecha_limite) {
      const limite = new Date(
        data.fecha_limite
      );

   
    const horaMexico =
      await obtenerHoraMexico();

    setJornadaCerrada(
      horaMexico > limite
    );
  }


    await cargarSeleccionActual(
      data.id
    );
  };

  const cargarEquipos = async () => {

  const { data, error } = await supabase
    .from("equipos")
    .select("nombre")
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error cargando equipos:", error);
    return;
  }

  console.log("Equipos:", data);

  setEquipos(data.map(e => e.nombre));
};
  const cargarSeleccionActual =
    async (jornadaId) => {

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("survivor")
        .select("*")
        .eq(
          "usuario_id",
          user.id
        )
        .eq(
          "jornada_id",
          jornadaId
        )
        .maybeSingle();

      if (data) {
        setEquipoSeleccionado(
          data.equipo
        );
      }
    };

  const cargarUsoEquipos =
    async () => {

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("survivor")
        .select("equipo")
        .eq(
          "usuario_id",
          user.id
        );

      const conteo = {};

      equipos.forEach(
        (equipo) => {
          conteo[equipo] = 0;
        }
      );

      data?.forEach(
        (item) => {
          conteo[item.equipo] =
            (conteo[item.equipo] || 0) + 1;
        }
      );

      const resultado =
        Object.entries(conteo).map(
          ([equipo, usos]) => ({
            equipo,
            usos,
          })
        );

      setUsoEquipos(resultado);
    };

  const cargarHistorial =
    async () => {

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) return;

      const {
        data: selecciones,
      } = await supabase
        .from("survivor")
        .select("*")
        .eq(
          "usuario_id",
          user.id
        )
        .order(
          "jornada_id",
          {
            ascending: true,
          }
        );

      const {
        data: jornadas,
      } = await supabase
        .from("jornadas")
        .select("*");

      const {
        data: partidos,
      } = await supabase
        .from("partidos")
        .select("*");

      let total = 0;
      let vidas = 0;

      const procesado =
        (selecciones || []).map(
          (item) => {

            const jornada =
              jornadas?.find(
                (j) =>
                  Number(j.id) ===
                  Number(
                    item.jornada_id
                  )
              );

            const partido =
              partidos?.find(
                (p) =>
                  Number(
                    p.jornada_id
                  ) ===
                    Number(
                      item.jornada_id
                    ) &&
                  (
                    p.local ===
                      item.equipo ||
                    p.visitante ===
                      item.equipo
                  )
              );

            let puntos = 0;
            let resultado =
              "Pendiente";

            if (
              partido?.resultado
            ) {

              if (
                partido.local ===
                item.equipo
              ) {

                if (
                  partido.resultado ===
                  "L"
                ) {
                  puntos = 3;
                  resultado =
                    "✅ Ganó";
                }

                if (
                  partido.resultado ===
                  "E"
                ) {
                  puntos = 1;
                  resultado =
                    "🤝 Empató";
                }

                if (
                  partido.resultado ===
                  "V"
                ) {
                  puntos = 0;
                  resultado =
                    "❌ Perdió";
                }
              }

              if (
                partido.visitante ===
                item.equipo
              ) {

                if (
                  partido.resultado ===
                  "V"
                ) {
                  puntos = 3;
                  resultado =
                    "✅ Ganó";
                }

                if (
                  partido.resultado ===
                  "E"
                ) {
                  puntos = 1;
                  resultado =
                    "🤝 Empató";
                }

                if (
                  partido.resultado ===
                  "L"
                ) {
                  puntos = 0;
                  resultado =
                    "❌ Perdió";
                }
              }
            }

            total += puntos;

            if (
              resultado ===
              "❌ Perdió"
            ) {
              vidas++;
            }

            return {
              ...item,
              nombreJornada:
                jornada?.nombre ||
                `Jornada ${item.jornada_id}`,
              puntos,
              resultado,
            };
          }
        );

      setHistorial(procesado);
      setPuntosTotales(total);
      setVidasPerdidas(vidas);
    };

 const guardarSeleccion =
  async () => {

    const horaMexico =
      await obtenerHoraMexico();

    const fechaLimite =
      new Date(
        jornadaActiva.fecha_limite
      );

    if (
      horaMexico > fechaLimite
    ) {
      alert(
        "La jornada ya fue cerrada"
      );
      return;
    }

    if (
      !equipoSeleccionado
    ) {
      alert(
        "Selecciona un equipo"
      );
      return;
    }

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      const {
        count,
      } = await supabase
        .from("survivor")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq(
          "usuario_id",
          user.id
        )
        .eq(
          "equipo",
          equipoSeleccionado
        );

      const {
        data: actual,
      } = await supabase
        .from("survivor")
        .select("*")
        .eq(
          "usuario_id",
          user.id
        )
        .eq(
          "jornada_id",
          jornadaActiva.id
        )
        .maybeSingle();

      const usos =
        actual?.equipo ===
        equipoSeleccionado
          ? (count || 0) - 1
          : count || 0;

      if (usos >= 3) {
        alert(
          `Ya no puedes seleccionar ${equipoSeleccionado}. Máximo 3 usos.`
        );
        return;
      }

      await supabase
        .from("survivor")
        .delete()
        .eq(
          "usuario_id",
          user.id
        )
        .eq(
          "jornada_id",
          jornadaActiva.id
        );

      const { error } =
        await supabase
          .from("survivor")
          .insert({
            usuario_id:
              user.id,
            usuario:
              user.email,
            jornada_id:
              jornadaActiva.id,
            equipo:
              equipoSeleccionado,
          });

      if (error) {
        alert(error.message);
        return;
      }

      alert(
        "Selección guardada correctamente"
      );

      await cargarHistorial();
      await cargarUsoEquipos();
    };

  return (
    <div className="max-w-5xl mx-auto p-6">

      <h1 className="text-3xl font-bold mb-6">
        Survivor Liga MX
      </h1>

      <Link
        to="/quiniela"
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Regresar a Quiniela
      </Link>

      <div className="bg-gray-100 rounded p-4 my-6">

        <p className="font-bold">
          🏆 Puntos Totales:{" "}
          {puntosTotales}
        </p>

        <p className="font-bold mt-2">
          💀 Vidas Perdidas:{" "}
          {vidasPerdidas}
        </p>

      </div>

      <h2 className="text-xl font-bold mb-3">
        📊 Uso de Equipos
      </h2>

      <table className="w-full border mb-8">

        <thead className="bg-gray-200">
          <tr>
            <th className="border p-2">
              Equipo
            </th>
            <th className="border p-2">
              Usos
            </th>
          </tr>
        </thead>

        <tbody>
          {usoEquipos.map(
            (item) => (
              <tr
                key={item.equipo}
              >
                <td className="border p-2">
                  {item.equipo}
                </td>

                <td className="border p-2">
                  {item.usos}/3
                </td>
              </tr>
            )
          )}
        </tbody>

      </table>

      {jornadaActiva && (
        <div className="border rounded p-4 mb-8">

          <h2 className="font-bold text-xl mb-4">
            {
              jornadaActiva.nombre
            }
          </h2>

          <select
    value={equipoSeleccionado}
    onChange={(e) =>
        setEquipoSeleccionado(e.target.value)
    }
>
    <option value="">
        Selecciona un equipo
    </option>

    {equipos.map((equipo) => (
        <option
            key={equipo}
            value={equipo}
        >
            {equipo}
        </option>
    ))}
</select>
          <button
            onClick={
              guardarSeleccion
            }
            disabled={
              jornadaCerrada
            }
            className="bg-green-600 text-white px-4 py-2 rounded mt-4"
          >
            Guardar Selección
          </button>

        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">
        Historial Survivor
      </h2>

      <table className="w-full border">

        <thead className="bg-gray-200">

          <tr>
            <th className="border p-2">
              Jornada
            </th>
            <th className="border p-2">
              Equipo
            </th>
            <th className="border p-2">
              Resultado
            </th>
            <th className="border p-2">
              Puntos
            </th>
          </tr>

        </thead>

        <tbody>

          {historial.map(
            (item) => (
              <tr key={item.id}>
                <td className="border p-2">
                  {
                    item.nombreJornada
                  }
                </td>

                <td className="border p-2">
                  {item.equipo}
                </td>

                <td className="border p-2">
                  {
                    item.resultado
                  }
                </td>

                <td className="border p-2">
                  {item.puntos}
                </td>
              </tr>
            )
          )}

        </tbody>

      </table>

    </div>
  );
}