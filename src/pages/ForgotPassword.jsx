import { useState } from "react";
import { supabase } from "../services/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");

  const recuperarPassword = async () => {
    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            "https://supreme-space-halibut-vppggqx64x54fpppj-5173.app.github.dev/reset-password",
        }
      );

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      "Revisa tu correo para restablecer tu contraseña"
    );
  };

  return (
    <div>
      <h1>Recuperar Contraseña</h1>

      <input
        type="email"
        placeholder="Correo"
        value={email}
        onChange={(e) =>
          setEmail(e.target.value)
        }
      />

      <button onClick={recuperarPassword}>
        Enviar enlace
      </button>
    </div>
  );
}
