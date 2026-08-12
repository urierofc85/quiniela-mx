import { useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminImportarSofaScore() {
  const [texto, setTexto] = useState("");
  const [equipos, setEquipos] = useState([]);
  const [importando, setImportando] =
    useState(false);

  const normalizar = (texto) => {
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

const procesar = () => {
  const datos = texto
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  const resultado = [];

  
  for (let i = 0; i < datos.length - 8; i++) {
    const posicion = Number(datos[i]);

    const equipo = datos[i + 1];

    const partidos = Number(datos[i + 2]);

    const ganados = Number(datos[i + 3]);

    const empatados = Number(datos[i + 4]);

    const perdidos = Number(datos[i + 5]);

    const diferenciaTexto =
      datos[i + 6];

    const marcador =
      datos[i + 7];

    const puntos = Number(
      datos[i + 8]
    );

    const esBloqueValido =
      !isNaN(posicion) &&
      posicion >= 1 &&
      posicion <= 18 &&
      isNaN(Number(equipo)) &&
      !isNaN(partidos) &&
      !isNaN(ganados) &&
      !isNaN(empatados) &&
      !isNaN(perdidos) &&
      marcador.includes(":") &&
      !isNaN(puntos);

    if (!esBloqueValido) {
      continue;
    }

    const diferencia = Number(
      diferenciaTexto.replace("+", "")
    );

    const [gf, gc] =
      marcador.split(":");

    resultado.push({
  posicion,
  equipo,

  partidos,

  ganados,
  empatados,
  perdidos,

  goles_favor: Number(gf),
  goles_contra: Number(gc),

  diferencia_goles: diferencia,

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

  alert(
    `Equipos detectados: ${equiposUnicos.length}`
  );

  setEquipos(equiposUnicos);
};

const importarPronosticos = async () => {
  try {
    setImportando(true);

    const {
      data: aliases,
      error,
    } = await supabase
      .from(
        "pronosticos_alias_equipos"
      )
      .select("*");

    if (error) {
      alert(error.message);
      return;
    }

    let actualizados = 0;

    const noEncontrados = [];

    for (const equipo of equipos) {
      const alias =
        aliases.find(
          (a) =>
            normalizar(a.alias) ===
            normalizar(
              equipo.equipo
            )
        );

      if (!alias) {
        noEncontrados.push(
          equipo.equipo
        );
        continue;
      }

      alert(
JSON.stringify(
  equipos[0],
  null,
  2
)
);
      const {
        error: updateError,
      } = await supabase
        .from(
          "pronosticos_equipos"
        )
        .update({
          posicion:
            equipo.posicion,

          partidos:
            equipo.partidos,

            victorias: equipos.ganados,
  empates: equipos.empatados,
  derrotas: equipos.perdidos,

          goles_favor:
            equipo.goles_favor,

          goles_contra:
            equipo.goles_contra,

          diferencia_goles:
            equipo.diferencia_goles,

          puntos:
            equipo.puntos,
        })
        .eq(
          "equipo",
          alias.equipo_oficial
        );

      if (updateError) {
        console.error(
          updateError
        );

        noEncontrados.push(
          equipo.equipo
        );

        continue;
      }

      actualizados++;
    }

    alert(
      `Equipos actualizados: ${actualizados}`
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
        📊 Importar SofaScore Prueba
      </h1>

      <div className="bg-white p-6 rounded shadow">

        <p className="mb-4">
          Copia y pega la tabla
          completa de SofaScore.
        </p>

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

        <div className="mt-2 mb-4 p-3 bg-yellow-100 rounded">
          Caracteres capturados:
          {" "}
          {texto.length}
        </div>

        <button
          onClick={procesar}
          className="
            bg-blue-600
            text-white
            px-4
            py-2
            rounded
            hover:bg-blue-700
          "
        >
          Analizar SofaScore
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
                      {
                        equipo.posicion
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.equipo
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.partidos
                      }
                    </td>
                    
                    <td className="border p-2">
                     {equipo.ganados}
                    </td>

                    <td className="border p-2">
                      {equipo.empatados}
                    </td>

                    <td className="border p-2">
                      {equipo.perdidos}
                    </td>

                    <td className="border p-2">
  {equipo.goles_favor}
</td>

<td className="border p-2">
  {equipo.goles_contra}
</td>

                    <td className="border p-2">
                      {
                        equipo.diferencia_goles
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.puntos
                      }
                    </td>
                  </tr>
                )
              )}

            </tbody>

          </table>

          <button
            onClick={
              importarPronosticos
            }
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
              : "✅ Importar a Pronósticos"}
          </button>

        </div>
      )}

    </div>
  );
}