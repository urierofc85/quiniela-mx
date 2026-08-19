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
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nombre_usuario, nombre_completo, email, telefono, banco, clabe, rol, solo_survivor")
      .order("nombre_usuario", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    // Aseguramos que solo_survivor y modificado existan con valores por defecto
    const datosLimpios = (data || []).map(p => ({
      ...p,
      solo_survivor: p.solo_survivor || false,
      modificado: false
    }));

    setParticipantes(datosLimpios);
  };

  const toggleSeleccion = (id) => {
    if (seleccionados.includes(id)) {
      setSeleccionados(seleccionados.filter((item) => item !== id));
    } else {
      setSeleccionados([...seleccionados, id]);
    }
  };

  // Solo actualiza el estado local y marca como modificado
  const toggleSoloSurvivor = (userId) => {
    setParticipantes(prev => 
      prev.map(p => {
        if (p.id === userId) {
          return { ...p, solo_survivor: !p.solo_survivor, modificado: true };
        }
        return p;
      })
    );
  };

  // Función para guardar todos los cambios pendientes en la BD
  const guardarModosDeJuego = async () => {
    const usuariosAModificar = participantes.filter(p => p.modificado);
    
    if (usuariosAModificar.length === 0) {
      alert("No hay cambios pendientes por guardar.");
      return;
    }

    if (!window.confirm(`¿Estás seguro de guardar los cambios de modo de juego para ${usuariosAModificar.length} usuario(s)?`)) {
      return;
    }

    setCargando(true);
    let exitos = 0;
    let fallos = 0;

    for (const usuario of usuariosAModificar) {
      const { error } = await supabase
        .from("profiles")
        .update({ solo_survivor: usuario.solo_survivor })
        .eq("id", usuario.id);

      if (error) {
        console.error("Error actualizando", usuario.nombre_usuario, error);
        fallos++;
      } else {
        exitos++;
      }
    }

    setCargando(false);

    if (fallos === 0) {
      alert(`✅ ${exitos} cambio(s) guardado(s) correctamente.`);
      // Quitamos la marca de "modificado" para limpiar la vista
      setParticipantes(prev => prev.map(p => ({ ...p, modificado: false })));
    } else {
      alert(`⚠️ Se guardaron ${exitos} cambios, pero hubo ${fallos} errores. Se recargará la lista.`);
      await cargarParticipantes();
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

  const hayCambiosPendientes = participantes.some(p => p.modificado);

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

      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          Total participantes: <strong>{participantesFiltrados.length}</strong>
          {hayCambiosPendientes && (
            <span className="ml-3 text-sm text-blue-600 font-semibold animate-pulse">
              * Hay cambios sin guardar
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={guardarModosDeJuego}
            disabled={cargando || !hayCambiosPendientes}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center gap-2 font-semibold"
          >
            💾 Guardar Cambios de Modo
          </button>
          
          <button
            onClick={eliminarUsuarios}
            disabled={cargando || seleccionados.length === 0}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {cargando ? "Procesando..." : "Eliminar Seleccionados"}
          </button>
        </div>
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
              <tr 
                key={participante.id} 
                className={`border-t hover:bg-gray-50 transition ${participante.modificado ? 'bg-blue-50' : ''}`}
              >
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
                
                <td className="p-3 text-center">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={participante.solo_survivor || false}
                      onChange={() => toggleSoloSurvivor(participante.id)}
                      className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                    />
                    <span className={`ml-2 text-sm font-medium ${participante.solo_survivor ? 'text-purple-700' : 'text-gray-500'} ${participante.modificado ? 'font-bold text-blue-600' : ''}`}>
                      {participante.solo_survivor ? "Sí 🦖" : "No"} {participante.modificado && "(Modificado)"}
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
        <strong>💡 Instrucciones:</strong> Marca o desmarca la casilla "Solo Survivor" en los participantes deseados. La fila se marcará en azul. Luego, presiona el botón <strong>"💾 Guardar Cambios de Modo"</strong> para aplicar las modificaciones a la base de datos.
      </div>
    </div>
  );
}