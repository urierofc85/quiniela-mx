import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { Link } from "react-router-dom";

export default function Temporadas() {

  const [temporadas, setTemporadas] =
    useState([]);

  const [nombre, setNombre] =
    useState("");

  useEffect(() => {
    cargarTemporadas();
  }, []);

  const cargarTemporadas = async () => {

    const { data, error } =
      await supabase
        .from("temporadas")
        .select("*")
        .order("id", {
          ascending: false,
        });

    if (error) {
      console.error(error);
      return;
    }

    setTemporadas(data || []);

  };

  const crearTemporada = async () => {

    if (!nombre.trim()) {
      alert(
        "Ingresa un nombre"
      );
      return;
    }

    const { error } =
      await supabase
        .from("temporadas")
        .insert([
          {
            nombre,
            activa: false,
          },
        ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      "Temporada creada"
    );

    setNombre("");

    await cargarTemporadas();

  };

  const activarTemporada =
    async (id) => {

      const { error: error1 } =
        await supabase
          .from("temporadas")
          .update({
            activa: false,
          })
          .eq(
            "activa",
            true
          );

      if (error1) {
        alert(error1.message);
        return;
      }

      const { error: error2 } =
        await supabase
          .from("temporadas")
          .update({
            activa: true,
          })
          .eq("id", id);

      if (error2) {
        alert(error2.message);
        return;
      }

      await cargarTemporadas();

      alert(
        "Temporada activada"
      );

    };

  return (

    <div className="max-w-5xl mx-auto p-6">

      <div className="flex justify-between items-center mb-6">

        <h1 className="text-3xl font-bold">
          🏆 Temporadas
        </h1>

        <Link
          to="/admin"
          className="
            bg-blue-600
            text-white
            px-4
            py-2
            rounded
          "
        >
          Regresar
        </Link>

      </div>

      <div className="bg-white shadow rounded p-4 mb-6">

        <h2 className="text-xl font-bold mb-4">
          Nueva Temporada
        </h2>

        <div className="flex gap-3">

          <input
            type="text"
            placeholder="Ej. Clausura 2027"
            value={nombre}
            onChange={(e) =>
              setNombre(
                e.target.value
              )
            }
            className="
              flex-1
              border
              p-2
              rounded
            "
          />

          <button
            onClick={
              crearTemporada
            }
            className="
              bg-green-600
              text-white
              px-4
              py-2
              rounded
            "
          >
            Crear
          </button>

        </div>

      </div>

      <h2 className="text-2xl font-bold mb-4">
        Temporadas Registradas
      </h2>

      {temporadas.map(
        (temporada) => (

          <div
            key={temporada.id}
            className="
              border
              rounded
              p-4
              mb-3
              shadow-sm
            "
          >

            <div className="font-bold text-lg">
              {temporada.nombre}
            </div>

            <div className="mt-2">

              {temporada.activa ? (

                <span className="
                  bg-green-100
                  text-green-700
                  px-3
                  py-1
                  rounded
                  font-bold
                ">
                  ✅ Activa
                </span>

              ) : (

                <span className="
                  bg-gray-100
                  text-gray-700
                  px-3
                  py-1
                  rounded
                ">
                  Inactiva
                </span>

              )}

            </div>

            {!temporada.activa && (

              <button
                onClick={() =>
                  activarTemporada(
                    temporada.id
                  )
                }
                className="
                  mt-3
                  bg-blue-600
                  text-white
                  px-4
                  py-2
                  rounded
                "
              >
                Activar
              </button>

            )}

          </div>

        )
      )}

    </div>

  );
}