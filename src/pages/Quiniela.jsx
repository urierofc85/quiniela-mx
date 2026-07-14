import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { Link } from "react-router-dom";

export default function Quiniela() {
  const [partidos, setPartidos] = useState([]);
  const [pronosticos, setPronosticos] = useState({});
  const [jornadaActiva, setJornadaActiva] = useState(null);
  const [jornadaCerrada, setJornadaCerrada] = useState(false);

  useEffect(() => {
    cargarPartidos();
    cargarJornadaActiva();
  }, []);

  const cargarPartidos = async () => {
    const { data } = await supabase
      .from("partidos")
      .select("*");

    setPartidos(data || []);
  };
 


const cargarJornadaActiva = async () => {
  const { data } = await supabase
    .from("jornadas")
    .select("*")
    .eq("activa", true)
    .single();

  setJornadaActiva(data);

  if (data?.fecha_limite) {
    const fechaLimite = new Date(
      data.fecha_limite
    );

    const ahora = new Date();

    setJornadaCerrada(
      ahora > fechaLimite
    );
  }
};

const actualizarPronostico = (
  partidoId,
  valor
) => {

  console.log("FUNCION EJECUTADA");
  console.log("PARTIDO:", partidoId);
  console.log("VALOR:", valor);


  const nuevo = {
    ...pronosticos,
    [partidoId]: valor,
  };

  console.log("NUEVO:", nuevo);

  setPronosticos(nuevo);
};


  const guardarQuiniela = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

const {
  data: jornadaActiva,
  error: jornadaError,
} = await supabase
  .from("jornadas")
  .select("*")
  .eq("activa", true)
  .single();

if (jornadaError || !jornadaActiva) {
  alert("No existe una jornada activa");
  return;
}

const fechaLimite = new Date(
  jornadaActiva.fecha_limite
);

const ahora = new Date();

if (ahora > fechaLimite) {
  alert(
    "La jornada ya fue cerrada"
  );
  return;
}


const { data: existente } = await supabase
  .from("quinielas")
  .select("id")
  .eq("usuario_id", user.id)
  .eq("jornada_id", jornadaActiva.id)
  .limit(1);

if (existente && existente.length > 0) {
  alert(
    "Ya enviaste tu quiniela para esta jornada"
  );
  return;
}

  console.log("PRONOSTICOS:", pronosticos);
  
const registros = Object.entries(pronosticos).map(
  ([partidoId, valor]) => ({
    usuario: user.email,
    usuario_id: user.id,
    partido_id: Number(partidoId),
    pronostico: valor,
    jornada_id: jornadaActiva.id,
    fecha_envio: new Date().toISOString(),
  })
);

console.log("REGISTROS:", registros);


  const { error } = await supabase
    .from("quinielas")
    .insert(registros);

  if (error) {
    alert(error.message);
    return;
  }

  alert("Quiniela guardada");
};

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">
        Captura tu Quiniela
      </h1>

      <div className="mb-6">
        <Link
          to="/posiciones"
          className="bg-orange-600 text-white px-4 py-2 rounded"
        >
          Ranking General
        </Link>
      </div>
      
      <Link
        to="/perfil"
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Mi Perfil
      </Link>

{jornadaActiva && (
  <p className="mb-4 text-red-600 font-semibold">
    ⏰ Fecha límite:
    {" "}
    {new Date(
      jornadaActiva.fecha_limite
    ).toLocaleString("es-MX")}
  </p>
)}


      {partidos.map((partido) => (
        <div
          key={partido.id}
          className="border rounded p-4 mb-3"
        >
          <h3 className="font-semibold">
            {partido.local} vs{" "}
            {partido.visitante}
          </h3>

          <div className="flex gap-4 mt-3">
            <label>
              <input
                type="radio"
                name={`partido-${partido.id}`}
                onChange={() =>
                  actualizarPronostico(
                    partido.id,
                    "L"
                  )
                }
              />
              Local
            </label>

            <label>
              <input
                type="radio"
                name={`partido-${partido.id}`}
                onChange={() =>
                  actualizarPronostico(
                    partido.id,
                    "E"
                  )
                }
              />
              Empate
            </label>

            <label>
              <input
                type="radio"
                name={`partido-${partido.id}`}
                onChange={() =>
                  actualizarPronostico(
                    partido.id,
                    "V"
                  )
                }
              />
              Visitante
            </label>
          </div>
        </div>
      ))}

    
      {jornadaCerrada && (
        <p className="text-red-600 font-bold mt-4">
          🔒 La jornada ya fue cerrada
        </p>
      )}

      <button
        disabled={jornadaCerrada}
        onClick={guardarQuiniela}
        className={`px-5 py-2 rounded mt-6 text-white ${
          jornadaCerrada
            ? "bg-gray-400"
            : "bg-green-600"
        }`}
      >
        Guardar Quiniela
      </button>
      
</div>
);
}
