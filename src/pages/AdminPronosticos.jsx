import { Link } from "react-router-dom";

export default function AdminPronosticos() {
  return (
    <div className="max-w-6xl mx-auto p-6">

      <h1 className="text-3xl font-bold mb-6">
        📈 Administración de Pronósticos
      </h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">

        <Link
          to="/pronosticos"
          className="
            bg-cyan-600
            text-white
            p-5
            rounded-lg
            shadow
            hover:bg-cyan-700
          "
        >
          <div className="text-xl font-bold">
            📈 Ver Pronósticos
          </div>

          <div className="text-sm mt-2">
            Consultar predicciones generadas
          </div>
        </Link>

        <Link
          to="/admin-pronosticos-equipos"
          className="
            bg-indigo-600
            text-white
            p-5
            rounded-lg
            shadow
            hover:bg-indigo-700
          "
        >
          <div className="text-xl font-bold">
            ⚙️ Equipos
          </div>

          <div className="text-sm mt-2">
            Administrar estadísticas de equipos
          </div>
        </Link>

        <Link
          to="/admin-pronosticos-partidos"
          className="
            bg-teal-600
            text-white
            p-5
            rounded-lg
            shadow
            hover:bg-teal-700
          "
        >
          <div className="text-xl font-bold">
            ⚽ Partidos
          </div>

          <div className="text-sm mt-2">
            Crear y administrar partidos
          </div>
        </Link>

        <Link
          to="/admin-importar-ligamx"
          className="
            bg-sky-600
            text-white
            p-5
            rounded-lg
            shadow
            hover:bg-sky-700
          "
        >
          <div className="text-xl font-bold">
            📥 Importar Liga MX
          </div>

          <div className="text-sm mt-2">
            Actualizar posiciones y estadísticas
          </div>
        </Link>

        <Link
          to="/admin-actualizar-estadisticas"
          className="
            bg-amber-600
            text-white
            p-5
            rounded-lg
            shadow
            hover:bg-amber-700
          "
        >
          <div className="text-xl font-bold">
            📊 Actualizar Datos
          </div>

          <div className="text-sm mt-2">
            Procesos automáticos del modelo
          </div>
        </Link>

        <Link
          to="/admin"
          className="
            bg-gray-600
            text-white
            p-5
            rounded-lg
            shadow
            hover:bg-gray-700
          "
        >
          <div className="text-xl font-bold">
            🔙 Volver
          </div>

          <div className="text-sm mt-2">
            Regresar a la administración principal
          </div>
        </Link>

        <Link
  to="/admin-importar-sofascore"
  className="
    bg-emerald-600
    text-white
    p-5
    rounded-lg
    shadow
    hover:bg-emerald-700
  "
>
  <div className="text-xl font-bold">
    📊 SofaScore
  </div>

  <div className="text-sm mt-2">
    Analizar tabla de SofaScore
  </div>
</Link>

<Link
  to="/admin-importar-formascore"
  className="
    bg-purple-600
    text-white
    p-5
    rounded-lg
    shadow
    hover:bg-purple-700
  "
>
  <div className="text-xl font-bold">
    📈 Forma SofaScore
  </div>

  <div className="text-sm mt-2">
    Importar forma reciente de los equipos
  </div>
</Link>

      </div>

    </div>
  );
}