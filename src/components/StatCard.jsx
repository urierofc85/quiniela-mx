export default function StatCard({
  titulo,
  valor,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-gray-500">
        {titulo}
      </h3>

      <div className="text-3xl font-bold mt-2">
        {valor}
      </div>
    </div>
  );
}

<div className="grid md:grid-cols-3 gap-4">
  <StatCard
    titulo="Participantes"
    valor={participantes}
  />

  <StatCard
    titulo="Quinielas"
    valor={quinielas}
  />

  <StatCard
    titulo="Jornada"
    valor={jornada?.nombre}
  />
</div>

const { data } = await supabase
  .from("ranking_general")
  .select("*")
  .limit(10);

<table className="w-full mt-8">
  <thead>
    <tr>
      <th>#</th>
      <th>Jugador</th>
      <th>Puntos</th>
    </tr>
  </thead>

  <tbody>
    {ranking.map((item, index) => (
      <tr key={item.usuario_id}>
        <td>{index + 1}</td>
        <td>{item.nombre}</td>
        <td>{item.total_aciertos}</td>
      </tr>
    ))}
  </tbody>
</table>

const [data, setData] = useState([]);
``
