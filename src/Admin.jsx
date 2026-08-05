import { useState, useEffect } from "react";
import { supabase } from "./services/supabase";
import { Link } from "react-router-dom";
import { obtenerHoraMexico } from "./services/horario";

export default function Admin() {
  const [nombre, setNombre] = useState("");
  const [fechaCierre, setFechaCierre] = useState("");

  const [jornadas, setJornadas] = useState([]);
  const [horaMexico, setHoraMexico] = useState(null);

  const [jornadaSeleccionada, setJornadaSeleccionada] =
    useState("");

  const [temporadas, setTemporadas] =
    useState([]);

  const [temporadaSeleccionada, setTemporadaSeleccionada] =
    useState("");

  useEffect(() => {
    verificarUsuario();
    cargarJornadas();
    cargarTemporadas();
    cargarHoraMexico();
  }, []);

  const verificarUsuario = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      console.log(
        "Usuario autenticado:",
        user
      );

      console.log(
        "UUID:",
        user.id
      );
    } else {
      console.log(
        "No hay usuario autenticado"
      );
    }
  };

  const cargarHoraMexico = async () => {
    try {
      const hora =
        await obtenerHoraMexico();

      setHoraMexico(hora);
    } catch (error) {
      console.error(
        "Error obteniendo hora CDMX:",
        error
      );
    }
  };

  const cargarTemporadas = async () => {
    const { data, error } =
      await supabase
        .from("temporadas")
        .select("*")
        .order("id", {
          ascending: false,
        });

    if (error) {
      console.error(
        "Error cargando temporadas:",
        error
      );
      return;
    }

    setTemporadas(data || []);

    const activa =
      data?.find(
        (t) => t.activa
      );

    if (activa) {
      setTemporadaSeleccionada(
        activa.id
      );
    }
  };

  const cargarJornadas = async () => {
    const { data, error } =
      await supabase
        .from("jornadas")
        .select("*")
        .order("id", {
          ascending: false,
        });

    if (error) {
      console.error(
        "Error cargando jornadas:",
        error
      );
    }

    setJornadas(data || []);
  };

  const crearJornada = async () => {
    if (
      !nombre ||
      !fechaCierre ||
      !temporadaSeleccionada
    ) {
      alert(
        "Completa todos los campos"
      );
      return;
    }

    const { error } =
      await supabase
        .from("jornadas")
        .insert([
          {
            nombre,
            fecha_limite:
              fechaCierre,
            temporada_id:
              Number(
                temporadaSeleccionada
              ),
          },
        ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Jornada creada");

    setNombre("");
    setFechaCierre("");

    await cargarJornadas();
  };

  const eliminarJornada = async (
    jornadaId
  ) => {
    const confirmar =
      window.confirm(
        "¿Deseas eliminar esta jornada y toda su información?"
      );

    if (!confirmar) return;

    const { data: partidos } =
      await supabase
        .from("partidos")
        .select("id")
        .eq(
          "jornada_id",
          jornadaId
        );

    const idsPartidos =
      partidos?.map(
        (p) => p.id
      ) || [];

    if (idsPartidos.length > 0) {
      const {
        error: errorQuinielas,
      } = await supabase
        .from("quinielas")
        .delete()
        .in(
          "partido_id",
          idsPartidos
        );

      if (errorQuinielas) {
        alert(
          errorQuinielas.message
        );
        return;
      }
    }

    const {
      error: errorPartidos,
    } = await supabase
      .from("partidos")
      .delete()
      .eq(
        "jornada_id",
        jornadaId
      );

    if (errorPartidos) {
      alert(
        errorPartidos.message
      );
      return;
    }

    const {
      error: errorJornada,
    } = await supabase
      .from("jornadas")
      .delete()
      .eq(
        "id",
        jornadaId
      );

    if (errorJornada) {
      alert(
        errorJornada.message
      );
      return;
    }

    alert(
      "Jornada eliminada"
    );

    await cargarJornadas();
  };

  const activarJornadaSeleccionada =
    async () => {
      if (!jornadaSeleccionada) {
        alert(
          "Selecciona una jornada"
        );
        return;
      }

      const {
        error: desactivarError,
      } = await supabase
        .from("jornadas")
        .update({
          activa: false,
        })
        .eq(
          "activa",
          true
        );

      if (desactivarError) {
        alert(
          desactivarError.message
        );
        return;
      }

      const {
        error: activarError,
      } = await supabase
        .from("jornadas")
        .update({
          activa: true,
        })
        .eq(
          "id",
          jornadaSeleccionada
        );

      if (activarError) {
        alert(
          activarError.message
        );
        return;
      }

      alert(
        "Jornada activada correctamente"
      );

      await cargarJornadas();
    };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Administración
      </h1>

      <div className="flex gap-3 mb-6">
        <Link
          to="/dashboard"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Dashboard
        </Link>

        <Link
          to="/participantes"
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Participantes
        </Link>

        <Link
          to="/corregir-pronosticos"
          className="bg-orange-600 text-white px-4 py-2 rounded"
        >
          Corregir Pronósticos
        </Link>
      </div>

      <h2 className="text-2xl font-bold mb-4">
        Nueva Jornada
      </h2>

      {/* El resto de tu componente permanece igual */}

    </div>
  );
}