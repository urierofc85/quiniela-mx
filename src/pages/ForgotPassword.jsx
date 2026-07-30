import { useState } from "react";
import { supabase } from "../services/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [cargando, setCargando] = useState(false);

  const recuperarPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      alert("Por favor ingresa tu correo.");
      return;
    }

    setCargando(true);

    // Usa window.location.origin para detectar automáticamente el dominio actual
    const redirectUrl = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    setCargando(false);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    alert("Revisa tu correo para restablecer tu contraseña.");
    setEmail("");
  };

  return (
    <div style={{ padding: "20px", maxWidth: "400px", margin: "0 auto" }}>
      <h1>Recuperar Contraseña</h1>

      <form onSubmit={recuperarPassword}>
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />

        <button type="submit" disabled={cargando} style={{ padding: "10px 15px" }}>
          {cargando ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>
    </div>
  );
}