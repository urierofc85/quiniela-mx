import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";
import { obtenerHoraMexico } from "../services/horario";
import { verificarJornadas } from "../services/jornadas";

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
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");
  const [horaMexico, setHoraMexico] = useState(null);

  // 🕒 Reloj en vivo: actualiza cada segundo
  useEffect(() => {
    const actualizarHora = async () => {
      const hora = await obtenerHoraMexico();
      setHoraMexico(hora);
    };

    actualizarHora(); // primera carga
    const intervalo = setInterval(actualizarHora, 1000); // cada segundo

    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    const init = async () => {
      await verificarJornadas();
      await cargarDashboard();
    };
    init();
  }, []);

  const cargarDashboard = async () => {
    const { data: jornadaData } = await supabase
      .from("jornadas")
      .select("*")
      .eq("activa", true)
      .maybeSingle();

    setJornada(jornadaData);

    const { data: jornadasData } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", { ascending: false });

    setJornadas(jornadasData || []);

    if (jornadasData?.length > 0) {
      setJornadaSeleccionada(jornadasData[0].id);
    }

    const { count: participantesCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    setParticipantes(participantesCount || 0);

    if (jornadaData) {
      const { data: quinielasData } = await supabase
        .from("quinielas")
        .select("usuario_id")
        .eq("jornada_id", jornadaData.id);

      const usuariosUnicos = [
        ...new Set(quinielasData?.map((q) => q.usuario_id) || []),
      ];

      setQuinielas(usuariosUnicos.length);
    }

    const { data: participacion } = await supabase
      .from("participacion_jornadas")
      .select("*");

    setData(participacion || []);
  };
  const exportarExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Participacion");
    XLSX.writeFile(workbook, "participacion_jornadas.xlsx");
  };

  const exportarPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const { data: jornadaActiva } = await supabase
      .from("jornadas")
      .select("*")
      .eq("id", jornadaSeleccionada)
      .single();

    if (!jornadaActiva) {
      alert("Selecciona una jornada válida");
      return;
    }

    const { data: partidos } = await supabase
      .from("partidos")
      .select("id, local, visitante")
      .order("id");

    const { data: quinielas } = await supabase
      .from("quinielas")
      .select("usuario_id, usuario, partido_id, pronostico")
      .eq("jornada_id", jornadaActiva.id);

    const { data: perfiles } = await supabase.from("profiles").select(`
      id,
      nombre,
      nombre_usuario,
      nombre_completo,
      email
    `);

    const usuarios = [...new Set(quinielas?.map((q) => q.usuario_id) || [])];

    const columnas = [
      "Partido",
      ...usuarios.map((usuarioId) => {
        const perfil = perfiles?.find((p) => p.id === usuarioId);
        return (
          perfil?.nombre_usuario ||
          perfil?.nombre_completo ||
          perfil?.nombre ||
          usuarioId
        );
      }),
    ];

    const filas = partidos.map((partido) => {
      const fila = [`${partido.local} vs ${partido.visitante}`];
      usuarios.forEach((usuarioId) => {
        const pronostico = quinielas.find(
          (q) =>
            Number(q.partido_id) === Number(partido.id) &&
            q.usuario_id === usuarioId
        );
        fila.push(pronostico ? pronostico.pronostico : "-");
      });
      return fila;
    });

    const doc = new jsPDF("landscape");
    doc.setFontSize(16);
    doc.text(`Quinielas - ${jornadaActiva.nombre}`, 14, 15);

    autoTable(doc, {
      head: [columnas],
      body: filas,
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 163, 74] },
    });

    doc.save(`Quinielas_${jornadaActiva.nombre}.pdf`);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Dashboard Administrador</h1>

      {/* 🕒 Zona de reloj */}
      <div className="bg-gray-100 p-4 rounded mb-6 shadow">
        <h2 className="text-xl font-semibold mb-2">Hora actual en México</h2>
        <p className="text-3xl font-mono text-green-700">
          {horaMexico
            ? new Date(horaMexico).toLocaleTimeString("es-MX", {
                timeZone: "America/Mexico_City",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "Cargando..."}
        </p>
      </div>

      {/* resto del dashboard: selects, botones, gráficas */}
      {/* ... */}
    </div>
  );
}
