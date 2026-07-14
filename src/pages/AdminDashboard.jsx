import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function AdminDashboard() {
  const [jornada, setJornada] = useState(null);
  const [participantes, setParticipantes] = useState(0);
  const [quinielas, setQuinielas] = useState(0);
  const [ranking, setRanking] = useState([]);
  const [data, setData] = useState([]);

  useEffect(() => {
    cargarDashboard();
  }, []);

  const cargarDashboard = async () => {
    const { data: jornadaData } = await supabase
      .from("jornadas")
      .select("*")
      .eq("activa", true)
      .single();

    setJornada(jornadaData);

    const { count: participantesCount } = await supabase
      .from("profiles")
      .select("*", {
        count: "exact",
        head: true,
      });

    setParticipantes(participantesCount || 0);

    if (jornadaData) {
      const { count: quinielasCount } = await supabase
        .from("quinielas")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("jornada_id", jornadaData.id);

      setQuinielas(quinielasCount || 0);
    }

    const { data: participacion } = await supabase
      .from("participacion_jornadas")
      .select("*");

    setData(participacion || []);
  };

  const exportarExcel = () => {
    const worksheet =
      XLSX.utils.json_to_sheet(data);

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Participacion"
    );

    XLSX.writeFile(
      workbook,
      "participacion_jornadas.xlsx"
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">
        Dashboard Administrador
      </h1>
<div className="flex flex-wrap gap-3 mb-6">

<Link
    to="/admin"
    className="bg-blue-600 text-white px-4 py-2 rounded"
  >
    🚨 Crear Jornada
  </Link>

<Link
    to="/partidos"
    className="bg-green-600 text-white px-4 py-2 rounded"
  >
    Crear Partidos
  </Link>

  <Link
    to="/admin/resultados"
    className="bg-orange-600 text-white px-4 py-2 rounded"
  >
    Capturar Resultados
  </Link>

  <Link
    to="/posiciones"
    className="bg-purple-600 text-white px-4 py-2 rounded"
  >
    Ranking
  </Link>

</div>

      <div>
        <p>
          Jornada Activa:{" "}
          {jornada
            ? jornada.nombre
            : "Sin jornada activa"}
        </p>

        <p>
          Participantes: {participantes}
        </p>

        <p>
          Quinielas Capturadas: {quinielas}
        </p>

        <button
          onClick={exportarExcel}
          className="bg-green-600 text-white px-4 py-2 rounded mt-4"
        >
          Exportar Excel
        </button>

        <h2 className="text-xl font-bold mt-8 mb-4">
          Participación por Jornada
        </h2>

        <BarChart
          width={700}
          height={300}
          data={data}
        >
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="jornada_id" />

          <YAxis />

          <Tooltip />

          <Bar
            dataKey="total"
            fill="#16a34a"
          />
        </BarChart>
      </div>
    </div>
  );
}



