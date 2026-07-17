import { useState, useEffect } from "react";
import { supabase } from "./services/supabase";
import { Link } from "react-router-dom";
import { obtenerHoraMexico } from "./services/horario";

export default function Admin() {
  const [nombre, setNombre] = useState("");
  const [fechaCierre, setFechaCierre] = useState("");
  const [jornadas, setJornadas] = useState([]);
  const [horaMexico, setHoraMexico] = useState(null);

  useEffect(() => {
    cargarJornadas();
    cargarHoraMexico();
  }, []);

  const cargarHoraMexico = async () => {
    try {
      const hora = await obtenerHoraMexico();
      setHoraMexico(hora);
    } catch (error) {
      console.error("Error obteniendo hora CDMX:", error);
    }
  };

  const cargarJornadas = async () => {
    const { data } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: false });

    setJornadas(data || []);
  };

  const crearJornada = async () => {
    if (!nombre || !fechaCierre) {
      alert("Completa todos los campos");
      return;
    }

    const { error } = await supabase
      .from("jornadas")
      .insert([
        {
          nombre,
          fecha_limite: fechaCierre,
        },
      ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Jornada creada");

    setNombre("");
    setFechaCierre("");

    await cargarJornadas();
  };

  const eliminarJornada = async (jornadaId) => {
    const confirmar = window.confirm(
      "¿Deseas eliminar esta jornada y toda su información?"
    );

    if (!confirmar) return;

    const { data: partidos } = await supabase
      .from("partidos")
      .select("id")
      .eq("jornada_id", jornadaId);

    const idsPartidos =
      partidos?.map((p) => p.id) || [];

    if (idsPartidos.length > 0) {
      const { error: errorQuinielas } =
        await supabase
          .from("quinielas")
          .delete()
          .in("partido_id", idsPartidos);

      if (errorQuinielas) {
        alert(errorQuinielas.message);
        return;
      }
    }

    const { error: errorPartidos } =
      await supabase
        .from("partidos")
        .delete()
        .eq("jornada_id", jornadaId);

    if (errorPartidos) {
      alert(errorPartidos.message);
      return;
    }

    const { error: errorJornada } =
      await supabase
        .from("jornadas")
        .delete()
        .eq("id", jornadaId);

    if (errorJornada) {
      alert(errorJornada.message);
      return;
    }

    alert("Jornada eliminada");

    await cargarJornadas();
  };

  const activarJornada = async (jornadaId) => {
    await supabase
      .from("jornadas")
      .update({ activa: false })
      .neq("id", 0);

    const { error } = await supabase
      .from("jornadas")
      .update({ activa: true })
      .eq("id", jornadaId);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Jornada activada");

    await cargarJornadas();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">

      <h1 className="text-3xl font-bold mb-6">
        Administración
      </h1>

      <div className="flex gap-3 mb-6">

        <Link
          to="/dashboard"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Dashboard
        </Link>

        <Link
          to="/participantes"
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Participantes
        </Link>

      </div>

      <h2 className="text-2xl font-bold mb-4">
        Nueva Jornada
      </h2>

      <div className="space-y-4 mb-8">

        <input
          type="text"
          placeholder="Nombre de la Jornada"
          className="w-full border p-2 rounded"
          value={nombre}
          onChange={(e) =>
            setNombre(e.target.value)
          }
        />

        <input
          type="datetime-local"
          className="w-full border p-2 rounded"
          value={fechaCierre}
          onChange={(e) =>
            setFechaCierre(e.target.value)
          }
        />

        <button
          onClick={crearJornada}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Crear Jornada
        </button>

      </div>

      <h2 className="text-2xl font-bold mb-4">
        Jornadas
      </h2>

      {jornadas.map((jornada) => (
        <div
          key={jornada.id}
          className="border rounded p-4 mb-3 shadow-sm"
        >

          <div className="font-bold text-lg">
            {jornada.nombre}
          </div>

          <div className="text-sm text-gray-500">
            Cierre:{" "}
            {jornada.fecha_limite
              ? new Date(
                  jornada.fecha_limite
                ).toLocaleString("es-MX")
              : "Sin fecha"}
          </div>

          <div className="mt-2">
            {horaMexico &&
              (new Date(jornada.fecha_limite) <
              horaMexico ? (
                <span className="text-red-600 font-bold">
                  🔒 Jornada cerrada
                </span>
              ) : (
                <span className="text-green-600 font-bold">
                  🟢 Jornada abierta
                </span>
              ))}
          </div>

          <div className="mt-3 flex gap-2">

            {jornada.activa ? (
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded font-bold">
                ✅ Jornada Activa
              </span>
            ) : (
              <button
                onClick={() =>
                  activarJornada(jornada.id)
                }
                className="bg-blue-600 text-white px-3 py-1 rounded"
              >
                Activar Jornada
              </button>
            )}

            <button
              onClick={() =>
                eliminarJornada(jornada.id)
              }
              className="bg-red-600 text-white px-3 py-1 rounded"
            >
              Eliminar
            </button>

          </div>

        </div>
      ))}

    </div>
  );
}