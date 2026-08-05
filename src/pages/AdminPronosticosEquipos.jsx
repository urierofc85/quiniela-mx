import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminPronosticosEquipos() {
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarEquipos();
  }, []);

  const cargarEquipos = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("pronosticos_equipos")
      .select("*")
      .order("equipo");

   if (error) {
  console.error(error);
} else {
  setEquipos(data || []);
}

    setLoading(false);
  };

const actualizarCampo = (
  id,
  campo,
  valor
) => {
  setEquipos((prev) =>
    prev.map((e) =>
      e.id === id
        ? {
            ...e,
            valor,
          }
        : e
    )
  );
};

  const guardarEquipo = async (equipo) => {
    const { error } = await supabase
      .from("pronosticos_equipos")
      .update({
        goles_favor:
          Number(equipo.goles_favor),

        goles_contra:
          Number(equipo.goles_contra),

        partidos:
          Number(equipo.partidos),

        local_goles_favor:
          Number(
            equipo.local_goles_favor
          ),

        local_goles_contra:
          Number(
            equipo.local_goles_contra
          ),

        visita_goles_favor:
          Number(
            equipo.visita_goles_favor
          ),

        visita_goles_contra:
          Number(
            equipo.visita_goles_contra
          ),

        puntos_ultimos5:
          Number(
            equipo.puntos_ultimos5
          ),

        valor_plantilla:
          Number(
            equipo.valor_plantilla
          ),

          posicion:
  Number(equipo.posicion),

puntos:
  Number(equipo.puntos),

diferencia_goles:
  Number(equipo.diferencia_goles),

      })
      .eq("id", equipo.id);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      `${equipo.equipo} actualizado`
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        Cargando equipos...
      </div>
    );
  }

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        ⚙️ Administración Equipos
      </h1>

      <div className="space-y-6">

        {equipos.map((equipo) => (

          <div
            key={equipo.id}
            className="
              bg-white
              border
              rounded-lg
              shadow
              p-4
            "
          >

            <h2 className="text-xl font-bold mb-4">
              {equipo.equipo}
            </h2>

            <div className="grid md:grid-cols-3 gap-4">

              <input
                type="number"
                value={equipo.goles_favor || ""}
                onChange={(e) =>
                  actualizarCampo(
                    equipo.id,
                    "goles_favor",
                    e.target.value
                  )
                }
                placeholder="Goles favor"
                className="border p-2 rounded"
              />

              <input
                type="number"
                value={
                  equipo.goles_contra || ""
                }
                onChange={(e) =>
                  actualizarCampo(
                    equipo.id,
                    "goles_contra",
                    e.target.value
                  )
                }
                placeholder="Goles contra"
                className="border p-2 rounded"
              />

              <input
                type="number"
                value={
                  equipo.partidos || ""
                }
                onChange={(e) =>
                  actualizarCampo(
                    equipo.id,
                    "partidos",
                    e.target.value
                  )
                }
                placeholder="Partidos"
                className="border p-2 rounded"
              />

              <input
                type="number"
                value={
                  equipo.local_goles_favor || ""
                }
                onChange={(e) =>
                  actualizarCampo(
                    equipo.id,
                    "local_goles_favor",
                    e.target.value
                  )
                }
                placeholder="GF Local"
                className="border p-2 rounded"
              />

              <input
                type="number"
                value={
                  equipo.local_goles_contra || ""
                }
                onChange={(e) =>
                  actualizarCampo(
                    equipo.id,
                    "local_goles_contra",
                    e.target.value
                  )
                }
                placeholder="GC Local"
                className="border p-2 rounded"
              />

              <input
                type="number"
                value={
                  equipo.visita_goles_favor || ""
                }
                onChange={(e) =>
                  actualizarCampo(
                    equipo.id,
                    "visita_goles_favor",
                    e.target.value
                  )
                }
                placeholder="GF Visita"
                className="border p-2 rounded"
              />

              <input
                type="number"
                value={
                  equipo.visita_goles_contra || ""
                }
                onChange={(e) =>
                  actualizarCampo(
                    equipo.id,
                    "visita_goles_contra",
                    e.target.value
                  )
                }
                placeholder="GC Visita"
                className="border p-2 rounded"
              />

              <input
                type="number"
                value={
                  equipo.puntos_ultimos5 || ""
                }
                onChange={(e) =>
                  actualizarCampo(
                    equipo.id,
                    "puntos_ultimos5",
                    e.target.value
                  )
                }
                placeholder="Puntos últimos 5"
                className="border p-2 rounded"
              />

              <input
                type="number"
                step="0.01"
                value={
                  equipo.valor_plantilla || ""
                }
                onChange={(e) =>
                  actualizarCampo(
                    equipo.id,
                    "valor_plantilla",
                    e.target.value
                  )
                }
                placeholder="Valor plantilla"
                className="border p-2 rounded"
              />

              <input
  type="number"
  value={equipo.posicion || ""}
  onChange={(e) =>
    actualizarCampo(
      equipo.id,
      "posicion",
      e.target.value
    )
  }
  placeholder="Posición"
  className="border p-2 rounded"
/>

<input
  type="number"
  value={equipo.puntos || ""}
  onChange={(e) =>
    actualizarCampo(
      equipo.id,
      "puntos",
      e.target.value
    )
  }
  placeholder="Puntos"
  className="border p-2 rounded"
/>

<input
  type="number"
  value={equipo.diferencia_goles || ""}
  onChange={(e) =>
    actualizarCampo(
      equipo.id,
      "diferencia_goles",
      e.target.value
    )
  }
  placeholder="Dif. Goles"
  className="border p-2 rounded"
/>

            </div>

            <button
              onClick={() =>
                guardarEquipo(
                  equipo
                )
              }
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
              Guardar
            </button>

          </div>

        ))}

      </div>

    </div>
  );
}