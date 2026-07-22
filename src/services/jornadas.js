import { supabase } from "./supabase";

export const verificarJornadas = async () => {
  const { error } = await supabase.rpc("cerrar_jornadas_vencidas");

  if (error) {
    console.error("Error al verificar jornadas:", error);
  } else {
    console.log("Jornadas verificadas y cerradas si estaban vencidas.");
  }
};
