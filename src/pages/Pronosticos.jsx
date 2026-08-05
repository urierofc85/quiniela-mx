import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

function calcularPronostico(local, visita) {
  const partidosLocal = local.partidos || 1;
  const partidosVisita = visita.partidos || 1;

  const ataqueLocal =
    local.local_goles_favor / partidosLocal;

  const defensaLocal =
    local.local_goles_contra / partidosLocal;

  const ataqueVisita =
    visita.visita_goles_favor / partidosVisita;

  const defensaVisita =
    visita.visita_goles_contra / partidosVisita;

  // LOCALÍA

  const factorLocal = 1.15;

  let xGLocal =
    (
      ataqueLocal * factorLocal +
      defensaVisita
    ) / 2;

  let xGVisita =
    (
      ataqueVisita +
      defensaLocal
    ) / 2;

  // FORMA RECIENTE

  const formaLocal =
    (local.puntos_ultimos5 || 0) / 15;

  const formaVisita =
    (visita.puntos_ultimos5 || 0) / 15;

  const ajusteForma =
    (formaLocal - formaVisita) * 0.15;

  xGLocal =
    xGLocal *
    (1 + ajusteForma);

  xGVisita =
    xGVisita *
    (1 - ajusteForma);

  // VALOR DE PLANTILLA

  const valorLocal =
    Number(local.valor_plantilla || 0);

  const valorVisita =
    Number(visita.valor_plantilla || 0);

  const fuerzaLocal =
    valorLocal / 100;

  const fuerzaVisita =
    valorVisita / 100;

  const ajustePlantilla =
    (
      fuerzaLocal -
      fuerzaVisita
    ) * 0.20;

  xGLocal =
    xGLocal *
    (1 + ajustePlantilla);

  xGVisita =
    xGVisita *
    (1 - ajustePlantilla);

  // POSICIÓN TABLA

  const posicionLocal =
    Number(local.posicion || 18);

  const posicionVisita =
    Number(visita.posicion || 18);

  const rankingLocal =
    (19 - posicionLocal) / 18;

  const rankingVisita =
    (19 - posicionVisita) / 18;

  const ajustePosicion =
    (
      rankingLocal -
      rankingVisita
    ) * 0.15;

  xGLocal =
    xGLocal *
    (1 + ajustePosicion);

  xGVisita =
    xGVisita *
    (1 - ajustePosicion);

  // PUNTOS EN TABLA

  const puntosLocal =
    Number(local.puntos || 0);

  const puntosVisita =
    Number(visita.puntos || 0);

  const ajustePuntos =
    (
      (puntosLocal - puntosVisita) /
      50
    ) * 0.10;

  xGLocal =
    xGLocal *
    (1 + ajustePuntos);

  xGVisita =
    xGVisita *
    (1 - ajustePuntos);

  const diferencia =
    xGLocal - xGVisita;

  let resultado = "Empate";

  if (diferencia > 0.35) {
    resultado = `Gana ${local.equipo}`;
  }

  if (diferencia < -0.35) {
    resultado = `Gana ${visita.equipo}`;
  }

  const confianza = Math.min(
    Math.abs(diferencia) * 120,
    95
  );

  return {
    resultado,
    confianza,
    xGLocal,
    xGVisita,
    formaLocal,
    formaVisita,
    valorLocal,
    valorVisita,
    posicionLocal,
    posicionVisita,
    puntosLocal,
    puntosVisita,
  };
}

export default function Pronosticos() {
  const navigate = useNavigate();

  const [partidos, setPartidos] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const autorizado =
      sessionStorage.getItem(
        "pronosticos_autorizado"
      );

    if (!autorizado) {
      navigate("/acceso-pronosticos");
      return;
    }

    cargarPronosticos();
  }, [navigate]);

  const cargarPronosticos = async () => {
    try {
      setLoading(true);

      const {
        data: partidosData,
        error,
      } = await supabase
        .from("pronosticos_partidos")
        .select("*")
        .order("fecha_partido", {
          ascending: true,
        });

      if (error) {
        console.error(error);
        return;
      }

      const resultados = [];

      for (const partido of partidosData) {
        const { data: local } =
          await supabase
            .from("pronosticos_equipos")
            .select("*")
            .eq(
              "equipo",
              partido.local
            )
            .single();

        const { data: visita } =
          await supabase
            .from("pronosticos_equipos")
            .select("*")
            .eq(
              "equipo",
              partido.visita
            )
            .single();

        if (!local || !visita) {
          continue;
        }

        const pronostico =
          calcularPronostico(
            local,
            visita
          );

        resultados.push({
          ...partido,
          ...pronostico,
        });
      }

      setPartidos(resultados);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          📈 Pronósticos Deportivos
        </h1>

        <button
          onClick={cargarPronosticos}
          className="
            bg-blue-600
            hover:bg-blue-700
            text-white
            px-4
            py-2
            rounded
          "
        >
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="bg-white p-6 rounded shadow">
          Cargando pronósticos...
        </div>
      ) : partidos.length === 0 ? (
        <div className="bg-white p-6 rounded shadow">
          No existen partidos registrados.
        </div>
      ) : (
        <div className="grid gap-4">
          {partidos.map((partido) => (
            <div
              key={partido.id}
              className="
                bg-white
                border
                rounded-lg
                shadow-md
                p-5
              "
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">
                  {partido.local}
                  {" vs "}
                  {partido.visita}
                </h2>

                <span className="text-sm text-gray-500">
                  Jornada {partido.jornada}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <p>
                  <strong>Pronóstico:</strong>{" "}
                  {partido.resultado}
                </p>

                <p>
                  <strong>Confianza:</strong>{" "}
                  {partido.confianza.toFixed(0)}%
                </p>

                <p>
                  <strong>Forma Local:</strong>{" "}
                  {(partido.formaLocal * 100).toFixed(0)}%
                </p>

                <p>
                  <strong>Forma Visitante:</strong>{" "}
                  {(partido.formaVisita * 100).toFixed(0)}%
                </p>

                <p>
                  <strong>Valor Plantilla Local:</strong>{" "}
                  {partido.valorLocal}
                </p>
                
                <p>
                  <strong>Valor Plantilla Visitante:</strong>{" "}
                  {partido.valorVisita}
                </p>
                <p>
  <strong>Posición Local:</strong>{" "}
  {partido.posicionLocal}
</p>

<p>
  <strong>Posición Visitante:</strong>{" "}
  {partido.posicionVisita}
</p>

<p>
  <strong>Puntos Local:</strong>{" "}
  {partido.puntosLocal}
</p>

<p>
  <strong>Puntos Visitante:</strong>{" "}
  {partido.puntosVisita}
</p>

                <p>
                  <strong>xG Local:</strong>{" "}
                  {partido.xGLocal.toFixed(2)}
                </p>

                <p>
                  <strong>xG Visitante:</strong>{" "}
                  {partido.xGVisita.toFixed(2)}
                </p>
              </div>

              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full"
                    style={{
                      width: `${partido.confianza}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}