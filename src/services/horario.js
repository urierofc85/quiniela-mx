import { supabase } from "./supabase";

export const obtenerHoraMexico = async () => {
  const { data, error } = await supabase.rpc("obtener_hora_mexico");

  if (error) throw error;

  return new Date(data);
};