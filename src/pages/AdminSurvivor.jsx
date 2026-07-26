import {
  useEffect,
  useState,
  useRef,
} from "react";

import { supabase } from "../services/supabase";
import html2canvas from "html2canvas";

export default function AdminSurvivor() {

  //=========================================
  // ESTADOS
  //=========================================

  const [ranking, setRanking] = useState([]);

  const [jornadas, setJornadas] = useState([]);

  const [
    jornadaSeleccionada,
    setJornadaSeleccionada,
  ] = useState(null);

  const [
    reporteJornada,
    setReporteJornada,
  ] = useState([]);

  const [
    cargando,
    setCargando,
  ] = useState(false);

  const tablaRef = useRef(null);
  const reporteRef = useRef(null);

  //=========================================
  // INICIO
  //=========================================

  useEffect(() => {
    iniciar();
  }, []);

  useEffect(() => {

    if (jornadaSeleccionada) {

      cargarReporteJornada();

    }

  }, [jornadaSeleccionada]);

  //=========================================
  // INICIALIZAR
  //=========================================

  const iniciar = async () => {

    setCargando(true);

    await cargarRanking();

    setCargando(false);

  };

  //=========================================
  // ESPERA RENDER REACT
  //=========================================

  const esperarRender = () =>
    new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

  //=========================================
  // OBTENER JORNADAS
  //=========================================

  const obtenerJornadas = async () => {

    const {
      data,
      error,
    } = await supabase
      .from("jornadas")
      .select("*")
      .order("id");

    if (error) {

      console.error(error);

      return [];

    }

    setJornadas(data || []);

    if (
      !jornadaSeleccionada &&
      data?.length > 0
    ) {

      const activa =
        data.find(
          j => j.activa
        );

      setJornadaSeleccionada(

        Number(

          activa
            ? activa.id
            : data[0].id

        )

      );

    }

    return data || [];

  };

  //=========================================
  // OBTENER PERFILES
  //=========================================

  const obtenerPerfiles = async () => {

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .select("*");

    if (error) {

      console.error(error);

      return [];

    }

    return data || [];

  };

  //=========================================
  // OBTENER PARTIDOS
  //=========================================

  const obtenerPartidos = async () => {

    const {
      data,
      error,
    } = await supabase
      .from("partidos")
      .select("*");

    if (error) {

      console.error(error);

      return [];

    }

    return data || [];

  };

  //=========================================
  // OBTENER SURVIVOR
  //=========================================

  const obtenerSurvivor = async () => {

    const {
      data,
      error,
    } = await supabase
      .from("survivor")
      .select("*");

    if (error) {

      console.error(error);

      return [];

    }

    return data || [];

  };
  //=========================================
  // CARGAR RANKING GENERAL
  //=========================================

  const cargarRanking = async () => {

    const survivor =
      await obtenerSurvivor();

    const perfiles =
      await obtenerPerfiles();

    const partidos =
      await obtenerPartidos();

    await obtenerJornadas();

    const acumulado = {};

    for (const registro of survivor) {

      const usuario =
        perfiles.find(
          p =>
            p.id ===
            registro.usuario_id
        );

      const partido =
        partidos.find(
          p =>
            Number(p.jornada_id) ===
              Number(registro.jornada_id) &&
            (
              p.local === registro.equipo ||
              p.visitante === registro.equipo
            )
        );

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

          usuario_id:
            registro.usuario_id,

          nombre,

          puntos: 0,

          vidas: 0,

          jornadas: []

        };

      }

      //--------------------------------------------------
      // Si el partido aún no tiene resultado
      //--------------------------------------------------

      if (
        !partido ||
        !partido.resultado
      ) {

        acumulado[
          registro.usuario_id
        ].jornadas.push({

          jornada:
            registro.jornada_id,

          equipo:
            registro.equipo,

          estado:
            "Pendiente"

        });

        continue;

      }

      //--------------------------------------------------
      // Calcular puntos
      //--------------------------------------------------

      let puntos = 0;

      let perdio = false;

      if (
        partido.local ===
        registro.equipo
      ) {

        switch (
          partido.resultado
        ) {

          case "L":
            puntos = 3;
            break;

          case "E":
            puntos = 1;
            break;

          case "V":
            perdio = true;
            break;

        }

      }

      if (
        partido.visitante ===
        registro.equipo
      ) {

        switch (
          partido.resultado
        ) {

          case "V":
            puntos = 3;
            break;

          case "E":
            puntos = 1;
            break;

          case "L":
            perdio = true;
            break;

        }

      }

      //--------------------------------------------------
      // Acumular
      //--------------------------------------------------

      acumulado[
        registro.usuario_id
      ].puntos += puntos;

      if (perdio) {

        acumulado[
          registro.usuario_id
        ].vidas++;

      }

      acumulado[
        registro.usuario_id
      ].jornadas.push({

        jornada:
          registro.jornada_id,

        equipo:
          registro.equipo,

        puntos,

        perdio

      });

    }

    //--------------------------------------------------
    // Ordenar ranking
    //--------------------------------------------------

    const rankingFinal =
      Object.values(
        acumulado
      ).sort(

        (a, b) => {

          if (
            b.puntos !==
            a.puntos
          ) {

            return (
              b.puntos -
              a.puntos
            );

          }

          if (
            a.vidas !==
            b.vidas
          ) {

            return (
              a.vidas -
              b.vidas
            );

          }

          return a.nombre.localeCompare(
            b.nombre
          );

        }

      );

    setRanking(
      rankingFinal
    );

  };

  //=========================================
  // CONTINÚA EN PARTE 3
  //=========================================
    //=========================================
  // REPORTE POR JORNADA
  //=========================================

  const cargarReporteJornada = async () => {

    if (!jornadaSeleccionada) return;

    const {
      data: survivor,
      error,
    } = await supabase
      .from("survivor")
      .select("*")
      .eq(
        "jornada_id",
        Number(jornadaSeleccionada)
      );

    if (error) {

      console.error(error);

      return;

    }

    const perfiles =
      await obtenerPerfiles();

    const filas =
      (survivor || []).map(
        (item) => {

          const perfil =
            perfiles.find(
              p =>
                p.id ===
                item.usuario_id
            );

          return {

            participante:

              perfil?.nombre_usuario ||

              perfil?.nombre ||

              perfil?.nombre_completo ||

              item.usuario ||

              "Sin nombre",

            seleccion:
              item.equipo

          };

        }
      );

    filas.sort(
      (a,b)=>
        a.participante.localeCompare(
          b.participante
        )
    );

    setReporteJornada(
      filas
    );

  };

  //=========================================
  // EXPORTAR RANKING
  //=========================================

  const exportarJPG = async () => {

    if (!tablaRef.current) {

      alert(
        "No existe el ranking."
      );

      return;

    }

    await esperarRender();

    const canvas =
      await html2canvas(
        tablaRef.current,
        {

          scale: 3,

          useCORS: true,

          allowTaint: true,

          logging: false,

          backgroundColor:
            "#ffffff"

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

  //=========================================
  // EXPORTAR REPORTE JORNADA
  //=========================================

  const exportarJornadaJPG =
    async () => {

      if (!jornadaSeleccionada) {

        alert(
          "Selecciona una jornada."
        );

        return;

      }

      await cargarReporteJornada();

      await esperarRender();

      if (!reporteRef.current) {

        alert(
          "No existe el reporte."
        );

        return;

      }

      const canvas =
        await html2canvas(
          reporteRef.current,
          {

            scale: 3,

            useCORS: true,

            allowTaint: true,

            logging: false,

            backgroundColor:
              "#ffffff"

          }
        );

      const jornada =
        jornadas.find(
          j =>
            Number(j.id) ===
            Number(jornadaSeleccionada)
        );

      const nombre =
        jornada?.nombre ||
        jornadaSeleccionada;

      const link =
        document.createElement(
          "a"
        );

      link.download =
        `Survivor-${nombre}.jpg`;

      link.href =
        canvas.toDataURL(
          "image/jpeg",
          1
        );

      link.click();

    };

  //=========================================
  // CONTINÚA EN PARTE 4
  //=========================================
    //=========================================
  // RENDER
  //=========================================

  return (

    <div className="p-6 bg-gray-100 min-h-screen">

      <h1 className="text-3xl font-bold mb-6">
        🏆 Ranking Survivor
      </h1>

      <div className="flex flex-wrap gap-3 mb-6">

        <button
          onClick={exportarJPG}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          🖼️ Exportar Ranking JPG
        </button>

        <select
          value={jornadaSeleccionada || ""}
          onChange={(e) =>
            setJornadaSeleccionada(
              Number(e.target.value)
            )
          }
          className="border rounded px-3 py-2 bg-white"
        >

          {jornadas.map((j) => (

            <option
              key={j.id}
              value={j.id}
            >
              {j.nombre}
            </option>

          ))}

        </select>

        <button
          onClick={exportarJornadaJPG}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          📸 Exportar Jornada JPG
        </button>

      </div>

      {cargando ? (

        <div className="bg-white rounded shadow p-8 text-center">

          Cargando Survivor...

        </div>

      ) : (

        <>

          {/*====================================
              TABLA GENERAL
          ====================================*/}

          <div
            ref={tablaRef}
            className="bg-white rounded shadow p-6 mb-8"
          >

            <h2 className="text-2xl font-bold mb-4">

              Ranking General

            </h2>

            <table className="w-full border-collapse border">

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
                  (fila, index) => (

                    <tr key={fila.usuario_id}>

                      <td className="border p-2 text-center font-bold">

                        {index === 0 && "🥇 "}
                        {index === 1 && "🥈 "}
                        {index === 2 && "🥉 "}

                        {index + 1}

                      </td>

                      <td className="border p-2">

                        {fila.nombre}

                      </td>

                      <td className="border p-2 text-center font-bold">

                        {fila.puntos}

                      </td>

                      <td className="border p-2 text-center">

                        {fila.vidas}

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

          {/*====================================
              REPORTE JORNADA
          ====================================*/}

          <div
            ref={reporteRef}
            className="bg-white rounded shadow p-6"
          >

            <h2 className="text-2xl font-bold mb-4">

              Survivor -

              {" "}

              {jornadas.find(
                j =>
                  Number(j.id) ===
                  Number(jornadaSeleccionada)
              )?.nombre || ""}

            </h2>

            {reporteJornada.length === 0 ? (

              <div className="bg-yellow-100 border border-yellow-400 rounded p-4">

                No existen selecciones para esta jornada.

              </div>

            ) : (

              <table className="w-full border-collapse border">

                <thead className="bg-gray-200">

                  <tr>

                    <th className="border p-2">
                      Participante
                    </th>

                    <th className="border p-2">
                      Equipo
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {reporteJornada.map(
                    (fila, index) => (

                      <tr key={index}>

                        <td className="border p-2">

                          {fila.participante}

                        </td>

                        <td className="border p-2 text-center font-bold">

                          {fila.seleccion}

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            )}

          </div>

        </>

      )}

    </div>

  );

}