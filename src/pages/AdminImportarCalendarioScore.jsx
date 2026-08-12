import { useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminImportarCalendarioScore() {
  const [texto, setTexto] = useState("");
  const [partidos, setPartidos] = useState([]);
  const [importando, setImportando] = useState(false);

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

      if (!esFecha) {
        continue;
      }

      const [dia, mes, anio] =
        fecha.split("/");

      const fechaSQL =
        `20${anio}-${mes.padStart(
          2,
          "0"
        )}-${dia.padStart(2, "0")}`;

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

        await supabase
          .from(
            "pronosticos_partidos"
          )
          .delete()
          .eq(
            "jornada",
            jornada
          );

        let importados = 0;

        for (const partido of partidos) {
          const { error } =
            await supabase
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

          if (error) {
            console.error(error);
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
        📅 Importar Calendario SofaScore
      </h1>

      <div className="bg-