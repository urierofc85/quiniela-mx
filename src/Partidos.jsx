
import { useEffect, useState } from "react";
import { supabase } from "./services/supabase";
import { obtenerHoraMexico } from "./services/horario"

export default function Partidos() {
  const [jornadas, setJornadas] = useState([]);
  const [jornadaId, setJornadaId] = useState("");

  const [partidos, setPartidos] = useState(
    Array.from({ length: 19 }, () => ({
      local: "",
      visitante: "",
    }))
  );

  useEffect(() => {
    cargarJornadas();
  }, []);

  const cargarJornadas = async () => {
    const { data } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: false });

    setJornadas(data || []);
  };

  const guardarPartidos = async () => {
    if (!jornadaId) {
      alert("Selecciona una jornada");
      return;
    }

    const registros = partidos
      .filter(
        (p) =>
          p.local.trim() !== "" &&
          p.visitante.trim() !== ""
      )
      .map((p) => ({
        jornada_id: jornadaId,
        local: p.local,
        visitante: p.visitante,
      }));

    if (registros.length === 0) {
      alert("Debes capturar al menos un partido");
      return;
    }

    const { error } = await supabase
      .from("partidos")
      .insert(registros);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      `${registros.length} partidos guardados correctamente`
    );

    setPartidos(
      Array.from({ length: 19 }, () => ({
        local: "",
        visitante: "",
      }))
    );
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">

      <h1 className="text-2xl font-bold mb-4">
        Carga Masiva de Partidos
      </h1>

      <select
        className="border p-2 w-full mb-6 rounded"
        value={jornadaId}
        onChange={(e) =>
          setJornadaId(e.target.value)
        }
      >
        <option value="">
          Seleccionar Jornada
        </option>

        {jornadas.map((j) => (
          <option key={j.id} value={j.id}>
            {j.nombre}
          </option>
        ))}
      </select>

      {partidos.map((partido, index) => (
        <div
          key={index}
          className="grid grid-cols-2 gap-3 mb-3"
        >
          <input
            type="text"
            placeholder={`Local ${index + 1}`}
            value={partido.local}
            onChange={(e) => {
              const copia = [...partidos];
              copia[index].local =
                e.target.value;
              setPartidos(copia);
            }}
            className="border p-2 rounded"
          />

          <input
            type="text"
            placeholder={`Visitante ${index + 1}`}
            value={partido.visitante}
            onChange={(e) => {
              const copia = [...partidos];
              copia[index].visitante =
                e.target.value;
              setPartidos(copia);
            }}
            className="border p-2 rounded"
          />
        </div>
      ))}

      <button
        onClick={guardarPartidos}
        className="bg-blue-600 text-white px-6 py-2 rounded mt-4"
      >
        Guardar Partidos
      </button>

    </div>
  );
}
