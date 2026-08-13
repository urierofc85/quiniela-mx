import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminPronosticosPartidos() {
  const [equipos, setEquipos] = useState([]);
const [partidos, setPartidos] = useState([]);
const [generando, setGenerando] =
  useState(false);

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
 const generarPronosticos = async () => {
  try {
    setGenerando(true);

    const normalizar = (texto = "") =>
      texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const {
      data: equiposData,
      error,
    } = await supabase
      .from("pronosticos_equipos")
      .select("*");

    if (error) {
      alert(error.message);
      return;
    }

    const mapaEquipos = {};

    equiposData.forEach((equipo) => {
      mapaEquipos[
        normalizar(equipo.equipo)
      ] = equipo;
    });

    const alias = {
      guadalajara: "chivas",
    };

    const obtenerEquipo = (
      nombre
    ) => {
      const clave =
        normalizar(nombre);

      return mapaEquipos[
        alias[clave] || clave
      ];
    };

    alert(
  `Partidos encontrados: ${partidos.length}`
);

    for (const partido of partidos) 
      {
      const localEquipo =
        obtenerEquipo(
          partido.local
        );

      const visitaEquipo =
        obtenerEquipo(
          partido.visita
        );
        

      if (
        !localEquipo ||
        !visitaEquipo
      ) {
        console.log(
          "Equipo no encontrado:",
          partido.local,
          partido.visita
        );

        continue;
      }

      const scoreLocal =
        (
          Number(
            localEquipo.rating_total ||
              0
          ) * 0.30
        ) +
        (
          Number(
            localEquipo.rating_historico ||
              0
          ) * 0.20
        ) +
        (
          Number(
            localEquipo.rating_tendencia ||
              0
          ) * 0.10
        ) +
        (
          Number(
            localEquipo.rating_ofensivo ||
              0
          ) * 0.10
        ) +
        (
          Number(
            localEquipo.rating_defensivo ||
              0
          ) * 0.10
        ) +
        (
          Number(
            localEquipo.pct_hist_local_gana ||
              0
          ) * 0.20
        );

      const scoreVisita =
        (
          Number(
            visitaEquipo.rating_total ||
              0
          ) * 0.30
        ) +
        (
          Number(
            visitaEquipo.rating_historico ||
              0
          ) * 0.20
        ) +
        (
          Number(
            visitaEquipo.rating_tendencia ||
              0
          ) * 0.10
        ) +
        (
          Number(
            visitaEquipo.rating_ofensivo ||
              0
          ) * 0.10
        ) +
        (
          Number(
            visitaEquipo.rating_defensivo ||
              0
          ) * 0.10
        ) +
        (
          Number(
            visitaEquipo.pct_hist_visita_gana ||
              0
          ) * 0.20
        );

      const diferencia =
        Math.abs(
          scoreLocal -
            scoreVisita
        );

      let empateFactor =
        (
          Number(
            localEquipo.pct_hist_local_empata ||
              0
          ) +
          Number(
            visitaEquipo.pct_hist_visita_empata ||
              0
          )
        ) / 2;

      if (diferencia < 5) {
        empateFactor *= 2;
      } else if (
        diferencia < 10
      ) {
        empateFactor *= 1.5;
      } else if (
        diferencia < 15
      ) {
        empateFactor *= 1.2;
      }

      const total =
        scoreLocal +
        scoreVisita +
        empateFactor;

      if (total <= 0) {
        continue;
      }

      const probLocal =
        Number(
          (
            (
              scoreLocal /
              total
            ) * 100
          ).toFixed(2)
        );

      const probEmpate =
        Number(
          (
            (
              empateFactor /
              total
            ) * 100
          ).toFixed(2)
        );

      const probVisita =
        Number(
          (
            (
              scoreVisita /
              total
            ) * 100
          ).toFixed(2)
        );

        
      let pronostico =
        "EMPATE";

      const maximo =
        Math.max(
          probLocal,
          probEmpate,
          probVisita
        );

      if (
        maximo === probLocal
      ) {
        pronostico =
          "LOCAL";
      } else if (
        maximo === probVisita
      ) {
        pronostico =
          "VISITA";
      }

     const {
  error: updateError,
} = await supabase
  .from("pronosticos_partidos")
  .update({
    score_local: Number(
      scoreLocal.toFixed(2)
    ),

    score_visita: Number(
      scoreVisita.toFixed(2)
    ),

    diferencia: Number(
      diferencia.toFixed(2)
    ),

    prob_local: probLocal,

    prob_empate: probEmpate,

    prob_visita: probVisita,

    pronostico,
  })
  .eq("id", partido.id);

  
if (updateError) {
  alert(updateError.message);
} 
  
              if (updateError) {
        console.error(
          updateError
        );

        const {
  data: filasActualizadas,
  error: updateError,
} = await supabase
  .from("pronosticos_partidos")
  .update({
    prob_local: 88,
    pronostico: "TEST",
  })
  .eq("id", partido.id)
  .select();

alert(
  JSON.stringify(
    filasActualizadas,
    null,
    2
  )
);
      }
      
      
    }

    await cargarPartidos();

    alert(
      "Pronósticos generados correctamente"
    );
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    setGenerando(false);
  }
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

        <button
  onClick={generarPronosticos}
  disabled={generando}
  className="
    mb-4
    bg-blue-600
    text-white
    px-4
    py-2
    rounded
    hover:bg-blue-700
  "
>
  {generando
    ? "Generando..."
    : "🎯 Generar Pronósticos"}
</button>

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

              {partido.prob_local > 0 && (
  <div className="mt-2 text-sm">

    <div>
      🏠 Local:
      {" "}
      {partido.prob_local}%
    </div>

    <div>
      🤝 Empate:
      {" "}
      {partido.prob_empate}%
    </div>

    <div>
      ✈️ Visita:
      {" "}
      {partido.prob_visita}%
    </div>

    <div className="font-bold mt-1">
      ✅ Pronóstico:
      {" "}
      {partido.pronostico}
    </div>

  </div>
)}

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