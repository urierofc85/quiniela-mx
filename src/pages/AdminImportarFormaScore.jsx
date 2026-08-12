import { useState } from "react";

export default function AdminImportarFormaScore() {
  const [texto, setTexto] = useState("");

  const procesar = () => {
    const datos = texto
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);

    alert(
      datos
        .slice(0, 100)
        .map(
          (v, i) => `${i}: ${v}`
        )
        .join("\n")
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        📈 Importar Forma SofaScore
      </h1>

      <div className="bg-white p-6 rounded shadow">
        <p className="mb-4">
          Copia y pega la vista Forma de
          SofaScore.
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
          Analizar Forma
        </button>
      </div>
    </div>
  );
}