import { useState } from "react";

export default function AdminFormaTemporadas() {
  const [texto, setTexto] = useState("");
  const [temporada, setTemporada] =
    useState("Apertura 2025");

  const [tipo, setTipo] =
    useState("GENERAL");

 const procesar = () => {
  const datos = texto
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  alert(
    datos
      .slice(0, 150)
      .map((v, i) => `${i}: ${v}`)
      .join("\n")
  );
};

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        📊 Importar Temporadas
      </h1>

      <div className="bg-white p-6 rounded shadow">

        <div className="mb-4">
          <label className="block mb-2 font-semibold">
            Temporada
          </label>

          <select
            value={temporada}
            onChange={(e) =>
              setTemporada(e.target.value)
            }
            className="
              border
              rounded
              p-2
              w-full
            "
          >
            <option value="Apertura 2025">
              Apertura 2025
            </option>

             <option value="Clausura 2025">
              Clausura 2025
            </option>

            <option value="Apertura 2026">
              Apertura 2026
            </option>

            <option value="Clausura 2027">
              Clausura 2027
            </option>

            <option value="Apertura 2027">
              Apertura 2027
            </option>

            <option value="Clausura 2028">
              Clausura 2028
            </option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-2 font-semibold">
            Tipo
          </label>

          <select
            value={tipo}
            onChange={(e) =>
              setTipo(e.target.value)
            }
            className="
              border
              rounded
              p-2
              w-full
            "
          >
            <option value="GENERAL">
              GENERAL
            </option>

            <option value="LOCAL">
              LOCAL
            </option>

            <option value="VISITANTE">
              VISITANTE
            </option>
          </select>
        </div>

        <p className="mb-4">
          Copia y pega la tabla completa
          de SofaScore.
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
          Analizar Temporada
        </button>

      </div>
    </div>
  );
}