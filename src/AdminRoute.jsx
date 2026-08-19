import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./services/supabase"; // Ajusta esta ruta si tu carpeta services está en otro lugar

export default function AdminRoute({ children }) {
  const navigate = useNavigate();
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const verificarAccesoAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/", { replace: true });
        return;
      }

      const { data: perfil, error } = await supabase
        .from("profiles")
        .select("rol")
        .eq("id", user.id)
        .single();

      const esAdmin = perfil?.rol?.toLowerCase() === "admin";

      if (!esAdmin || error) {
        console.warn("⛔ Intento de acceso no autorizado. Cerrando sesión.");
        await supabase.auth.signOut();
        navigate("/", { replace: true });
        return;
      }

      setVerificando(false);
    };

    verificarAccesoAdmin();
  }, [navigate]);

  if (verificando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <p className="text-gray-700 font-semibold">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  return children;
}