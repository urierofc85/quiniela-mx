import { useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminFormaTemporadas() {
  const [texto, setTexto] = useState("");

  const [equipos, setEquipos] =
    useState([]);

  const [temporada, setTemporada] =
    useState("Apertura 2025-2026");

  const [tipo, setTipo] =
    useState("GENERAL");

 const procesar = () => {
  const datos = texto
    .replace(/<[^>]*>/g, "")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  const resultado = [];

  for (let i = 0; i < datos.length - 8; i++) {
    const posicion = Number(datos[i]);

    if (
      isNaN(posicion) ||
      posicion < 1 ||
      posicion > 18
    ) {
      continue;
    }

    const equipo = datos[i + 1];

    const partidos =
      Number(datos[i + 2]);

    const victorias =
      Number(datos[i + 3]);

    const empates =
      Number(datos[i + 4]);

    const derrotas =
      Number(datos[i + 5]);

    const diferenciaTexto =
      datos[i + 6];

    const marcador =
      datos[i + 7];

    const puntos = Number(
      datos[i + 8]
    );

    if (
      !marcador.includes(":")
    ) {
      continue;
    }

    const diferencia =
      Number(
        diferenciaTexto.replace(
          "+",
          ""
        )
      );

    const [gf, gc] =
      marcador.split(":");

    resultado.push({
      posicion,
      equipo,

      partidos,

      victorias,
      empates,
      derrotas,

      goles_favor:
        Number(gf),

      goles_contra:
        Number(gc),

      diferencia_goles:
        diferencia,

      puntos,
    });
  }

  const equiposUnicos =
    resultado.filter(
      (equipo, index, self) =>
        index ===
        self.findIndex(
          (e) =>
            e.posicion ===
            equipo.posicion
        )
    );

  setEquipos(equiposUnicos);

  alert(
    `Equipos detectados: ${equiposUnicos.length}`
  );
};

const importarTemporada = async () => {
  try {
    setImportando(true);

    let importados = 0;

    for (const equipo of equipos) {
      const { error } =
        await supabase
          .from(
            "pronosticos_temporadas_equipos"
          )
          .upsert(
            {
              temporada,
              tipo,

              equipo:
                equipo.equipo,

              partidos:
                equipo.partidos,

              victorias:
                equipo.victorias,

              empates:
                equipo.empates,

              derrotas:
                equipo.derrotas,

              goles_favor:
                equipo.goles_favor,

              goles_contra:
                equipo.goles_contra,

              diferencia_goles:
                equipo.diferencia_goles,

              puntos:
                equipo.puntos,
            },
            {
              onConflict:
                "temporada,tipo,equipo",
            }
          );

      if (error) {
        console.error(error);
        continue;
      }

      importados++;
    }

    alert(
      `Equipos importados: ${importados}`
    );
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    setImportando(false);
  }
};

  return (
    <div className="p-6 max-w-7xl mx-auto">

      <h1 className="text-3xl font-bold mb-6">
        📊 Importar Temporadas
      </h1>

      <div className="bg-white p-6 rounded shadow">

        <div className="mb-4">
          <label className="block mb-2 font-semibold">
            Temporada
          </label>

          <select
            value={temporada}
            onChange={(e) =>
              setTemporada(
                e.target.value
              )
            }
            className="border rounded p-2 w-full"
          >
            <option value="Apertura 2025-2026">
              Apertura 2025-2026
            </option>

            <option value="Clausura 2025-2026">
              Clausura 2025-2026
            </option>

            <option value="Apertura 2026-2027">
              Apertura 2026-2027
            </option>

            <option value="Clausura 2026-2027">
              Clausura 2026-2027
            </option>

            <option value="Apertura 2027-2028">
              Apertura 2027-2028
            </option>

            <option value="Clausura 2027-2028">
              Clausura 2027-2028
            </option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-2 font-semibold">
            Tipo
          </label>

          <select
            value={tipo}
            onChange={(e) =>
              setTipo(
                e.target.value
              )
            }
            className="border rounded p-2 w-full"
          >
            <option value="GENERAL">
              GENERAL
            </option>

            <option value="LOCAL">
              LOCAL
            </option>

            <option value="VISITANTE">
              VISITANTE
            </option>
          </select>
        </div>

        <textarea
          rows={15}
          value={texto}
          onChange={(e) =>
            setTexto(
              e.target.value
            )
          }
          className="
            w-full
            border
            rounded
            p-3
            mb-4
          "
        />

        <button
          onClick={procesar}
          className="
            bg-blue-600
            text-white
            px-4
            py-2
            rounded
          "
        >
          Analizar Temporada
        </button>

      </div>

      {equipos.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded shadow">

          <h2 className="text-xl font-bold mb-4">
            Vista Previa
          </h2>

          <table className="w-full border">

            <thead>
              <tr className="bg-gray-100">

                <th className="border p-2">
                  Pos
                </th>

                <th className="border p-2">
                  Equipo
                </th>

                <th className="border p-2">
                  PJ
                </th>

                <th className="border p-2">
                  W
                </th>

                <th className="border p-2">
                  D
                </th>

                <th className="border p-2">
                  L
                </th>

                <th className="border p-2">
                  GF
                </th>

                <th className="border p-2">
                  GC
                </th>

                <th className="border p-2">
                  DIF
                </th>

                <th className="border p-2">
                  PTS
                </th>

              </tr>
            </thead>

            <tbody>
              {equipos.map(
                (equipo) => (
                  <tr
                    key={`${equipo.posicion}-${equipo.equipo}`}
                  >
                    <td className="border p-2">
                      {equipo.posicion}
                    </td>

                    <td className="border p-2">
                      {equipo.equipo}
                    </td>

                    <td className="border p-2">
                      {equipo.partidos}
                    </td>

                    <td className="border p-2">
                      {equipo.victorias}
                    </td>

                    <td className="border p-2">
                      {equipo.empates}
                    </td>

                    <td className="border p-2">
                      {equipo.derrotas}
                    </td>

                    <td className="border p-2">
                      {equipo.goles_favor}
                    </td>

                    <td className="border p-2">
                      {equipo.goles_contra}
                    </td>

                    <td className="border p-2">
                      {equipo.diferencia_goles}
                    </td>

                    <td className="border p-2">
                      {equipo.puntos}
                    </td>

                  </tr>
                )
              )}
            </tbody>

          </table>

          <button
  onClick={importarTemporada}
  disabled={importando}
  className="
    mt-6
    bg-green-600
    text-white
    px-6
    py-3
    rounded
    hover:bg-green-700
  "
>
  {importando
    ? "Importando..."
    : "✅ Importar Temporada"}
</button>

        </div>
      )}
    </div>
  );
}