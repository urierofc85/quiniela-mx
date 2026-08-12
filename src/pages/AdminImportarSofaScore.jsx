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

    let i = 0;

    while (i < datos.length) {
      const posicion = Number(datos[i]);

      if (isNaN(posicion)) {
        i++;
        continue;
      }

      const nombreLargo =
        datos[i + 1];

      const equipo =
        datos[i + 2];

      const partidos = Number(
        datos[i + 3]
      );

      const diferencia = Number(
        String(datos[i + 7]).replace(
          "+",
          ""
        )
      );

      const marcador =
        datos[i + 8] || "0:0";

      const [gf, gc] =
        marcador.split(":");

      const resultado1 =
        datos[i + 9] || "";

      const resultado2 =
        datos[i + 10] || "";

      const resultado3 =
        datos[i + 11] || "";

      const resultadosRecientes = [
        resultado1,
        resultado2,
        resultado3,
      ];

      let puntosUltimos5 = 0;

      resultadosRecientes.forEach(
        (resultado) => {
          if (resultado === "W") {
            puntosUltimos5 += 3;
          }

          if (resultado === "D") {
            puntosUltimos5 += 1;
          }
        }
      );

      const puntos =
        Number(datos[i + 12]);

      resultado.push({
        posicion,
        nombreLargo,
        equipo,

        partidos,

        goles_favor:
          Number(gf),

        goles_contra:
          Number(gc),

        diferencia_goles:
          diferencia,

        puntos,

        puntos_ultimos5:
          puntosUltimos5,

        resultadosRecientes,
      });

      i += 13;
    }

    console.log(
      "EQUIPOS DETECTADOS",
      resultado
    );

    setEquipos(resultado);
  };

  const importarPronosticos =
    async () => {
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

        const noEncontrados =
          [];

        for (const equipo of equipos) {
          const alias =
            aliases.find(
              (a) =>
                normalizar(
                  a.alias
                ) ===
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

              goles_favor:
                equipo.goles_favor,

              goles_contra:
                equipo.goles_contra,

              diferencia_goles:
                equipo.diferencia_goles,

              puntos:
                equipo.puntos,

              puntos_ultimos5:
                equipo.puntos_ultimos5,
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

        if (
          noEncontrados.length > 0
        ) {
          alert(
            `Importación completada

Equipos actualizados: ${actualizados}

Equipos no encontrados:

${noEncontrados.join(
  "\n"
)}`
          );
        } else {
          alert(
            `Importación completada

Equipos actualizados: ${actualizados}`
          );
        }
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
        📊 Importar SofaScore
      </h1>

      <div className="bg-white p-6 rounded shadow">
        <p className="mb-4">
          Copia y pega la tabla completa
          de SofaScore.
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

                <th className="border p-2">
                  Forma
                </th>

                <th className="border p-2">
                  Últimos 5
                </th>
              </tr>
            </thead>

            <tbody>
              {equipos.map(
                (equipo) => (
                  <tr
                    key={
                      equipo.equipo
                    }
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
                      {
                        equipo.goles_favor
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.goles_contra
                      }
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

                    <td className="border p-2">
                      {equipo.resultadosRecientes.join(
                        " "
                      )}
                    </td>

                    <td className="border p-2">
                      {
                        equipo.puntos_ultimos5
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