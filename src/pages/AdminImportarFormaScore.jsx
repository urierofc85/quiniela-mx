import { useState } from "react";

export default function AdminImportarFormaScore() {
  const [texto, setTexto] = useState("");
  const [equipos, setEquipos] = useState([]);

  const procesar = () => {
    const datos = texto
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);

    const resultado = [];

    let i = 0;

    while (i < datos.length - 5) {
      const posicion = Number(datos[i]);

      if (
        isNaN(posicion) ||
        posicion < 1 ||
        posicion > 18
      ) {
        i++;
        continue;
      }

      const nombreLargo =
        datos[i + 1];

      const equipo =
        datos[i + 2];

      const r1 =
        datos[i + 3];

      const r2 =
        datos[i + 4];

      const r3 =
        datos[i + 5];

      let puntosUltimos5 = 0;

      [r1, r2, r3].forEach(
        (resultadoPartido) => {
          if (
            resultadoPartido === "W"
          ) {
            puntosUltimos5 += 3;
          }

          if (
            resultadoPartido === "D"
          ) {
            puntosUltimos5 += 1;
          }
        }
      );

      resultado.push({
        posicion,
        nombreLargo,
        equipo,

        forma: [
          r1,
          r2,
          r3,
        ],

        puntos_ultimos5:
          puntosUltimos5,
      });

      i += 6;
    }

    alert(
      `Equipos detectados: ${resultado.length}`
    );

    setEquipos(resultado);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        📈 Importar Forma SofaScore
      </h1>

      <div className="bg-white p-6 rounded shadow">
        <p className="mb-4">
          Copia y pega la vista Forma
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
            hover:bg-blue-700
          "
        >
          Analizar Forma
        </button>
      </div>

      {equipos.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-4">
            Vista previa
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
                  Forma
                </th>

                <th className="border p-2">
                  Puntos Forma
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
                      {equipo.forma.join(
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
        </div>
      )}
    </div>
  );
}