import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { obtenerHoraMexico } from "../services/horario";
import html2canvas from "html2canvas";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [jornadaActiva, setJornadaActiva] = useState(null);
  const [participantes, setParticipantes] = useState(0);
  const [quinielasActivas, setQuinielasActivas] = useState(0);
  
  const [jornadas, setJornadas] = useState([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");

  const [datosGrafica, setDatosGrafica] = useState([]);
  const [ausentesQuiniela, setAusentesQuiniela] = useState([]);
  const [ausentesSurvivor, setAusentesSurvivor] = useState([]);

  const [rankingQuinielas, setRankingQuinielas] = useState([]);
  const [jornadasSecuenciales, setJornadasSecuenciales] = useState([]);

  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDashboard();
  }, []);

  useEffect(() => {
    const validarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/");
    };
    validarSesion();
  }, [navigate]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    window.location.replace("/");
  };

  const esAdmin = (p) => {
    const rol = (p.rol || "").toLowerCase();
    const email = (p.email || "").toLowerCase();
    const nombre = (p.nombre_usuario || p.nombre || "").toLowerCase();
    return rol === "admin" || email.includes("admin") || nombre.includes("admin") || email.includes("root");
  };

  //---------------------------------------
  // CARGA DEL DASHBOARD USANDO RPC (SIN LÍMITE DE 1000)
  //---------------------------------------
  const cargarDashboard = async () => {
    console.log("🚀 VERSIÓN CON RPC - SIN LÍMITE DE 1000 FILAS");
    
    setCargando(true);
    const t0 = performance.now();

    try {
      const ahora = await obtenerHoraMexico();

      // Cargar datos básicos (estos sí tienen pocos registros)
      const [jornadasRes, jornadaActivaRes, perfilesRes] = await Promise.all([
        supabase.from("jornadas").select("id, nombre, activa, fecha_limite").order("id", { ascending: true }),
        supabase.from("jornadas").select("id, nombre").eq("activa", true).single(),
        supabase.from("profiles").select("id, nombre_usuario, nombre, email, rol, solo_survivor")
      ]);

      const jornadasData = jornadasRes.data || [];
      const jornadaActivaData = jornadaActivaRes.data;
      const perfilesData = perfilesRes.data || [];

      setJornadas(jornadasData);
      setJornadaActiva(jornadaActivaData);
      setParticipantes(perfilesData.filter(p => !esAdmin(p)).length);
      if (jornadaActivaData) setJornadaSeleccionada(jornadaActivaData.id);

      // ✅ LLAMADA A LA FUNCIÓN RPC (Procesa todo en el servidor)
      const { data: dashboardData, error } = await supabase.rpc('get_dashboard_data');

      if (error) {
        console.error("Error en RPC:", error);
        // Fallback: cargar datos manualmente si la función falla
        await cargarDashboardFallback(jornadasData, perfilesData, jornadaActivaData, ahora);
        return;
      }

      console.log("✅ Datos recibidos desde RPC:", dashboardData);

      // Procesar los datos recibidos
      const resultados = procesarDatosDesdeRPC(
        dashboardData,
        jornadasData,
        perfilesData,
        jornadaActivaData?.id,
        ahora
      );

      setDatosGrafica(resultados.datosGrafica);
      setRankingQuinielas(resultados.rankingQuinielas);
      setJornadasSecuenciales(resultados.jornadasSecuenciales);
      setAusentesQuiniela(resultados.ausentesQuiniela);
      setAusentesSurvivor(resultados.ausentesSurvivor);
      setQuinielasActivas(resultados.quinielasActivas);

      const t1 = performance.now();
      console.log(`⚡ Dashboard cargado en ${Math.round(t1 - t0)}ms`);

    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setCargando(false);
    }
  };

  //---------------------------------------
  // PROCESAR DATOS DESDE RPC
  //---------------------------------------
  const procesarDatosDesdeRPC = (dashboardData, jornadasData, perfilesData, idJornadaActiva, ahora) => {
    const jornadasSecuenciales = jornadasData.map((jornada, index) => ({
      idSupabase: jornada.id,
      numero: index + 1,
      nombre: `J${index + 1}`
    }));

    // Convertir ranking a formato usable
    const rankingQuinielas = (dashboardData.ranking_quinielas || []).map(r => ({
      ...r,
      vidas: 0, // Simplificado, se puede calcular si es necesario
      aciertosPorJornada: {}
    }));

    // Datos para gráfica
    const datosGrafica = (dashboardData.quinielas_por_jornada || []).map(qj => {
      const jornada = jornadasData.find(j => j.id === qj.jornada_id);
      return {
        nombre: jornada?.nombre || `J${jornadasSecuenciales.find(j => j.idSupabase === qj.jornada_id)?.numero || qj.jornada_id}`,
        quinielas: qj.usuarios_unicos || 0,
        survivor: 0 // Se puede agregar si es necesario
      };
    });

    // Ausentes (simplificado)
    let ausentesQuiniela = [];
    let ausentesSurvivor = [];
    let quinielasActivas = 0;

    if (idJornadaActiva) {
      const jornadaActivaData = dashboardData.quinielas_por_jornada?.find(qj => qj.jornada_id === idJornadaActiva);
      quinielasActivas = jornadaActivaData?.usuarios_unicos || 0;

      // Cargar quinielas de la jornada activa específicamente
      supabase
        .from("quinielas")
        .select("usuario_id")
        .eq("jornada_id", idJornadaActiva)
        .then(({ data }) => {
          const usuariosConQuiniela = new Set((data || []).map(q => q.usuario_id));
          
          ausentesQuiniela = perfilesData
            .filter(p => !esAdmin(p) && !p.solo_survivor && !usuariosConQuiniela.has(p.id))
            .map(p => ({
              ...p,
              motivo: "Falta en jornada actual",
              tipo: "normal"
            }));

          setAusentesQuiniela(ausentesQuiniela);
        });

      // Similar para survivor
      supabase
        .from("survivor")
        .select("usuario_id")
        .eq("jornada_id", idJornadaActiva)
        .then(({ data }) => {
          const usuariosConSurvivor = new Set((data || []).map(s => s.usuario_id));
          
          ausentesSurvivor = perfilesData
            .filter(p => !esAdmin(p) && !usuariosConSurvivor.has(p.id))
            .map(p => ({
              ...p,
              motivo: "Falta en jornada actual",
              tipo: "normal"
            }));

          setAusentesSurvivor(ausentesSurvivor);
        });
    }

    return {
      rankingQuinielas,
      jornadasSecuenciales,
      datosGrafica,
      ausentesQuiniela,
      ausentesSurvivor,
      quinielasActivas
    };
  };

  //---------------------------------------
  // FALLBACK: Si la función RPC falla
  //---------------------------------------
  const cargarDashboardFallback = async (jornadasData, perfilesData, jornadaActivaData, ahora) => {
    console.warn("⚠️ Usando método fallback (carga manual)");
    
    // Cargar solo las últimas 3 jornadas para evitar el límite de 1000
    const ultimasJornadas = jornadasData.slice(-3);
    const idsJornadas = ultimasJornadas.map(j => j.id);

    const [quinielasRes, survivorRes, partidosRes] = await Promise.all([
      supabase.from("quinielas")
        .select("jornada_id, usuario_id, partido_id, pronostico")
        .in("jornada_id", idsJornadas)
        .order("id", { ascending: false }),
      supabase.from("survivor")
        .select("jornada_id, usuario_id, equipo")
        .in("jornada_id", idsJornadas)
        .order("id", { ascending: false }),
      supabase.from("partidos")
        .select("id, jornada_id, local, visitante, resultado")
        .in("jornada_id", idsJornadas)
    ]);

    const resultados = procesarTodosLosDatos(
      jornadasData,
      perfilesData,
      quinielasRes.data || [],
      survivorRes.data || [],
      partidosRes.data || [],
      ahora,
      jornadaActivaData?.id
    );

    setDatosGrafica(resultados.datosGrafica);
    setRankingQuinielas(resultados.rankingQuinielas);
    setJornadasSecuenciales(resultados.jornadasSecuenciales);
    setAusentesQuiniela(resultados.ausentesQuiniela);
    setAusentesSurvivor(resultados.ausentesSurvivor);
    setQuinielasActivas(resultados.quinielasActivas);
  };

  // ... (resto del código se mantiene igual: procesarTodosLosDatos, exportarImagen, exportarPDF, interfaz)