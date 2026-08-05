import { useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminImportarLigaMX() {
  const [texto, setTexto] = useState("");

  const normalizar = (texto) => {
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  const importarDatos = async () => {
    try {
      console.log("==== INICIO IMPORTACION ====");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      console.log("SESSION:", session);

      const pruebaAlias = await supabase
        .from("pronosticos_alias_equipos")
        .select("*")
        .limit(3);

      console.log(
        "PRUEBA ALIAS:",
        pruebaAlias
      );

      const pruebaEquipos =
        await supabase
          .from("pronosticos_equipos")
          .select("*")
          .limit(3);

      console.log(
        "PRUEBA EQUIPOS:",
        pruebaEquipos
      );

      const lineas = texto
        .trim()
        .split("\n");

      const {
        data: aliases,
        error: aliasError,
      } = await supabase
        .from("pronosticos_alias_equipos")
        .select("*");

      console.log(
        "ALIASES:",
        aliases
      );

      console.log(
        "ALIAS ERROR:",
        aliasError
      );

      if (aliasError) {
        alert(aliasError.message);
        return;
      }

      let actualizados = 0;
      const noEncontrados = [];

      for (const linea of lineas) {
        const datos = linea
          .split("|")
          .map((v) => v.trim());

        console.log(
          "LINEA:",
          linea
        );

        console.log(
          "DATOS:",
          datos
        );

        if (datos.length < 7) {
          console.log(
            "Línea ignorada:",
            linea
          );
          continue;
        }

        const [
          equipoImportado,
          posicion,
          pj,
          gf,
          gc,
          puntos,
          diferencia,
        ] = datos;

        console.log(
          "Equipo importado:",
          equipoImportado
        );

        const aliasEncontrado =
          aliases.find(
            (a) =>
              normalizar(a.alias) ===
              normalizar(
                equipoImportado
              )
          );

        console.log(
          "Alias encontrado:",
          aliasEncontrado
        );

        if (!aliasEncontrado) {
          noEncontrados.push(
            equipoImportado
          );

          continue;
        }

        const equipoOficial =
          aliasEncontrado.equipo_oficial;

        console.log(
          "Equipo oficial:",
          equipoOficial
        );

        const respuesta =
          await supabase
            .from(
              "pronosticos_equipos"
            )
            .update({
              posicion:
                Number(posicion),

              partidos:
                Number(pj),

              goles_favor:
                Number(gf),

              goles_contra:
                Number(gc),

              puntos:
                Number(puntos),

              diferencia_goles:
                Number(diferencia),
            })
            .eq(
              "equipo",
              equipoOficial
            )
            .select();

        console.log(
          "RESPUESTA UPDATE:",
          respuesta
        );

        if (respuesta.error) {
          console.error(
            "ERROR UPDATE:",
            respuesta.error
          );

          noEncontrados.push(
            equipoImportado
          );

          continue;
        }

        actualizados++;
      }

      console.log(
        "ACTUALIZADOS:",
        actualizados
      );

      console.log(
        "NO ENCONTRADOS:",
        noEncontrados
      );

      if (
        noEncontrados.length > 0
      ) {
        alert(
          `Importación terminada

Equipos actualizados: ${actualizados}

Alias no encontrados:

${noEncontrados.join("\n")}`
        );
      } else {
        alert(
          `Importación exitosa

Equipos actualizados: ${actualizados}`
        );
      }
    } catch (error) {
      console.error(
        "ERROR GENERAL:",
        error
      );

      alert(error.message);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        📥 Importar Liga MX
      </h1>

      <div className="bg-white p-6 rounded shadow">
        <p className="mb-4">
          Formato esperado:
        </p>

        <pre className="bg-gray-100 p-4 rounded mb-4">
{`America|1|3|7|2|9|5
Toluca|2|3|6|3|7|3
Monterrey|3|3|5|3|7|2`}
        </pre>

        <textarea
          rows={12}
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
          onClick={importarDatos}
          className="
            bg-green-600
            text-white
            px-4
            py-2
            rounded
            hover:bg-green-700
          "
        >
          Importar
        </button>
      </div>
    </div>
  );
}