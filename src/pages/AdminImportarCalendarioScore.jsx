import { useState } from "react";

export default function AdminImportarCalendarioScore() {
  const [texto, setTexto] = useState("");

 const procesar = () => {
  const datos = texto
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  const partidos = [];

  for (let i = 0; i < datos.length - 5; i++) {
    const fecha = datos[i];

    const esFecha =
      /^\d{1,2}\/\d{1,2}\/\d{2}$/.test(
        fecha
      );

    if (!esFecha) {
      continue;
    }

    partidos.push({
      fecha: datos[i],
      hora: datos[i + 1],

      local:
        datos[i + 3],

      visita:
        datos[i + 5],
    });
  }

  alert(
    partidos
      .map(
        (p) =>
          `${p.fecha}
${p.hora}
${p.local} vs ${p.visita}`
      )
      .join("\n\n")
  );
};
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        📅 Importar Calendario SofaScore
      </h1>

      <div className="bg-white p-6 rounded shadow">
        <p className="mb-4">
          Copia y pega los partidos del
          calendario de SofaScore.
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
          Analizar Calendario
        </button>
      </div>
    </div>
  );
}