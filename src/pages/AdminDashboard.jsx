import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";
import { supabase } from "../services/supabase";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function AdminDashboard() {

  const navigate = useNavigate();

  const [jornada, setJornada] = useState(null);

  const [participantes, setParticipantes] = useState(0);

  const [quinielas, setQuinielas] = useState(0);

  const [data, setData] = useState([]);

  const [jornadas, setJornadas] = useState([]);

  const [
    jornadaSeleccionada,
    setJornadaSeleccionada,
  ] = useState("");

  useEffect(() => {

    cargarDashboard();

  }, []);

  const cerrarSesion = async () => {

  const { error } =
    await supabase.auth.signOut();

  if (error) {
    alert(error.message);
    return;
  }

  window.location.replace("/");
};
useEffect(() => {

  const validarSesion = async () => {

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/");
    }

  };

  validarSesion();

}, [navigate]);


  //---------------------------------------
  // DASHBOARD
  //---------------------------------------

  const cargarDashboard = async () => {

    const {
      data: jornadaData
    } = await supabase
      .from("jornadas")
      .select("*")
      .eq("activa", true)
      .single();

    setJornada(jornadaData);

    const {
      data: jornadasData
    } = await supabase
      .from("jornadas")
      .select("*")
      .order("id", {
        ascending: false
      });

    setJornadas(
      jornadasData || []
    );

    if (
      jornadasData?.length > 0
    ) {

      setJornadaSeleccionada(
        jornadasData[0].id
      );

    }

    const {
      count
    } = await supabase
      .from("profiles")
      .select("*", {
        count: "exact",
        head: true,
      });

    setParticipantes(
      count || 0
    );

    if (jornadaData) {

      const {
        data: quinielasData
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
            q => q.usuario_id
          ) || []

        ),

      ];

      setQuinielas(
        usuariosUnicos.length
      );

    }

    const {
      data: participacion
    } = await supabase
      .from("participacion_jornadas")
      .select("*");

    setData(
      participacion || []
    );

  };

  //---------------------------------------
  // EXPORTAR PDF
  //---------------------------------------

  const exportarPDF = async () => {

    const {
      default: jsPDF
    } = await import("jspdf");

    const {
      default: autoTable
    } = await import(
      "jspdf-autotable"
    );

    const {
      data: jornadaActiva
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
        "Selecciona una jornada."
      );

      return;

    }
        //---------------------------------------
    // PARTIDOS
    //---------------------------------------

    const {
      data: partidos
    } = await supabase
      .from("partidos")
      .select(
        "id, local, visitante, resultado"
      )
      .eq(
        "jornada_id",
        jornadaActiva.id
      )
      .order("id");

    //---------------------------------------
    // QUINIELAS
    //---------------------------------------

    const {
      data: quinielasData
    } = await supabase
      .from("quinielas")
      .select(
        `
        usuario_id,
        partido_id,
        pronostico
        `
      )
      .eq(
        "jornada_id",
        jornadaActiva.id
      );

    //---------------------------------------
    // PERFILES
    //---------------------------------------

    const {
      data: perfiles
    } = await supabase
      .from("profiles")
      .select(
        `
        id,
        nombre,
        nombre_usuario,
        nombre_completo
        `
      );

    //---------------------------------------
    // USUARIOS
    //---------------------------------------

    const usuarios = [

      ...new Set(

        quinielasData?.map(
          q => q.usuario_id
        ) || []

      )

    ];

    //---------------------------------------
    // ENCABEZADOS
    //---------------------------------------

    const columnas = [

      "Partido",

      "Resultado",

      ...usuarios.map(

        usuarioId => {

          const perfil =
            perfiles?.find(

              p =>
                p.id ===
                usuarioId

            );

          return (

            perfil?.nombre_usuario ||

            perfil?.nombre ||

            perfil?.nombre_completo ||

            usuarioId

          );

        }

      )

    ];

    //---------------------------------------
    // CONTADOR DE ACIERTOS
    //---------------------------------------

    const aciertos = {};

    usuarios.forEach(

      usuarioId => {

        aciertos[
          usuarioId
        ] = 0;

      }

    );

    //---------------------------------------
    // FILAS DEL PDF
    //---------------------------------------

    const filas = partidos.map(

      partido => {

        const fila = [];

        fila.push(

          `${partido.local} vs ${partido.visitante}`

        );

        fila.push(

          partido.resultado || "-"

        );

        usuarios.forEach(

          usuarioId => {

            const pronostico =
              quinielasData.find(

                q =>

                  Number(
                    q.partido_id
                  ) ===
                  Number(
                    partido.id
                  )

                  &&

                  q.usuario_id ===
                  usuarioId

              );

            let valor = "-";

            if (pronostico) {

              valor =
                pronostico.pronostico;

              if (

                partido.resultado &&

                pronostico.pronostico ===
                partido.resultado

              ) {

                aciertos[
                  usuarioId
                ]++;

              }

            }

            fila.push(
              valor
            );

          }

        );

        return fila;

      }

    );

    //---------------------------------------
    // FILA TOTAL
    //---------------------------------------

    const filaTotales = [];

    filaTotales.push(
      "TOTAL"
    );

    filaTotales.push("");

    usuarios.forEach(

      usuarioId => {

        filaTotales.push(

          aciertos[
            usuarioId
          ]

        );

      }

    );

    filas.push(
      filaTotales
    );
    //---------------------------------------
    // CREAR PDF
    //---------------------------------------

    const doc = new jsPDF(
      "landscape"
    );

    doc.setFontSize(18);

    doc.text(
      `Quinielas - ${jornadaActiva.nombre}`,
      14,
      15
    );

    autoTable(doc, {

      head: [
        columnas
      ],

      body: filas,

      startY: 22,

      theme: "grid",

      styles: {

        fontSize: 8,

        halign: "center",

        valign: "middle",

      },

      headStyles: {

        fillColor: [
          22,
          163,
          74
        ],

        textColor: 255,

        fontStyle: "bold",

      },

      didParseCell: (data) => {

        //-----------------------------------
        // FILA DE TOTALES
        //-----------------------------------

        if (

          data.section === "body"

          &&

          data.row.index ===
          filas.length - 1

        ) {

          data.cell.styles.fillColor = [
            230,
            230,
            230
          ];

          data.cell.styles.fontStyle =
            "bold";

          return;

        }

        //-----------------------------------
        // SOLO CELDAS DE PRONÓSTICOS
        //-----------------------------------

        if (

          data.section !== "body"

        ) return;

        if (

          data.column.index < 2

        ) return;

        const fila =
          filas[data.row.index];

        if (!fila) return;

        const resultado =
          fila[1];

        const pronostico =
          data.cell.raw;

        //-----------------------------------
        // MARCAR ACIERTOS EN ROJO
        //-----------------------------------

        if (

          resultado !== "-"

          &&

          resultado !== null

          &&

          pronostico === resultado

        ) {

          data.cell.styles.textColor = [
            22,
            163,
            74];

          data.cell.styles.fontStyle =
            "bold";

        }

      },

    });
        //---------------------------------------
    // GUARDAR PDF
    //---------------------------------------

    doc.save(
      `Quinielas_${jornadaActiva.nombre}.pdf`
    );

  };
    //---------------------------------------
  // INTERFAZ
  //---------------------------------------

  return (

    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Dashboard Administrador
      </h1>

      <div className="flex flex-wrap gap-3 mb-6">

        <select
          value={jornadaSeleccionada}
          onChange={(e) =>
            setJornadaSeleccionada(
              Number(e.target.value)
            )
          }
          className="border rounded px-3 py-2"
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
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          📄 Exportar PDF
        </button>

        <Link
          to="/admin"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Crear Jornada
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

       <Link
  to="/admin-survivor"
  className="bg-pink-600 text-white px-4 py-2 rounded"
>
  🏆 Survivor
</Link>

<button
  onClick={cerrarSesion}
  className="
    bg-red-600
    text-white
    px-4
    py-2
    rounded
    hover:bg-red-700
  "
>
  🚪 Cerrar Sesión
</button>

      </div>

      <div className="mb-6 bg-white rounded shadow p-4">

        <p>
          <strong>Jornada Activa:</strong>{" "}
          {jornada
            ? jornada.nombre
            : "Sin jornada activa"}
        </p>

        <p>
          <strong>Participantes:</strong>{" "}
          {participantes}
        </p>

        <p>
          <strong>Quinielas recibidas:</strong>{" "}
          {quinielas}
        </p>

      </div>

      <h2 className="text-xl font-bold mb-4">
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

  );

}