import { supabase } from "./supabase";

export const obtenerUsuario = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user || null;
};
