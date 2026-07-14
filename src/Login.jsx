
import { useState } from "react";
import { supabase } from "./services/supabase";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: perfil, error: perfilError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    console.log("USER:", user.id);
    console.log("PERFIL:", perfil);
    console.log("ERROR:", perfilError);

    if (perfil?.rol === "admin") {
      navigate("/admin/dashboard");
    } else {
      navigate("/quiniela");
    }
  };

 
const registrar = async () => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    alert(error.message);
    return;
  }

  if (data.user) {
    const { error: perfilError } = await supabase
      .from("profiles")
      .insert([
        {
          id: data.user.id,
          rol: "usuario",
        },
      ]);

    if (perfilError) {
      console.log(perfilError);
    }
  }

  alert("Usuario registrado correctamente");
};
 return (
  <div className="max-w-md mx-auto p-8">
    <div className="flex flex-col gap-4">
      <input
        className="border p-2"
        placeholder="Correo"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        className="border p-2"
        type="password"
        placeholder="Contraseña"
        onChange={(e) => setPassword(e.target.value)}
      />

      
  <button
    className="bg-blue-600 text-white p-2 rounded"
    onClick={login}
    style={{ display: "block", width: "100%", marginBottom: "12px" }}
  >
    Entrar
  </button>

  <button
    className="bg-green-600 text-white p-2 rounded"
    onClick={registrar}
    style={{ display: "block", width: "100%" }}
  >
    Registrarse
  </button>
</div>

    <div className="mt-6 text-center">
      <Link
        to="/forgot-password"
        className="text-blue-700 underline"
      >
        ¿Olvidaste tu contraseña?
      </Link>
    </div>
  </div>
);
}