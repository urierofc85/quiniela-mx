import { supabase } from "./supabase";

export const obtenerHoraMexico = async () => {
  const { data, error } = await supabase.rpc("obtener_hora_mexico");

  if (error) {
    console.error("Error al obtener hora de México:", error);
    return null;
  }

  return data; 
};
