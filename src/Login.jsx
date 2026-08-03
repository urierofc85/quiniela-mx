import { useEffect, useState } from "react";
import { supabase } from "./services/supabase";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {

  const navigate = useNavigate();

  // LOGIN
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // REGISTRO
  const [mostrarRegistro, setMostrarRegistro] =
    useState(false);

  const [registroUsuario, setRegistroUsuario] =
    useState("");

  const [registroEmail, setRegistroEmail] =
    useState("");

  const [registroPassword, setRegistroPassword] =
    useState("");

  useEffect(() => {
    verificarSesionOAuth();
  }, []);

  const verificarSesionOAuth = async () => {

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return;
    }

    const user = session.user;

    let { data: perfil } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    // Usuario nuevo Google
    if (!perfil) {

      const nombreGoogle =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Usuario";

      const nombreUsuarioGoogle =
        nombreGoogle.replace(/\s+/g, "");

      const { error } = await supabase
        .from("profiles")
        .insert([
          {
            id: user.id,
            email: user.email,
            rol: "usuario",
            activo: true,
            nombre_usuario:
              nombreUsuarioGoogle,
          },
        ]);

      if (error) {
        console.error(error);
        alert(error.message);
        return;
      }

      const {
        data: nuevoPerfil,
      } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      perfil = nuevoPerfil;
    }

    if (perfil.activo === false) {

      await supabase.auth.signOut();

      alert(
        "Tu cuenta se encuentra desactivada."
      );

      return;
    }

    if (perfil.rol === "admin") {
      navigate("/admin/dashboard");
    } else {
      navigate("/quiniela");
    }
  };

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

    if (perfil.activo === false) {

      await supabase.auth.signOut();

      alert(
        "Tu cuenta se encuentra desactivada."
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

    if (
      !registroUsuario.trim() ||
      !registroEmail.trim() ||
      !registroPassword.trim()
    ) {
      alert(
        "Debes capturar usuario, correo y contraseña"
      );
      return;
    }

    if (registroPassword.length < 6) {
      alert(
        "La contraseña debe tener al menos 6 caracteres"
      );
      return;
    }

    const { data: existente } =
      await supabase
        .from("profiles")
        .select("id")
        .eq(
          "nombre_usuario",
          registroUsuario.trim()
        );

    if (existente?.length > 0) {

      alert(
        "Ese nombre de usuario ya está registrado"
      );

      return;
    }

    const {
      data,
      error,
    } = await supabase.auth.signUp({
      email: registroEmail.trim(),
      password: registroPassword,
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (!data.user) {
      alert(
        "No fue posible crear el usuario"
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
          email: registroEmail.trim(),
          rol: "usuario",
          activo: true,
          nombre_usuario:
            registroUsuario.trim(),
        },
      ]);

    if (perfilError) {
      alert(perfilError.message);
      return;
    }

    alert(
      "Usuario registrado correctamente"
    );

    setMostrarRegistro(false);

    setRegistroUsuario("");
    setRegistroEmail("");
    setRegistroPassword("");
  };

  const loginGoogle = async () => {

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            `${window.location.origin}/login`,
        },
      });

    if (error) {
      alert(error.message);
    }
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

        {/* Logo */}
        <div className="text-center mb-10">

          /ligamx.png

          <h1 className="text-white font-black text-6xl md:text-8xl tracking-tight">
            Rinchiquiniela
          </h1>

          <p className="text-cyan-100 text-xl mt-3">
            Liga MX Prediction Game
          </p>

        </div>

        {/* Card Login */}
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
              onChange={(e) =>
                setEmail(e.target.value)
              }
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
              onChange={(e) =>
                setPassword(e.target.value)
              }
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
              onClick={() =>
                setMostrarRegistro(true)
              }
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

            <button
              onClick={loginGoogle}
              className="
                w-full
                py-4
                rounded-xl
                bg-white
                text-gray-800
                font-bold
                text-lg
                border
                border-gray-300
                hover:bg-gray-100
                transition
              "
            >
              Continuar con Google
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
                {mostrarRegistro && (
          <div
            className="
              fixed
              inset-0
              bg-black/70
              flex
              items-center
              justify-center
              z-50
              p-4
            "
          >
            <div
              className="
                bg-white
                w-full
                max-w-md
                rounded-3xl
                p-8
                shadow-2xl
              "
            >
              <h2 className="text-3xl font-bold text-center mb-6">
                Crear Cuenta
              </h2>

              <div className="space-y-4">

                <input
                  type="text"
                  placeholder="Nombre de usuario"
                  value={registroUsuario}
                  onChange={(e) =>
                    setRegistroUsuario(
                      e.target.value
                    )
                  }
                  className="
                    w-full
                    border
                    p-3
                    rounded-xl
                    focus:outline-none
                    focus:ring-2
                    focus:ring-green-500
                  "
                />

                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={registroEmail}
                  onChange={(e) =>
                    setRegistroEmail(
                      e.target.value
                    )
                  }
                  className="
                    w-full
                    border
                    p-3
                    rounded-xl
                    focus:outline-none
                    focus:ring-2
                    focus:ring-green-500
                  "
                />

                <input
                  type="password"
                  placeholder="Contraseña"
                  value={registroPassword}
                  onChange={(e) =>
                    setRegistroPassword(
                      e.target.value
                    )
                  }
                  className="
                    w-full
                    border
                    p-3
                    rounded-xl
                    focus:outline-none
                    focus:ring-2
                    focus:ring-green-500
                  "
                />

                <button
                  onClick={registrar}
                  className="
                    w-full
                    py-3
                    rounded-xl
                    bg-green-600
                    text-white
                    font-bold
                    hover:bg-green-700
                    transition
                  "
                >
                  Crear Cuenta
                </button>

                <button
                  onClick={() =>
                    setMostrarRegistro(false)
                  }
                  className="
                    w-full
                    py-3
                    rounded-xl
                    bg-gray-300
                    text-gray-800
                    font-bold
                    hover:bg-gray-400
                    transition
                  "
                >
                  Cancelar
                </button>

              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}