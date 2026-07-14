import { useState } from "react";
import { supabase } from "../services/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");

  const actualizarPassword = async () => {
    const { error } =
      await supabase.auth.updateUser({
        password,
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Contraseña actualizada");
  };

  return (
    <div>
      <h1>Nueva Contraseña</h1>

      <input
        type="password"
        placeholder="Nueva contraseña"
        value={password}
        onChange={(e) =>
          setPassword(e.target.value)
        }
      />

      <button onClick={actualizarPassword}>
        Guardar
      </button>
    </div>
  );
}
