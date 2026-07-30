import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [listoParaCambiar, setListoParaCambiar] = useState(false);
  const [errorSesion, setErrorSesion] = useState("");

  useEffect(() => {
    console.log("==================================");
    console.log("RECOVERY DEBUG");
    console.log("URL:", window.location.href);
    console.log("HASH:", window.location.hash);
    console.log("SEARCH:", window.location.search);
    console.log("==================================");

    const verificarSesion = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        console.log("GET SESSION:");
        console.log(data);
        console.log(error);

        if (data?.session) {
          console.log("Sesión encontrada");
          setListoParaCambiar(true);
          return;
        }

        // Esperar unos segundos para que Supabase procese el enlace
        setTimeout(async () => {
          const { data: retryData, error: retryError } =
            await supabase.auth.getSession();

          console.log("RETRY SESSION:");
          console.log(retryData);
          console.log(retryError);

          if (retryData?.session) {
            console.log("Sesión encontrada en reintento");
            setListoParaCambiar(true);
          } else {
            setErrorSesion(
              "No fue posible validar el enlace de recuperación."
            );
          }
        }, 3000);
      } catch (err) {
        console.error(err);
        setErrorSesion("Ocurrió un error al validar el enlace.");
      }
    };

    verificarSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("AUTH EVENT:", event);
      console.log("AUTH SESSION:", session);

      if (event === "PASSWORD_RECOVERY") {
        console.log("PASSWORD_RECOVERY detectado");
        setListoParaCambiar(true);
      }

      if (session) {
        console.log("Sesión detectada");
        setListoParaCambiar(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const actualizarPassword = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setCargando(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setCargando(false);

    if (error) {
      console.error(error);
      alert("Error al actualizar contraseña: " + error.message);
      return;
    }

    alert(
      "Contraseña actualizada correctamente. Ahora puedes iniciar sesión."
    );

    window.location.href = "/login";
  };

  if (errorSesion && !listoParaCambiar) {
  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "450px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <h2 style={{ color: "#dc2626" }}>Enlace inválido</h2>

      <p>{errorSesion}</p>

      /forgot-password
    </div>
  );
}

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "450px",
        margin: "0 auto",
      }}
    >
      <h1>Nueva Contraseña</h1>

      {!listoParaCambiar ? (
        <p>Verificando enlace de recuperación...</p>
      ) : (
        <form onSubmit={actualizarPassword}>
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
            }}
          />

          <button
            type="submit"
            disabled={cargando}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {cargando ? "Guardando..." : "Guardar Contraseña"}
          </button>
        </form>
      )}
    </div>
  );
}