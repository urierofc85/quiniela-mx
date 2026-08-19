import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function Participantes() {
  const [participantes, setParticipantes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    cargarParticipantes();
  }, []);

  const cargarParticipantes = async () => {
    // Agregamos 'solo_survivor' a la consulta
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nombre_usuario, nombre_completo, email, telefono, banco, clabe, rol, solo_survivor")
      .order("nombre_usuario", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setParticipantes(data || []);
  };

  const toggleSeleccion = (id) => {
    if (seleccionados.includes(id)) {
      setSeleccionados(seleccionados.filter((item) => item !== id));
    } else {
      setSeleccionados([...seleccionados, id]);
    }
  };

  // Función para activar/desactivar el modo "Solo Survivor"
  const toggleSoloSurvivor = async (userId, currentStatus) => {
    const nuevoEstado = !currentStatus;
    
    // 1. Actualización optimista en la UI (para que se sienta instantáneo)
    setParticipantes(prev => 
      prev.map(p => p.id === userId ? { ...p, solo_survivor: nuevoEstado } : p)
    );

    // 2. Guardar en la base de datos
    const { error } = await supabase
      .from("profiles")
      .update({ solo_survivor: nuevoEstado })
      .eq("id", userId);

    if (error) {
      console.error("Error actualizando modo de juego:", error);
      alert("Error al actualizar. Verifica que la columna 'solo_survivor' exista en la tabla profiles.");
      
      // Revertir el cambio en la UI si falló
      setParticipantes(prev => 
        prev.map(p => p.id === userId ? { ...p, solo_survivor: currentStatus } : p)
      );
    }
  };

  const eliminarUsuarios = async () => {
    if (seleccionados.length === 0) {
      alert("Selecciona al menos un usuario");
      return;
    }

    const confirmar = window.confirm(
      `¿Deseas eliminar completamente ${seleccionados.length} usuario(s)?`
    );

    if (!confirmar) return;

    setCargando(true);

    for (const userId of seleccionados) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(
          "https://cfybuywzclttwbhafjlq.supabase.co/functions/v1/clever-action",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ userId }),
          }
        );

        const resultado = await response.json();
        console.log("RESPUESTA EDGE:", resultado);

        if (!response.ok) {
          alert(resultado.error || "Error eliminando usuario de Authentication");
          setCargando(false);
          return;
        }
      } catch (error) {
        console.log("Error eliminando auth user:", error);
        alert("No fue posible conectar con la Edge Function.");
        setCargando(false);
        return;
      }
    }

    const { error: errorProfiles } = await supabase
      .from("profiles")
      .delete()
      .in("id", seleccionados);

    if (errorProfiles) {
      alert(errorProfiles.message);
      setCargando(false);
      return;
    }

    alert("Usuarios eliminados completamente");
    setSeleccionados([]);
    await cargarParticipantes();
    setCargando(false);
  };

  const participantesFiltrados = participantes.filter((p) => {
    const texto = busqueda.toLowerCase();
    return (
      (p.nombre_usuario || "").toLowerCase().includes(texto) ||
      (p.nombre_completo || "").toLowerCase().includes(texto) ||
      (p.email || "").toLowerCase().includes(texto)
    );
  });

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">👥 Participantes</h1>

      <input
        type="text"
        placeholder="Buscar participante..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="border p-2 rounded w-full mb-4"
      />

      <div className="flex justify-between items-center mb-4">
        <div>
          Total participantes: <strong>{participantesFiltrados.length}</strong>
        </div>

        <button
          onClick={eliminarUsuarios}
          disabled={cargando}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {cargando ? "Eliminando..." : "Eliminar Seleccionados"}
        </button>
      </div>

      <div className="overflow-x-auto border rounded shadow">
        <table className="w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-3 text-center">Eliminar</th>
              <th className="p-3 text-center">Solo Survivor</th>
              <th className="p-3 text-left">Usuario</th>
              <th className="p-3 text-left">Nombre Completo</th>
              <th className="p-3 text-left">Correo</th>
              <th className="p-3 text-left">Teléfono</th>
              <th className="p-3 text-left">Banco</th>
              <th className="p-3 text-left">CLABE</th>
              <th className="p-3 text-left">Rol</th>
            </tr>
          </thead>

          <tbody>
            {participantesFiltrados.map((participante) => (
              <tr key={participante.id} className="border-t hover:bg-gray-50 transition">
                <td className="p-3 text-center">
                  {participante.rol !== "admin" && (
                    <input
                      type="checkbox"
                      checked={seleccionados.includes(participante.id)}
                      onChange={() => toggleSeleccion(participante.id)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  )}
                </td>
                
                {/* NUEVA COLUMNA: SOLO SURVIVOR */}
                <td className="p-3 text-center">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={participante.solo_survivor || false}
                      onChange={() => toggleSoloSurvivor(participante.id, participante.solo_survivor)}
                      className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                    />
                    <span className={`ml-2 text-sm font-medium ${participante.solo_survivor ? 'text-purple-700' : 'text-gray-500'}`}>
                      {participante.solo_survivor ? "Sí 🦖" : "No"}
                    </span>
                  </label>
                </td>

                <td className="p-3">{participante.nombre_usuario || "-"}</td>
                <td className="p-3">{participante.nombre_completo || "-"}</td>
                <td className="p-3">{participante.email}</td>
                <td className="p-3">{participante.telefono || "-"}</td>
                <td className="p-3">{participante.banco || "-"}</td>
                <td className="p-3">{participante.clabe || "-"}</td>
                <td className="p-3">
                  <span
                    className={
                      participante.rol === "admin"
                        ? "text-red-600 font-bold"
                        : "text-blue-600"
                    }
                  >
                    {participante.rol}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-sm text-gray-600 bg-blue-50 p-4 rounded border border-blue-200">
        <strong>💡 Nota para el desarrollo:</strong> Ahora que los usuarios pueden marcarse como "Solo Survivor", recuerda agregar una validación en tu página de <strong>Quiniela</strong> que consulte este campo (`solo_survivor`) y muestre un mensaje o deshabilite los inputs si es `true`.
      </div>
    </div>
  );
}