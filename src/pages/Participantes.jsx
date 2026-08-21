import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function Participantes() {
  const [participantes, setParticipantes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [totalEnBD, setTotalEnBD] = useState(null); // Nuevo: para mostrar el total real

  useEffect(() => {
    cargarParticipantes();
  }, []);

  const cargarParticipantes = async () => {
    console.log("🔄 Cargando participantes...");
    
    // Consulta con count exacto para saber cuántos hay realmente
    const { data, error, count } = await supabase
      .from("profiles")
      .select("id, nombre_usuario, nombre_completo, email, telefono, banco, clabe, rol, solo_survivor", { count: "exact" })
      .order("nombre_usuario", { ascending: true });

    if (error) {
      console.error("❌ Error:", error);
      alert("Error al cargar: " + error.message);
      return;
    }

    console.log(" Total según Supabase (count):", count);
    console.log("📋 Registros recibidos:", data?.length);
    
    setTotalEnBD(count); // Guardamos el total real

    const datosLimpios = (data || []).map(p => ({
      ...p,
      solo_survivor: p.solo_survivor === true,
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

  const toggleSoloSurvivor = (userId) => {
    setParticipantes(prev => 
      prev.map(p => p.id === userId ? { ...p, solo_survivor: !p.solo_survivor, modificado: true } : p)
    );
  };

  const guardarModosDeJuego = async () => {
    const usuariosAModificar = participantes.filter(p => p.modificado);
    if (usuariosAModificar.length === 0) {
      alert("No hay cambios pendientes.");
      return;
    }
    if (!window.confirm(`¿Guardar cambios para ${usuariosAModificar.length} usuario(s)?`)) return;

    setCargando(true);
    let exitos = 0, fallos = 0, ultimoError = "";

    for (const usuario of usuariosAModificar) {
      const { data, error } = await supabase
        .from("profiles")
        .update({ solo_survivor: usuario.solo_survivor })
        .eq("id", usuario.id)
        .select();

      if (error) {
        console.error("❌ Error:", usuario.nombre_usuario, error);
        ultimoError = error.message;
        fallos++;
      } else if (!data || data.length === 0) {
        console.warn("️ RLS bloqueó:", usuario.nombre_usuario);
        ultimoError = "Permisos RLS insuficientes";
        fallos++;
      } else {
        exitos++;
      }
    }

    setCargando(false);
    if (fallos === 0) {
      alert(`✅ ${exitos} cambio(s) guardado(s).`);
      setParticipantes(prev => prev.map(p => ({ ...p, modificado: false })));
    } else {
      alert(`⚠️ ${exitos} éxitos, ${fallos} fallos.\nError: ${ultimoError}`);
      await cargarParticipantes();
    }
  };

  const eliminarUsuarios = async () => {
    if (seleccionados.length === 0) {
      alert("Selecciona al menos un usuario");
      return;
    }
    if (!window.confirm(`¿Eliminar ${seleccionados.length} usuario(s)?`)) return;

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
        if (!response.ok) {
          alert(resultado.error || "Error eliminando usuario");
          setCargando(false);
          return;
        }
      } catch (error) {
        console.error(error);
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

    alert("Usuarios eliminados");
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

      {/* NUEVO: Aviso si hay diferencia entre BD y lo que se muestra */}
      {totalEnBD !== null && totalEnBD !== participantes.length && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded">
          <p className="text-yellow-800 font-semibold">
            ⚠️ Hay {totalEnBD} usuarios en la base de datos, pero solo se muestran {participantes.length}.
          </p>
          <p className="text-yellow-700 text-sm mt-1">
            Posibles causas: (1) Usuarios en auth.users sin perfil en profiles, o (2) Políticas RLS filtrando registros.
            Revisa la consola (F12) y ejecuta el SQL de sincronización en Supabase.
          </p>
        </div>
      )}

      <input
        type="text"
        placeholder="Buscar participante..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="border p-2 rounded w-full mb-4"
      />

      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          Mostrando: <strong>{participantesFiltrados.length}</strong>
          {totalEnBD !== null && (
            <span className="text-sm text-gray-500 ml-2">(Total en BD: {totalEnBD})</span>
          )}
          {hayCambiosPendientes && (
            <span className="ml-3 text-sm text-blue-600 font-semibold animate-pulse">
              ✅ Hay cambios sin guardar
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={cargarParticipantes}
            className="px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white font-semibold transition"
          >
            🔄 Recargar
          </button>
          <button
            onClick={guardarModosDeJuego}
            disabled={cargando || !hayCambiosPendientes}
            className={`px-4 py-2 rounded transition font-semibold ${
              hayCambiosPendientes && !cargando
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-400 text-gray-200 cursor-not-allowed"
            }`}
          >
            {cargando ? " Guardando..." : "💾 Guardar Cambios de Modo"}
          </button>
          <button
            onClick={eliminarUsuarios}
            disabled={cargando || seleccionados.length === 0}
            className={`px-4 py-2 rounded transition ${
              seleccionados.length > 0 && !cargando
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-400 text-gray-200 cursor-not-allowed"
            }`}
          >
            {cargando ? " Procesando..." : "🗑️ Eliminar Seleccionados"}
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
                className={`border-t hover:bg-gray-50 transition ${participante.modificado ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
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
                      {participante.solo_survivor ? "Sí 🦖" : "No"} {participante.modificado && "✏️ (Modificado)"}
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
                  <span className={participante.rol === "admin" ? "text-red-600 font-bold" : "text-blue-600"}>
                    {participante.rol}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}