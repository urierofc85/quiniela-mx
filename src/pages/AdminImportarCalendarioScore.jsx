import { useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminImportarCalendarioScore() {
  const [texto, setTexto] = useState("");
  const [partidos, setPartidos] = useState([]);
  const [importando, setImportando] =
    useState(false);

  const procesar = () => {
    const datos = texto
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);

    const resultado = [];

    let jornada = null;

    const jornadaTexto = datos.find(
      (v) =>
        v.toLowerCase().includes("jornada")
    );

    if (jornadaTexto) {
      const match =
        jornadaTexto.match(/\d+/);

      if (match) {
        jornada = Number(match[0]);
      }
    }

    for (let i = 0; i < datos.length - 5; i++) {
      const fecha = datos[i];

      const esFecha =
        /^\d{1,2}\/\d{1,2}\/\d{2}$/.test(
          fecha
        );

      if (!esFecha) continue;

      const [dia, mes, anio] =
        fecha.split("/");

      const fechaSQL =
        `20${anio}-${mes.padStart(
          2,
          "0"
        )}-${dia.padStart(
          2,
          "0"
        )} 00:00:00`;

      resultado.push({
        jornada,

        fecha_partido:
          fechaSQL,

        local:
          datos[i + 3],

        visita:
          datos[i + 5],
      });
    }

    alert(
      `Partidos detectados: ${resultado.length}`
    );

    setPartidos(resultado);
  };

  const importarCalendario =
    async () => {
      try {
        setImportando(true);

        if (
          partidos.length === 0
        ) {
          alert(
            "No hay partidos para importar"
          );
          return;
        }

        const jornada =
          partidos[0].jornada;

        const {
          error: deleteError,
        } = await supabase
          .from(
            "pronosticos_partidos"
          )
          .delete()
          .eq(
            "jornada",
            jornada
          );

        if (deleteError) {
          alert(
            deleteError.message
          );
          return;
        }

        let importados = 0;

        for (const partido of partidos) {
          const {
            error: insertError,
          } = await supabase
            .from(
              "pronosticos_partidos"
            )
            .insert({
              jornada:
                partido.jornada,

              fecha_partido:
                partido.fecha_partido,

              local:
                partido.local,

              visita:
                partido.visita,
            });

          if (insertError) {
            alert(
              `Error insertando:

${insertError.message}`
            );

            continue;
          }

          importados++;
        }

        alert(
          `Partidos importados: ${importados}`
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
        📅 Importar Calendario
        SofaScore
      </h1>

      <div className="bg-white p-6 rounded shadow">
        <p className="mb-4">
          Copia y pega el calendario
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

        <div className="mb-4 p-3 bg-yellow-100 rounded">
          Caracteres capturados:{" "}
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
          "
        >
          Analizar Calendario
        </button>
      </div>

      {partidos.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-4">
            Vista Previa
          </h2>

          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">
                  Jornada
                </th>

                <th className="border p-2">
                  Fecha
                </th>

                <th className="border p-2">
                  Local
                </th>

                <th className="border p-2">
                  Visitante
                </th>
              </tr>
            </thead>

            <tbody>
              {partidos.map(
                (
                  partido,
                  index
                ) => (
                  <tr key={index}>
                    <td className="border p-2">
                      {
                        partido.jornada
                      }
                    </td>

                    <td className="border p-2">
                      {
                        partido.fecha_partido
                      }
                    </td>

                    <td className="border p-2">
                      {
                        partido.local
                      }
                    </td>

                    <td className="border p-2">
                      {
                        partido.visita
                      }
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>

          <button
            onClick={
              importarCalendario
            }
            disabled={importando}
            className="
              mt-6
              bg-green-600
              text-white
              px-6
              py-3
              rounded
            "
          >
            {importando
              ? "Importando..."
              : "✅ Importar Calendario"}
          </button>
        </div>
      )}
    </div>
  );
}