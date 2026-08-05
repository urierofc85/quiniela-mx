import { useState } from "react";

export default function AdminImportarSofaScore() {
  const [texto, setTexto] = useState("");
  const [lineas, setLineas] = useState([]);

  const procesar = () => {
    const resultado = texto
      .split("\n")
      .map((linea) => linea.trim())
      .filter(Boolean);

    console.log("TEXTO CRUDO:");
    console.log(texto);

    console.log("LINEAS:");
    console.log(resultado);

    setLineas(resultado);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        📊 Importar SofaScore
      </h1>

      <div className="bg-white p-6 rounded shadow">

        <p className="mb-4">
          Copia y pega directamente desde SofaScore.
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
          Analizar Pegar
        </button>

      </div>

      {lineas.length > 0 && (

        <div className="mt-6 bg-white p-6 rounded shadow">

          <h2 className="text-xl font-bold mb-4">
            Vista Previa
          </h2>

          <div className="space-y-2">

            {lineas.map(
              (linea, index) => (
                <div
                  key={index}
                  className="
                    border-b
                    py-2
                    text-sm
                  "
                >
                  {index + 1}. {linea}
                </div>
              )
            )}

          </div>

        </div>

      )}
    </div>
  );
}   