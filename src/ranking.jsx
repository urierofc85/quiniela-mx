const { data } = await supabase
  .from("ranking_general")
  .select("*");