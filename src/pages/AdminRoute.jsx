import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

export default function AdminRoute({ children }) {
  const navigate = useNavigate();
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const verificarAccesoAdmin = async () => {
      // 1. Obtener el usuario actual de la sesión
      const { data: { user } } = await supabase.auth.getUser();
      
      // Si no hay usuario, mandar al login inmediatamente
      if (!user) {
        navigate("/", { replace: true });
        return;
      }

      // 2. Consultar su rol REAL en la base de datos (fuente de la verdad)
      const { data: perfil, error } = await supabase
        .from("profiles")
        .select("rol")
        .eq("id", user.id)
        .single();

      // 3. Validar el rol (ajusta "admin" si en tu base de datos está en mayúsculas "ADMIN")
      const esAdmin = perfil?.rol?.toLowerCase() === "admin";

      if (!esAdmin || error) {
        // ⚠️ ACCIÓN DE SEGURIDAD: Cerrar sesión y expulsar
        console.warn("Intento de acceso no autorizado a zona admin. Cerrando sesión.");
        await supabase.auth.signOut();
        navigate("/", { replace: true }); // replace: true evita que pueda dar "Atrás" en el navegador
        return;
      }

      // Si es admin, permitir el renderizado del componente
      setVerificando(false);
    };

    verificarAccesoAdmin();
  }, [navigate]);

  // Mostrar un spinner o texto mientras verifica en la base de datos
  if (verificando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <p className="text-gray-700 font-semibold">Verificando permisos de administrador...</p>
        </div>
      </div>
    );
  }

  // Si pasó la validación, mostrar la página protegida
  return children;
}