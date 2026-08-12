import { useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminFormaTemporadas() {
  const [texto, setTexto] = useState("");
  const [equipos, setEquipos] = useState([]);

  const [temporada, setTemporada] =
    useState("Apertura 2026");

  const [tipo, setTipo] =
    useState("GENERAL");

  const [importando, setImportando] =
    useState(false);

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
            <option>
              Apertura 2026
            </option