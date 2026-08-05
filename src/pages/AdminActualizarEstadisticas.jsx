import { useState } from "react";

export default function AdminActualizarEstadisticas() {
  const [loading, setLoading] = useState(false);

  const actualizarLigaMX = async () => {
    try {
      setLoading(true);

      alert(
        "Próximamente: actualización automática desde ESPN"
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const actualizarPlantillas = async () => {
    try {
      setLoading(true);

      alert(
        "Próximamente: actualización automática desde Transfermarkt"
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const recalcularPronosticos = async () => {
    try {
      setLoading(true);

      alert(
        "Pronósticos recalculados"
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">

      <h1 className="text-3xl font-bold mb-6">
        📊 Actualización de Estadísticas
      </h1>

      <div className="grid gap-4">

        <div className="bg-white rounded shadow p-6">

          <h2 className="text-xl font-bold mb-2">
            Liga MX
          </h2>

          <p className="text-gray-600 mb-4">
            Actualiza estadísticas de equipos.
          </p>

          <button
            onClick={actualizarLigaMX}
            disabled={loading}
            className="
              bg-blue-600
              text-white
              px-4
              py-2
              rounded
            "
          >
            ⚽ Actualizar Liga MX
          </button>

        </div>

        <div className="bg-white rounded shadow p-6">

          <h2 className="text-xl font-bold mb-2">
            Valores de Plantilla
          </h2>

          <p className="text-gray-600 mb-4">
            Actualiza valores económicos.
          </p>

          <button
            onClick={actualizarPlantillas}
            disabled={loading}
            className="
              bg-green-600
              text-white
              px-4
              py-2
              rounded
            "
          >
            💰 Actualizar Plantillas
          </button>

        </div>

        <div className="bg-white rounded shadow p-6">

          <h2 className="text-xl font-bold mb-2">
            Motor de Pronósticos
          </h2>

          <p className="text-gray-600 mb-4">
            Recalcula todos los partidos.
          </p>

          <button
            onClick={recalcularPronosticos}
            disabled={loading}
            className="
              bg-purple-600
              text-white
              px-4
              py-2
              rounded
            "
          >
            🤖 Recalcular Pronósticos
          </button>

        </div>

      </div>

    </div>
  );
}