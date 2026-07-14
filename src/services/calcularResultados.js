const { data: partidos } =
  await supabase
  .from("partidos")
  .select("*")
  .eq("jornada_id", jornadaId);
``
const { data: quinielas } =
  await supabase
  .from("quinielas")
  .select("*")
  .eq("jornada_id", jornadaId);
  
const { data: partidos } = await supabase
  .from("partidos")
  .select("*")
  .eq("jornada_id", jornadaId);

const { data: quinielas } = await supabase
  .from("quinielas")
  .select("*")
  .eq("jornada_id", jornadaId);

for (const quiniela of quinielas) {
  let aciertos = 0;

  const { data: pronosticos } = await supabase
    .from("pronosticos")
    .select("*")
    .eq("quiniela_id", quiniela.id);

  for (const pronostico of pronosticos) {
    const partido = partidos.find(
      (p) => p.id === pronostico.partido_id
    );

    if (
      partido &&
      pronostico.resultado === partido.resultado
    ) {
      aciertos++;
    }
  }

  await supabase
    .from("puntajes")
    .upsert({
      usuario_id: quiniela.usuario_id,
      jornada_id: jornadaId,
      aciertos,
    });
}
