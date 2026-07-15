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
  const [data, setData] = useState([]);

  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] =
  useState("");

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
    
    const { data: jornadasData } =
      await supabase
        .from("jornadas")
        .select("*")
        .order("id", {
          ascending: false,
        });

    setJornadas(jornadasData || []);

    if (jornadasData?.length > 0) {
      setJornadaSeleccionada(
        jornadasData[0].id
      );
    }

    const { count: participantesCount } =
      await supabase
        .from("profiles")
        .select("*", {
          count: "exact",
          head: true,
        });

    setParticipantes(
      participantesCount || 0
    );

    if (jornadaData) {
      const {
        data: quinielasData,
      } = await supabase
        .from("quinielas")
        .select("usuario_id")
        .eq(
          "jornada_id",
          jornadaData.id
        );

      const usuariosUnicos = [
        ...new Set(
          quinielasData?.map(
            (q) => q.usuario_id
          ) || []
        ),
      ];

      setQuinielas(
        usuariosUnicos.length
      );
    }

    const {
      data: participacion,
    } = await supabase
      .from(
        "participacion_jornadas"
      )
      .select("*");

    setData(
      participacion || []
    );
  };

const exportarExcel = () => {

  const worksheet =
    XLSX.utils.json_to_sheet(
      data
    );

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

  const exportarPDF = async () => {

  const { default: jsPDF } =
    await import("jspdf");

  const { default: autoTable } =
    await import("jspdf-autotable");

  const {
    data: jornadaActiva,
  } = await supabase
    .from("jornadas")
    .select("*")
    .eq(
      "id",
      jornadaSeleccionada
    )
    .single();

  if (!jornadaActiva) {
    alert(
      "Selecciona una jornada válida"
    );
    return;
  }

  const {
    data: partidos,
  } = await supabase
    .from("partidos")
    .select(
      "id, local, visitante"
    )
    .order("id");

  const {
    data: quinielas,
  } = await supabase
    .from("quinielas")
    .select(
      "usuario, partido_id, pronostico"
    )
    .eq(
      "jornada_id",
      jornadaActiva.id
    );

  const usuarios = [
    ...new Set(
      quinielas?.map(
        (q) => q.usuario
      ) || []
    ),
  ];

  const columnas = [
    "Partido",
    ...usuarios,
  ];

  const filas = partidos.map(
    (partido) => {

      const fila = [
        `${partido.local} vs ${partido.visitante}`,
      ];

      usuarios.forEach(
        (usuario) => {

          const pronostico =
            quinielas.find(
              (q) =>
                Number(
                  q.partido_id
                ) ===
                  Number(
                    partido.id
                  ) &&
                q.usuario ===
                  usuario
            );

          fila.push(
            pronostico
              ? pronostico.pronostico
              : "-"
          );

        }
      );

      return fila;
    }
  );

  const doc =
    new jsPDF(
      "landscape"
    );

  doc.setFontSize(16);

  doc.text(
    `Quinielas - ${jornadaActiva.nombre}`,
    14,
    15
  );

  autoTable(doc, {
    head: [columnas],
    body: filas,
    startY: 25,
    styles: {
      fontSize: 8,
    },
    headStyles: {
      fillColor: [
        22, 163, 74,
      ],
    },
  });

  doc.save(
    `Quinielas_${jornadaActiva.nombre}.pdf`
  );

};

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-4">
        Dashboard Administrador
      </h1>

      <div className="flex flex-wrap gap-3 mb-6">


<select
  value={jornadaSeleccionada}
  onChange={(e) =>
    setJornadaSeleccionada(
      e.target.value
    )
  }
  className="border px-3 py-2 rounded"
>
  {jornadas.map((j) => (
    <option
      key={j.id}
      value={j.id}
    >
      {j.nombre}
    </option>
  ))}
</select>

<button
  onClick={exportarPDF}
  className="bg-red-600 text-white px-4 py-2 rounded"
>
  📄 Exportar PDF
</button>

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
          Participantes:{" "}
          {participantes}
        </p>

        <p>
          Quinielas Recibidas:{" "}
          {quinielas}
        </p>

        <button
          onClick={
            exportarExcel
          }
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

          <XAxis
            dataKey="jornada_id"
          />

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
