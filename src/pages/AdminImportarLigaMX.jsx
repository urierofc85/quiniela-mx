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
      const lineas = texto
        .trim()
        .split("\n");

      const { data: aliases, error: aliasError } =
        await supabase
          .from("pronosticos_alias_equipos")
          .select("*");

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

        const aliasEncontrado =
          aliases.find(
            (a) =>
              normalizar(a.alias) ===
              normalizar(equipoImportado)
          );

        if (!aliasEncontrado) {
          noEncontrados.push(
            equipoImportado
          );
          continue;
        }

        const equipoOficial =
          aliasEncontrado.equipo_oficial;

        const { error: updateError } =
          await supabase
            .from("pronosticos_equipos")
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
            );

        if (updateError) {
          console.error(
            updateError
          );

          noEncontrados.push(
            equipoImportado
          );

          continue;
        }

        actualizados++;
      }

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
      console.error(error);
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

        <p className="text-sm text-gray-600 mb-4">
          El sistema buscará automáticamente
          equivalencias usando la tabla:
          <strong>
            {" "}
            pronosticos_alias_equipos
          </strong>
        </p>

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