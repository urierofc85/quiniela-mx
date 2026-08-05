import { useState } from "react";

export default function AdminImportarSofaScore() {
  const [texto, setTexto] = useState("");
  const [equipos, setEquipos] = useState([]);

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

      const nombreLargo = datos[i + 1];
      const equipo = datos[i + 2];

      const partidos = Number(datos[i + 3]);

      const diferencia = Number(
        String(datos[i + 7]).replace("+", "")
      );

      const marcador =
        datos[i + 8] || "0:0";

      const [gf, gc] =
        marcador.split(":");

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
      });

      i += 13;
    }

    console.log(
      "EQUIPOS DETECTADOS",
      resultado
    );

    setEquipos(resultado);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">

      <h1 className="text-3xl font-bold mb-6">
        📊 Importar SofaScore
      </h1>

      <div className="bg-white p-6 rounded shadow">

        <p className="mb-4">
          Copia y pega la tabla completa de
          SofaScore.
        </p>

        <textarea
          rows={15}
          value={texto}
          onChange={(e) =>
            setTexto(e.target.value)
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
              </tr>
            </thead>

            <tbody>

              {equipos.map((equipo) => (

                <tr key={equipo.equipo}>

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

              ))}

            </tbody>

          </table>

        </div>

      )}

    </div>
  );
}