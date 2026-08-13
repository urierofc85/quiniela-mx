import { useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminRecalcularRatings() {
  const [equipos, setEquipos] = useState([]);
  const [procesando, setProcesando] =
    useState(false);

const normalizar = (texto) =>
  texto
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const recalcularRatings =
    async () => {
      try {
        setProcesando(true);

        const {
  data,
  error,
} = await supabase
  .from("pronosticos_equipos")
  .select("*");

const {
  data: historicos,
  error: errorHistoricos,
} = await supabase
  .from("pronosticos_temporadas_equipos")
  .select("*");

if (errorHistoricos) {
  alert(errorHistoricos.message);
  return;
}

        if (error) {
          alert(error.message);
          return;
        }

        const resultado =
          data.map((equipo) => {
            const partidos =
              equipo.partidos || 1;

            const puntosMaximos =
              partidos * 3;

            const ratingGeneral =
              (
                ((equipo.puntos || 0) /
                  puntosMaximos) *
                100
              ).toFixed(2);

            const ratingOfensivo =
              Math.min(
                (
                  ((equipo.goles_favor ||
                    0) /
                    partidos) *
                  33.33
                ).toFixed(2),
                100
              );

            const ratingDefensivo =
              Math.max(
                (
                  (1 -
                    (equipo.goles_contra ||
                      0) /
                      partidos /
                      3) *
                  100
                ).toFixed(2),
                0
              );

            const ratingForma =
              (
                ((equipo.puntos_ultimos5 ||
                  0) /
                  15) *
                100
              ).toFixed(2);

            const ratingLocal =
              (
                ((equipo.puntos_local ||
                  0) /
                  Math.max(
                    (
                      equipo.victorias_local ||
                      0
                    ) *
                      3,
                    1
                  )) *
                100
              ).toFixed(2);

            const ratingVisitante =
              (
                ((equipo.puntos_visitante ||
                  0) /
                  Math.max(
                    (
                      equipo
                        .victorias_visitante ||
                      0
                    ) *
                      3,
                    1
                  )) *
                100
              ).toFixed(2);

            const ratingTotal =
              Number(ratingGeneral) *
                0.4 +
              Number(ratingForma) *
                0.2 +
              Number(ratingOfensivo) *
                0.15 +
              Number(ratingDefensivo) *
                0.15 +
              Number(ratingLocal) *
                0.05 +
              Number(
                ratingVisitante
              ) *
                0.05;

                const registrosHistoricos =
  historicos.filter(
    (h) =>
      normalizar(h.equipo) ===
      normalizar(equipo.equipo)
  );

let ratingHistorico = 0;

if (
  registrosHistoricos.length > 0
) {
  const suma =
    registrosHistoricos.reduce(
      (acc, item) => {
        const pj =
          item.partidos || 1;

        const efectividad =
          (item.puntos /
            (pj * 3)) *
          100;

        return acc + efectividad;
      },
      0
    );

  ratingHistorico =
    suma /
    registrosHistoricos.length;
}

const ratingTendencia =
  ratingTotal -
  ratingHistorico;

            return {
              ...equipo,

              rating_general:
                Number(
                  ratingGeneral
                ),

              rating_ofensivo:
                Number(
                  ratingOfensivo
                ),

              rating_defensivo:
                Number(
                  ratingDefensivo
                ),

              rating_forma:
                Number(
                  ratingForma
                ),

              rating_local:
                Number(
                  ratingLocal
                ),

              rating_visitante:
                Number(
                  ratingVisitante
                ),

              rating_total:
                Number(
                  ratingTotal.toFixed(
                    2
                  )
                ),
rating_historico:
  Number(
    ratingHistorico.toFixed(2)
  ),

rating_tendencia:
  Number(
    ratingTendencia.toFixed(2)
  ),

            };
          });

        for (const equipo of resultado) {
          await supabase
            .from(
              "pronosticos_equipos"
            )
            .update({
  rating_general:
    equipo.rating_general,

  rating_ofensivo:
    equipo.rating_ofensivo,

  rating_defensivo:
    equipo.rating_defensivo,

  rating_forma:
    equipo.rating_forma,

  rating_local:
    equipo.rating_local,

  rating_visitante:
    equipo.rating_visitante,

  rating_total:
    equipo.rating_total,

  rating_historico:
    equipo.rating_historico,

  rating_tendencia:
    equipo.rating_tendencia,
})
            .eq(
              "equipo",
              equipo.equipo
            );
        }

        setEquipos(
          resultado.sort(
            (a, b) =>
              b.rating_total -
              a.rating_total
          )
        );

        alert(
          "Ratings recalculados correctamente"
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
        ⚙️ Recalcular Ratings
      </h1>

      <button
        onClick={
          recalcularRatings
        }
        disabled={procesando}
        className="
          bg-green-600
          text-white
          px-6
          py-3
          rounded
          hover:bg-green-700
        "
      >
        {procesando
          ? "Procesando..."
          : "⚙️ Recalcular"}
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
                  General
                </th>

                <th className="border p-2">
                  Forma
                </th>

                <th className="border p-2">
                  Ofensivo
                </th>

                <th className="border p-2">
                  Defensivo
                </th>

                <th className="border p-2">
                  Local
                </th>

                <th className="border p-2">
                  Visitante
                </th>

                <th className="border p-2">
                  Total
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
                        equipo.rating_general
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.rating_forma
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.rating_ofensivo
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.rating_defensivo
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.rating_local
                      }
                    </td>

                    <td className="border p-2">
                      {
                        equipo.rating_visitante
                      }
                    </td>

                    <td className="border p-2 font-bold">
                      {
                        equipo.rating_total
                      }
                    </td>

                  </tr>
                )
              )}
            </tbody>

          </table>

          <h2 className="text-xl font-bold mt-8 mb-4">
  📚 Rating Histórico
</h2>

<table className="w-full border">
  <thead>
    <tr className="bg-gray-100">

      <th className="border p-2">
        Equipo
      </th>

      <th className="border p-2">
        Histórico
      </th>

      <th className="border p-2">
        Tendencia
      </th>

    </tr>
  </thead>

  <tbody>
    {equipos.map((equipo) => (
      <tr key={`hist-${equipo.equipo}`}>

        <td className="border p-2">
          {equipo.equipo}
        </td>

        <td className="border p-2">
          {equipo.rating_historico}
        </td>

        <td className="border p-2">
          {equipo.rating_tendencia}
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