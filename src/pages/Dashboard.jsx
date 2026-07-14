import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [participantes, setParticipantes] =
    useState(0);

  const [jornadas, setJornadas] =
    useState(0);

  const [partidos, setPartidos] =
    useState(0);

  const [quinielas, setQuinielas] =
    useState(0);

  useEffect(() => {
    cargarDashboard();
  }, []);

  const cargarDashboard = async () => {

    const { count: participantesCount } =
      await supabase
        .from("profiles")
        .select("*", {
          count: "exact",
          head: true,
        });

    const { count: jornadasCount } =
      await supabase
        .from("jornadas")
        .select("*", {
          count: "exact",
          head: true,
        });

    const { count: partidosCount } =
      await supabase
        .from("partidos")
        .select("*", {
          count: "exact",
          head: true,
        });

    const { count: quinielasCount } =
      await supabase
        .from("quinielas")
        .select("*", {
          count: "exact",
          head: true,
        });

    setParticipantes(
      participantesCount || 0
    );

    setJornadas(
      jornadasCount || 0
    );

    setPartidos(
      partidosCount || 0
    );

    setQuinielas(
      quinielasCount || 0
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">

      <h1 className="text-3xl font-bold mb-6">
        📊 Dashboard Administrativo
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-blue-600 text-white p-6 rounded shadow">
          <h2 className="text-lg">
            👥 Participantes
          </h2>

          <p className="text-3xl font-bold mt-2">
            {participantes}
          </p>
        </div>

        <div className="bg-green-600 text-white p-6 rounded shadow">
          <h2 className="text-lg">
            📅 Jornadas
          </h2>

          <p className="text-3xl font-bold mt-2">
            {jornadas}
          </p>
        </div>

        <div className="bg-orange-600 text-white p-6 rounded shadow">
          <h2 className="text-lg">
            ⚽ Partidos
          </h2>

          <p className="text-3xl font-bold mt-2">
            {partidos}
          </p>
        </div>

        <div className="bg-purple-600 text-white p-6 rounded shadow">
          <h2 className="text-lg">
            ✅ Quinielas
          </h2>

          <p className="text-3xl font-bold mt-2">
            {quinielas}
          </p>
        </div>

      </div>

    </div>
  );
}
