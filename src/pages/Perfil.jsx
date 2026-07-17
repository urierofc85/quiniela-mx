import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { obtenerHoraMexico } from "../services/horario"

export default function Perfil() {

  const [nombreUsuario, setNombreUsuario] =
    useState("");

  const [nombreCompleto, setNombreCompleto] =
    useState("");

  const [telefono, setTelefono] =
    useState("");

  const [banco, setBanco] =
    useState("");

  const [clabe, setClabe] =
    useState("");

    useEffect(() => {
    cargarPerfil();
  }, []);

  const cargarPerfil = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    
const { data } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.id)
  .maybeSingle();

if (!data) {

  await supabase
    .from("profiles")
    .insert([
      {
        id: user.id,
        email: user.email,
        rol: "usuario",
      },
    ]);

  return;
}

      
    if (!data) return;

    setNombreUsuario(
      data.nombre_usuario || ""
    );

    setNombreCompleto(
      data.nombre_completo || ""
    );

    setTelefono(
      data.telefono || ""
    );

    setBanco(
      data.banco || ""
    );

    setClabe(
      data.clabe || ""
    );
  };

  
const guardarPerfil = async () => {

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!nombreUsuario.trim()) {
    alert(
      "El nombre de usuario es obligatorio"
    );
    return;
  }

  if (!nombreCompleto.trim()) {
    alert(
      "El nombre completo es obligatorio"
    );
    return;
  }

  if (
    telefono &&
    telefono.length !== 10
  ) {
    alert(
      "El teléfono debe tener 10 dígitos"
    );
    return;
  }

  if (
    clabe &&
    clabe.length !== 18
  ) {
    alert(
      "La CLABE debe tener 18 dígitos"
    );
    return;
  }

const {
  data: existente,
} = await supabase
  .from("profiles")
  .select("id")
  .eq("nombre_usuario", nombreUsuario)
  .neq("id", user.id);

if (existente.length > 0) {
  alert(
    "Ese nombre de usuario ya está siendo utilizado"
  );
  return;
}

  const { error } = await supabase
    .from("profiles")
    .update({
      nombre_usuario: nombreUsuario,
      nombre_completo: nombreCompleto,
      telefono,
      banco,
      clabe,
    })
    .eq("id", user.id);

  if (error) {
    alert(error.message);
    return;
  }

  alert("Perfil actualizado");
};
``
  
return (
  <div className="max-w-xl mx-auto p-6">
    <h1 className="text-3xl font-bold mb-6">
      Mi Perfil
    </h1>

    <div className="bg-gray-100 p-4 rounded mb-6">
      <h2 className="font-bold text-lg">
        Información Actual
      </h2>

      <p>
        <strong>Usuario:</strong>{" "}
        {nombreUsuario || "Sin capturar"}
      </p>

      <p>
        <strong>Nombre:</strong>{" "}
        {nombreCompleto || "Sin capturar"}
      </p>

      <p>
        <strong>Teléfono:</strong>{" "}
        {telefono || "Sin capturar"}
      </p>

      <p>
        <strong>Banco:</strong>{" "}
        {banco || "Sin capturar"}
      </p>

      <p>
        <strong>CLABE:</strong>{" "}
        {clabe || "Sin capturar"}
      </p>
    </div>

    <div className="space-y-4">

      <input
        type="text"
        placeholder="Nombre de usuario"
        value={nombreUsuario}
        onChange={(e) =>
          setNombreUsuario(e.target.value)
        }
        className="w-full border p-2 rounded"
      />

      <input
        type="text"
        placeholder="Nombre completo"
        value={nombreCompleto}
        onChange={(e) =>
          setNombreCompleto(e.target.value)
        }
        className="w-full border p-2 rounded"
      />

      <input
        type="text"
        placeholder="Teléfono"
        value={telefono}
        maxLength={10}
        onChange={(e) =>
          setTelefono(e.target.value)
        }
        className="w-full border p-2 rounded"
      />

      <input
        type="text"
        placeholder="Banco"
        value={banco}
        onChange={(e) =>
          setBanco(e.target.value)
        }
        className="w-full border p-2 rounded"
      />

      <input
        type="text"
        placeholder="CLABE"
        value={clabe}
        maxLength={18}
        onChange={(e) =>
          setClabe(e.target.value)
        }
        className="w-full border p-2 rounded"
      />

      <button
        onClick={guardarPerfil}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        Guardar Perfil
      </button>

    </div>
  </div>
);
}