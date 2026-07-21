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
  <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#07145e] via-[#0b2b86] to-[#19e4d3]">

    {/* Decoraciones */}
    <div className="absolute top-0 left-0 w-80 h-80 border-4 border-cyan-300/20 rounded-full -translate-x-24 -translate-y-24" />

    <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl" />

    <div className="absolute top-16 left-12 text-[100px] opacity-20">
      ⚽
    </div>

    <div className="absolute bottom-16 right-12 text-[120px] opacity-20">
      ⚽
    </div>

    <div className="flex flex-col items-center justify-center min-h-screen px-4">

      {/* Logo + Título */}
     
<div className="text-center mb-10">

  /ligamx.png

  <h1 className="text-white font-black text-6xl md:text-8xl tracking-tight">
    Rinchiquiniela
  </h1>

  <p className="text-cyan-100 text-xl mt-3">
    Liga MX Prediction Game
  </p>

</div>

      {/* CARD LOGIN */}
      <div
        className="
          w-full
          max-w-md
          bg-white/10
          backdrop-blur-lg
          border
          border-white/20
          rounded-3xl
          shadow-2xl
          p-8
        "
      >
        <h2 className="text-center text-white text-3xl font-bold mb-6">
          Iniciar Sesión
        </h2>

        <div className="space-y-4">

          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="
              w-full
              p-4
              rounded-xl
              bg-white
              focus:outline-none
              focus:ring-4
              focus:ring-cyan-400
            "
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="
              w-full
              p-4
              rounded-xl
              bg-white
              focus:outline-none
              focus:ring-4
              focus:ring-cyan-400
            "
          />

          <button
            onClick={login}
            className="
              w-full
              py-4
              rounded-xl
              bg-yellow-400
              text-blue-950
              font-bold
              text-lg
              hover:bg-yellow-300
              transition
            "
          >
            Entrar
          </button>

          <button
            onClick={registrar}
            className="
              w-full
              py-4
              rounded-xl
              bg-emerald-500
              text-white
              font-bold
              text-lg
              hover:bg-emerald-600
              transition
            "
          >
            Registrarse
          </button>

        </div>

        <div className="text-center mt-6">
          <Link
            to="/forgot-password"
            className="text-cyan-100 hover:text-white underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>

    </div>

  </div>
);
};