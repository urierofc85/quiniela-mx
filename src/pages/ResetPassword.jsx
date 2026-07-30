import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [listoParaCambiar, setListoParaCambiar] = useState(false);
  const [errorSesion, setErrorSesion] = useState("");

  useEffect(() => {
    // 1. Escuchar el evento de autenticación cuando Supabase procesa el enlace del correo
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // El evento 'PASSWORD_RECOVERY' se dispara cuando entra por el link de restablecimiento
        if (event === "PASSWORD_RECOVERY" || session) {
          setListoParaCambiar(true);
        }
      }
    );

    // 2. Verificar si ya existe una sesión temporal cargada
    const comprobarSesion = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setListoParaCambiar(true);
      } else {
        // Dar un pequeño margen para que el SDK procese los parámetros de la URL
        setTimeout(async () => {
          const { data: retryData } = await supabase.auth.getSession();
          if (retryData?.session) {
            setListoParaCambiar(true);
          } else {
            setErrorSesion(
              "El enlace de recuperación es inválido o ha expirado. Por favor solicita uno nuevo."
            );
          }
        }, 1500);
      }
    };

    comprobarSesion();

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const actualizarPassword = async (e) => {
    e?.preventDefault();

    if (!password || password.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setCargando(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    setCargando(false);

    if (error) {
      alert("Error al actualizar: " + error.message);
      return;
    }

    alert("¡Contraseña actualizada con éxito! Ahora puedes iniciar sesión.");
    
    // Redireccionar al login si usas react-router-dom o window.location
    window.location.href = "/login";
  };

  if (errorSesion && !listoParaCambiar) {
    return (
      <div style={{ padding: "24px", maxWidth: "400px", margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ color: "#ef4444" }}>Enlace no válido</h2>
        <p style={{ color: "#4b5563" }}>{errorSesion}</p>
        <a href="/forgot-password" style={{ color: "#2563eb", textDecoration: "underline" }}>
          Volver a solicitar correo
        </a>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "400px", margin: "0 auto" }}>
      <h1>Nueva Contraseña</h1>

      {!listoParaCambiar ? (
        <p style={{ color: "#6b7280" }}>Verificando enlace de recuperación...</p>
      ) : (
        <form onSubmit={actualizarPassword}>
          <div style={{ marginBottom: "16px" }}>
            <input
              type="password"
              placeholder="Escribe tu nueva contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                boxSizing: "border-box"
              }}
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: cargando ? "#9ca3af" : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              cursor: cargando ? "not-allowed" : "pointer",
              fontWeight: "bold"
            }}
          >
            {cargando ? "Guardando..." : "Guardar Contraseña"}
          </button>
        </form>
      )}
    </div>
  );
}