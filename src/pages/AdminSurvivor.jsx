import {
  useEffect,
  useState,
  useRef,
} from "react";

import { supabase } from "../services/supabase";
import html2canvas from "html2canvas";

export default function AdminSurvivor() {

  const [ranking, setRanking] =
    useState([]);

  const [jornadas, setJornadas] =
    useState([]);

  const [
    jornadaSeleccionada,
    setJornadaSeleccionada,
  ] = useState(null);

  const [
    reporteJornada,
    setReporteJornada,
  ] = useState([]);

  const tablaRef = useRef(null);
  const reporteRef = useRef(null);

  useEffect(() => {
    cargarRanking();
  }, []);

  useEffect(() => {
    if (jornadaSeleccionada) {
      cargarReporteJornada();
    }
  }, [jornadaSeleccionada]);

  const cargarRanking = async () => {

    const {
      data: survivor,
    } = await supabase
      .from("survivor")
      .select("*");

    const {
      data: perfiles,
    } = await supabase
      .from("profiles")
      .select("*");

    const {
      data: jornadasData,
    } = await supabase
      .from("jornadas")
      .select("*")
      .order("id");

    setJornadas(
      jornadasData || []
    );

    const jornadaActiva =
      jornadasData?.find(
        (j) => j.activa === true
      );

    if (jornadaActiva) {

      setJornadaSeleccionada(
        Number(
          jornadaActiva.id
        )
      );

    } else if (
      jornadasData?.length > 0
    ) {

      setJornadaSeleccionada(
        Number(
          jornadasData[0].id
        )
      );

    }

    const {
      data: partidos,
    } = await supabase
      .from("partidos")
      .select("*");

    const acumulado = {};

    (survivor || []).forEach(
      (registro) => {

        const usuario =
          perfiles?.find(
            (p) =>
              p.id ===
              registro.usuario_id
          );

        const partido =
          partidos?.find(
            (p) =>
              Number(
                p.jornada_id
              ) ===
                Number(
                  registro.jornada_id
                ) &&
              (
                p.local ===
                  registro.equipo ||
                p.visitante ===
                  registro.equipo
              )
          );

        let puntos = 0;

        if (
          partido?.resultado
        ) {

          if (
            partido.local ===
            registro.equipo
          ) {

            if (
              partido.resultado ===
              "L"
            ) {
              puntos = 3;
            }

            if (
              partido.resultado ===
              "E"
            ) {
              puntos = 1;
            }

          }

          if (
            partido.visitante ===
            registro.equipo
          ) {

            if (
              partido.resultado ===
              "V"
            ) {
              puntos = 3;
            }

            if (
              partido.resultado ===
              "E"
            ) {
              puntos = 1;
            }

          }

        }

        
        const nombre =
          usuario?.nombre_usuario ||
          usuario?.nombre ||
          usuario?.nombre_completo ||
          registro.usuario ||
          "Sin nombre";


        if (
          !acumulado[
            registro.usuario_id
          ]
        ) {

          acumulado[
            registro.usuario_id
          ] = {
            nombre,
            puntos: 0,
            vidas: 0,
          };

        }

        acumulado[
          registro.usuario_id
        ].puntos += puntos;

        if (
          puntos === 0 &&
          partido?.resultado
        ) {

          acumulado[
            registro.usuario_id
          ].vidas += 1;

        }

      }
    );

    const rankingFinal =
      Object.values(
        acumulado
      )
      .sort(
  (a, b) => {

    if (
      b.puntos !== a.puntos
    ) {

      return (
        b.puntos -
        a.puntos
      );

    }

    return (
      a.vidas -
      b.vidas
    );

  }
);

    setRanking(
      rankingFinal
    );
  };

  const cargarReporteJornada =
  async () => {

    if (!jornadaSeleccionada)
      return;

    const {
      data: survivor,
      error,
    } = await supabase
      .from("survivor")
      .select("*")
      .eq(
        "jornada_id",
        Number(
          jornadaSeleccionada
        )
      );

    if (error) {
      console.error(error);
      return;
    }

    const {
      data: perfiles,
    } = await supabase
      .from("profiles")
      .select("*");

    const filas =
      (survivor || []).map(
        (item) => {

          const perfil =
            perfiles?.find(
              (p) =>
                p.id ===
                item.usuario_id
            );

          return {

            participante:
              perfil?.nombre_usuario ||
              perfil?.nombre ||
              perfil?.nombre_completo ||
              item.usuario,

            seleccion:
              item.equipo,

          };

        }
      );

    setReporteJornada(
      filas
    );
};
  const exportarJPG =
    async () => {

      const canvas =
        await html2canvas(
          tablaRef.current,
          {
            scale: 3,
            backgroundColor:
              "#ffffff",
          }
        );

      const link =
        document.createElement(
          "a"
        );

      link.download =
        "ranking-survivor.jpg";

      link.href =
        canvas.toDataURL(
          "image/jpeg",
          1
        );

      link.click();
    };

  const exportarJornadaJPG =
    async () => {

      const canvas =
        await html2canvas(
          reporteRef.current,
          {
            scale: 2,
            backgroundColor:
              "#ffffff",
          }
        );

      const link =
        document.createElement(
          "a"
        );

      link.download =
        `survivor-jornada-${jornadaSeleccionada}.jpg`;

      link.href =
        canvas.toDataURL(
          "image/jpeg",
          1
        );

      link.click();
    };

  return (

    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        🏆 Ranking Survivor
      </h1>

      <div className="flex gap-3 mb-6 flex-wrap">

        <button
          onClick={
            exportarJPG
          }
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          🖼️ Exportar Ranking JPG
        </button>

        <select
          value={
            jornadaSeleccionada || ""
          }
          onChange={(e) =>
            setJornadaSeleccionada(
              Number(
                e.target.value
              )
            )
          }
          className="border px-3 py-2 rounded"
        >
          {jornadas.map(
            (j) => (
              <option
                key={j.id}
                value={j.id}
              >
                {j.nombre}
              </option>
            )
          )}
        </select>

        <button
          onClick={
            exportarJornadaJPG
          }
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          📸 Exportar Jornada JPG
        </button>

      </div>

      <div
        ref={tablaRef}
        className="mb-10"
      >

        <table className="w-full border">

          <thead className="bg-gray-200">

            <tr>

              <th className="border p-2">
                Pos
              </th>

              <th className="border p-2">
                Participante
              </th>

              <th className="border p-2">
                Puntos
              </th>

              <th className="border p-2">
                Vidas Perdidas
              </th>

            </tr>

          </thead>

          <tbody>

            {ranking.map(
              (
                fila,
                index
              ) => (

                <tr key={index}>

                  <td className="border p-2">
                    {index + 1}
                  </td>

                  <td className="border p-2">
                    {fila.nombre}
                  </td>

                  <td className="border p-2 font-bold">
                    {fila.puntos}
                  </td>

                  <td className="border p-2">
                    {fila.vidas}
                  </td>

                </tr>

              )
            )}

          </tbody>

        </table>

      </div>

      <div
        ref={reporteRef}
        className="bg-white p-4 rounded shadow"
      >

        <h2 className="text-2xl font-bold mb-4">
          Survivor por Jornada
        </h2>

        {reporteJornada.length === 0 ? (

          <div className="bg-yellow-100 border border-yellow-300 rounded p-4">
            No hay selecciones registradas para esta jornada.
          </div>

        ) : (

          <table className="w-full border">

            <thead className="bg-gray-200">

              <tr>

                <th className="border p-2">
                  Participante
                </th>

                <th className="border p-2">
                  Selección
                </th>

              </tr>

            </thead>

            <tbody>

              {reporteJornada.map(
                (
                  fila,
                  idx
                ) => (

                  <tr key={idx}>

                    <td className="border p-2">
                      {
                        fila.participante
                      }
                    </td>

                    <td className="border p-2 font-bold">
                      {
                        fila.seleccion
                      }
                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        )}

      </div>

    </div>

  );
}