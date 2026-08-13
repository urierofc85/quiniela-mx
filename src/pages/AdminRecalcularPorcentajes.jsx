import { useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminRecalcularPorcentajes() {
  const [equipos, setEquipos] = useState([]);
  const [procesando, setProcesando] =
    useState(false);

  const normalizar = (texto = "") =>
    texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const recalcular = async () => {
    try {
      setProcesando(true);

      const {
        data: equiposActuales,
        error: errorEquipos,
      } = await supabase
        .from("pronosticos_equipos")
        .select("*");

      if (errorEquipos) {
        alert(errorEquipos.message);
        return;
      }

      const {
        data: historicos,
        error: errorHistoricos,
      } = await supabase
        .from(
          "pronosticos_temporadas_equipos"
        )
        .select("*");

      if (errorHistoricos) {
        alert(errorHistoricos.message);
        return;
      }

      const resultado = [];

      for (const equipo of equiposActuales) {
        const registros =
          historicos.filter(
            (h) =>
              normalizar(h.equipo) ===
              normalizar(
                equipo.equipo
              )
          );

        const locales =
          registros.filter(
            (r) =>
              r.tipo === "LOCAL"
          );

        const visitantes =
          registros.filter(
            (r) =>
              r.tipo ===
              "VISITANTE"
          );

        let lGana = 0;
        let lEmpata = 0;
        let lPierde = 0;

        let vGana = 0;
        let vEmpata = 0;
        let vPierde = 0;

        if (locales.length > 0) {
          const partidos =
            locales.reduce(
              (a, b) =>
                a +
                (b.partidos || 0),
              0
            );

          const victorias =
            locales.reduce(
              (a, b) =>
                a +
                (b.victorias ||
                  0),
              0
            );

          const empates =
            locales.reduce(
              (a, b) =>
                a +
                (b.empates || 0),
              0
            );

          const derrotas =
            locales.reduce(
              (a, b) =>
                a +
                (b.derrotas ||
                  0),
              0
            );

          if (partidos > 0) {
            lGana =
              (victorias /
                partidos) *
              100;

            lEmpata =
              (empates /
                partidos) *
              100;

            lPierde =
              (derrotas /
                partidos) *
              100;
          }
        }

        if (
          visitantes.length > 0
        ) {
          const partidos =
            visitantes.reduce(
              (a, b) =>
                a +
                (b.partidos || 0),
              0
            );

          const victorias =
            visitantes.reduce(
              (a, b) =>
                a +
                (b.victorias ||
                  0),
              0
            );

          const empates =
            visitantes.reduce(
              (a, b) =>
                a +
                (b.empates ||
                  0),
              0
            );

          const derrotas =
            visitantes.reduce(
              (a, b) =>
                a +
                (b.derrotas ||
                  0),
              0
            );

          if (partidos > 0) {
            vGana =
              (victorias /
                partidos) *
              100;

            vEmpata =
              (empates /
                partidos) *
              100;

            vPierde =
              (derrotas /
                partidos) *
              100;
          }
        }

        await supabase
          .from(
            "pronosticos_equipos"
          )
          .update({
            pct_hist_local_gana:
              Number(
                lGana.toFixed(2)
              ),

            pct_hist_local_empata:
              Number(
                lEmpata.toFixed(2)
              ),

            pct_hist_local_pierde:
              Number(
                lPierde.toFixed(2)
              ),

            pct_hist_visita_gana:
              Number(
                vGana.toFixed(2)
              ),

            pct_hist_visita_empata:
              Number(
                vEmpata.toFixed(2)
              ),

            pct_hist_visita_pierde:
              Number(
                vPierde.toFixed(2)
              ),
          })
          .eq(
            "equipo",
            equipo.equipo
          );

        resultado.push({
          equipo:
            equipo.equipo,

          pct_hist_local_gana:
            Number(
              lGana.toFixed(2)
            ),

          pct_hist_local_empata:
            Number(
              lEmpata.toFixed(2)
            ),

          pct_hist_local_pierde:
            Number(
              lPierde.toFixed(2)
            ),

          pct_hist_visita_gana:
            Number(
              vGana.toFixed(2)
            ),

          pct_hist_visita_empata:
            Number(
              vEmpata.toFixed(2)
            ),

          pct_hist_visita_pierde:
            Number(
              vPierde.toFixed(2)
            ),
        });
      }

      setEquipos(resultado);

      alert(
        "Porcentajes recalculados"
      );
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        📊 Recalcular Porcentajes
      </h1>

      <button
        onClick={recalcular}
        disabled={procesando}
        className="
          bg-blue-600
          text-white
          px-6
          py-3
          rounded
        "
      >
        {procesando
          ? "Procesando..."
          : "📊 Recalcular"}
      </button>

      {equipos.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded shadow">
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">
                  Equipo
                </th>

                <th className="border p-2">
                  L Gana %
                </th>

                <th className="border p-2">
                  L Emp %
                </th>

                <th className="border p-2">
                  L Pierde %
                </th>

                <th className="border p-2">
                  V Gana %
                </th>

                <th className="border p-2">
                  V Emp %
                </th>

                <th className="border p-2">
                  V Pierde %
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
                        equipo.equipo
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.pct_hist_local_gana
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.pct_hist_local_empata
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.pct_hist_local_pierde
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.pct_hist_visita_gana
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.pct_hist_visita_empata
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.pct_hist_visita_pierde
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