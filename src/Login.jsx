import { useState } from "react";
import { supabase } from "./services/supabase";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const login = async () => {
    if (!email.trim() || !password.trim()) {
      alert(
        "Debes capturar correo y contraseña"
      );
      return;
    }

    const { error } =
      await supabase.auth.signInWithPassword({
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

    if (!user) {
      alert(
        "No fue posible obtener la información del usuario."
      );
      return;
    }

    const {
      data: perfil,
      error: perfilError,
    } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (perfilError || !perfil) {
      await supabase.auth.signOut();

      alert(
        "Tu cuenta fue eliminada por el administrador."
      );

      return;
    }

    if (perfil.rol === "admin") {
      navigate("/admin/dashboard");
    } else {
      navigate("/quiniela");
    }
  };

  const registrar = async () => {
    const emailValido =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      alert(
        "Debes capturar un correo electrónico"
      );
      return;
    }

    if (!emailValido.test(email)) {
      alert(
        "Debes capturar un correo válido"
      );
      return;
    }

    if (!password.trim()) {
      alert(
        "Debes capturar una contraseña"
      );
      return;
    }

    if (password.length < 6) {
      alert(
        "La contraseña debe tener al menos 6 caracteres"
      );
      return;
    }

    const {
      data,
      error,
    } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (!data.user) {
      alert(
        "No fue posible crear el usuario."
      );
      return;
    }

    const {
      error: perfilError,
    } = await supabase
      .from("profiles")
      .insert([
        {
          id: data.user.id,
          email: email,
          rol: "usuario",
        },
      ]);

    if (perfilError) {
      alert(perfilError.message);
      return;
    }

    alert(
      "Usuario registrado correctamente"
    );
  };

  return (
    <div className="max-w-md mx-auto p-8">
      <div className="flex flex-col gap-4">

        <input
          className="border p-2"
          placeholder="Correo"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
        />

        <input
          className="border p-2"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
        />

        <button
          className="bg-blue-600 text-white p-2 rounded"
          onClick={login}
        >
          Entrar
        </button>

        <button
          className="bg-green-600 text-white p-2 rounded"
          onClick={registrar}
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