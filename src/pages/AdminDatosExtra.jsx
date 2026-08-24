import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export default function AdminDatosExtra() {
  const [equipos, setEquipos] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarEquipos();
  }, []);

  const cargarEquipos = async () => {
    const { data } = await supabase
      .from("pronosticos_equipos")
      .select("equipo, factor_liguilla, posicion")
      .order("posicion", { ascending: true });
    setEquipos(data || []);
  };

  const handleLiguillaChange = (equipo, valor) => {
    setEquipos(prev => prev.map(e =>
      e.equipo === equipo ? { ...e, factor_liguilla: Number(valor) } : e
    ));
  };

  const guardarCambios = async () => {
    setGuardando(true);
    const promesas = equipos.map(eq =>
      supabase.from("pronosticos_equipos")
        .update({ factor_liguilla: eq.factor_liguilla })
        .eq("equipo", eq.equipo)
    );
    await Promise.all(promesas);
    alert("✅ Motivación por liguilla actualizada. El modelo ahora considera qué equipos se juegan la clasificación.");
    setGuardando(false);
  };

  // Clasificación visual rápida
  const getEstadoColor = (valor) => {
    if (valor >= 5) return "bg-green-100 border-green-400 text-green-700";
    if (valor <= -5) return "bg-red-100 border-red-400 text-red-700";
    return "bg-gray-50";
  };

  const getEstadoTexto = (valor) => {
    if (valor >= 5) return "🔥 Peleando Liguilla";
    if (valor === 0) return "➖ Normal";
    if (valor <= -5) return "😴 Eliminado";
    return "➖ Normal";
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">🏆 Motivación por Liguilla</h1>
      <p className="text-gray-600 mb-6">
        Actualiza qué equipos se juegan la clasificación. <br />
        <span className="text-sm">💡 <strong>+5:</strong> Pelea boleto a liguilla | <strong>0:</strong> Situación normal | <strong>-5:</strong> Matemáticamente eliminado</span>
      </p>

      <div className="bg-white rounded shadow p-4 max-h-[500px] overflow-y-auto">
        {equipos.map((eq) => (
          <div key={eq.equipo} className="flex justify-between items-center py-2 border-b last:border-0">
            <div>
              <span className="font-medium capitalize">{eq.equipo}</span>
              <div className="text-xs text-gray-500">{getEstadoTexto(eq.factor_liguilla || 0)}</div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={eq.factor_liguilla || 0}
                onChange={(e) => handleLiguillaChange(eq.equipo, e.target.value)}
                className={`w-48 border rounded px-2 py-1 text-sm font-semibold ${getEstadoColor(eq.factor_liguilla || 0)}`}
              >
                <option value="5">🔥 Peleando Liguilla (+5)</option>
                <option value="0">➖ Normal (0)</option>
                <option value="-5">😴 Eliminado (-5)</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={guardarCambios}
        disabled={guardando}
        className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:bg-gray-400"
      >
        {guardando ? "Guardando..." : "💾 Guardar Motivación"}
      </button>
    </div>
  );
}