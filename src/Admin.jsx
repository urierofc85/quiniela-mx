import { useState, useEffect } from "react";
import { supabase } from "./services/supabase";
import { Link } from "react-router-dom";
import { obtenerHoraMexico } from "./services/horario";

export default function Admin() {
  const [nombre, setNombre] = useState("");
  const [fechaCierre, setFechaCierre] = useState("");
  const [jornadas, setJornadas] = useState([]);
  const [horaMexico, setHoraMexico] = useState(null);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");

  useEffect(() => {
    verificarUsuario();
    cargarJornadas();
    cargarHoraMexico();
  }, []);

  const verificarUsuario = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log("Usuario autenticado:", user);
      console.log("UUID:", user.id); // Aquí confirmas si es el admin
    } else {
      console.log("No hay usuario autenticado");
    }
  };

  const cargarHoraMexico = async () => {
    try {
      const hora = await obtenerHoraMexico();
      setHoraMexico(hora);
    } catch (error) {
      console.error("Error obteniendo hora CDMX:", error);
    }
  };

  const cargarJornadas = async () => {
    const { data, error } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Error cargando jornadas:", error);
    }
    setJornadas(data || []);
  };

  const crearJornada = async () => {
    if (!nombre || !fechaCierre) {
      alert("Completa todos los campos");
      return;
    }

    const { error } = await supabase
      .from("jornadas")
      .insert([{ nombre, fecha_limite: fechaCierre }]);

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

    const idsPartidos = partidos?.map((p) => p.id) || [];

    if (idsPartidos.length > 0) {
      const { error: errorQuinielas } = await supabase
        .from("quinielas")
        .delete()
        .in("partido_id", idsPartidos);

      if (errorQuinielas) {
        console.error("Error eliminando quinielas:", errorQuinielas);
        alert(errorQuinielas.message);
        return;
      }
    }

    const { error: errorPartidos } = await supabase
      .from("partidos")
      .delete()
      .eq("jornada_id", jornadaId);

    if (errorPartidos) {
      console.error("Error eliminando partidos:", errorPartidos);
      alert(errorPartidos.message);
      return;
    }

    const { error: errorJornada } = await supabase
      .from("jornadas")
      .delete()
      .eq("id", jornadaId);

    if (errorJornada) {
      console.error("Error eliminando jornada:", errorJornada);
      alert(errorJornada.message);
      return;
    }

    alert("Jornada eliminada");
    await cargarJornadas();
  };

  const activarJornadaSeleccionada = async () => {
    if (!jornadaSeleccionada) {
      alert("Selecciona una jornada");
      return;
    }

    // Verificar usuario antes de update
    const { data: { user } } = await supabase.auth.getUser();
    console.log("Usuario:", user);
    console.log("UID:", user?.id);

    // Desactivar todas las jornadas activas
    const { error: desactivarError } = await supabase
      .from("jornadas")
      .update({ activa: false })
      .eq("activa", true);

    if (desactivarError) {
      console.error("Error desactivando jornadas:", desactivarError);
      alert(desactivarError.message);
      return;
    }

    // Verificar usuario antes de segundo update
    const { data: { user: user2 } } = await supabase.auth.getUser();
    console.log("Usuario:", user2);
    console.log("UID:", user2?.id);

    // Activar solo la jornada seleccionada
    const { error: activarError } = await supabase
      .from("jornadas")
      .update({ activa: true })
      .eq("id", jornadaSeleccionada);

    if (activarError) {
      console.error("Error activando jornada:", activarError);
      alert(activarError.message);
      return;
    }

    alert("Jornada activada correctamente");
    await cargarJornadas();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Administración</h1>

      <div className="flex gap-3 mb-6">
        <Link to="/dashboard" className="bg-green-600 text-white px-4 py-2 rounded">
          Dashboard
        </Link>
        <Link to="/participantes" className="bg-purple-600 text-white px-4 py-2 rounded">
          Participantes
        </Link>
      </div>

      <h2 className="text-2xl font-bold mb-4">Nueva Jornada</h2>
      <div className="space-y-4 mb-8">
        <input
          type="text"
          placeholder="Nombre de la Jornada"
          className="w-full border p-2 rounded"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <input
          type="datetime-local"
          className="w-full border p-2 rounded"
          value={fechaCierre}
          onChange={(e) => setFechaCierre(e.target.value)}
        />
        <button
          onClick={crearJornada}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Crear Jornada
        </button>
      </div>

      <h2 className="text-2xl font-bold mb-4">Elegir Jornada Activa</h2>
      <div className="flex gap-3 mb-6">
        <select
          value={jornadaSeleccionada}
          onChange={(e) => setJornadaSeleccionada(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option value="">-- Selecciona una jornada --</option>
          {jornadas.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nombre}
            </option>
          ))}
        </select>
        <button
          onClick={activarJornadaSeleccionada}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Activar Jornada
        </button>
      </div>

      <h2 className="text-2xl font-bold mb-4">Jornadas</h2>
      {jornadas.map((jornada) => (
        <div key={jornada.id} className="border rounded p-4 mb-3 shadow-sm">
          <div className="font-bold text-lg">{jornada.nombre}</div>
          <div className="text-sm text-gray-500">
            Cierre:{" "}
            {jornada.fecha_limite
              ? new Date(jornada.fecha_limite).toLocaleString("es-MX")
              : "Sin fecha"}
          </div>
          <div className="mt-2">
            {horaMexico &&
              (new Date(jornada.fecha_limite) < horaMexico ? (
                <span className="text-red-600 font-bold">🔒 Jornada cerrada</span>
              ) : (
                <span className="text-green-600 font-bold">🟢 Jornada abierta</span>
              ))}
          </div>
          <div className="mt-3 flex gap-2">
            {jornada.activa ? (
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded font-bold">
                ✅ Jornada Activa
              </span>
            ) : null}
            <button
              onClick={() => eliminarJornada(jornada.id)}
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
