import { useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminImportarFormaScore() {
  const [texto, setTexto] = useState("");
  const [equipos, setEquipos] = useState([]);
  const [importando, setImportando] = useState(false);
  const [temporada, setTemporada] = useState("2025-2026");

  const normalizar = (texto) =>
    texto?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const procesar = () => {
    const datos = texto
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);

    const resultado = [];
    let i = 0;

    // Parser inteligente: busca bloques que inicien con un número de posición (1-18)
    while (i < datos.length) {
      const posicion = Number(datos[i]);

      // Si no es un número de posición válido, avanzamos
      if (isNaN(posicion) || posicion < 1 || posicion > 18) {
        i++;
        continue;
      }

      const nombreLargo = datos[i + 1] || "";
      const equipo = datos[i + 2] || "";
      
      // 🆕 Recopilación flexible de resultados (W, D, L) hasta un máximo de 5
      let forma = [];
      let j = i + 3;
      
      while (j < datos.length && forma.length < 5) {
        const valor = datos[j].toUpperCase();
        if (valor === "W" || valor === "D" || valor === "L") {
          forma.push(valor);
          j++;
        } else {
          break; // Encontramos algo que no es W, D o L (probablemente el siguiente equipo)
        }
      }

      // Calcular puntos: W=3, D=1, L=0
      let puntosUltimos5 = 0;
      forma.forEach((resultadoPartido) => {
        if (resultadoPartido === "W") puntosUltimos5 += 3;
        if (resultadoPartido === "D") puntosUltimos5 += 1;
      });

      resultado.push({
        posicion,
        nombreLargo,
        equipo,
        forma,
        puntos_ultimos5: puntosUltimos5,
      });

      // Avanzar el índice principal hasta donde terminó de leer la forma
      i = j;
    }

    if (resultado.length === 0) {
      alert("⚠️ No se detectaron equipos. Verifica que el formato copiado de SofaScore sea correcto.");
    } else {
      alert(`✅ Equipos detectados: ${resultado.length}`);
    }

    setEquipos(resultado);
  };

  const importarForma = async () => {
    try {
      setImportando(true);

      const { data: aliases, error } = await supabase
        .from("pronosticos_alias_equipos")
        .select("*");

      if (error) {
        alert("Error al cargar aliases: " + error.message);
        return;
      }

      let actualizados = 0;
      const noEncontrados = [];
      
      const promesasUpdateEquipos = [];
      const promesasUpsertHistorico = [];

      for (const equipoData of equipos) {
        const alias = aliases.find(
          (a) => normalizar(a.alias) === normalizar(equipoData.equipo)
        );

        if (!alias) {
          noEncontrados.push(equipoData.equipo);
          continue;
        }

        const nombreOficial = alias.equipo_oficial;

        // 1. Preparar actualización de la tabla principal
        promesasUpdateEquipos.push(
          supabase
            .from("pronosticos_equipos")
            .update({
              puntos_ultimos5: equipoData.puntos_ultimos5,
              ultima_actualizacion: new Date().toISOString(),
            })
            .eq("equipo", nombreOficial)
        );

        // 2. Preparar upsert en el histórico de forma
        promesasUpsertHistorico.push(
          supabase
            .from("pronosticos_forma_historica")
            .upsert(
              {
                temporada: temporada,
                equipo: nombreOficial,
                puntos_ultimos5: equipoData.puntos_ultimos5,
                forma_string: equipoData.forma.join(""), // 🆕 Guardamos la cadena ej: "WWDLL"
                fecha_captura: new Date().toISOString(),
              },
              {
                onConflict: "temporada,equipo",
              }
            )
        );

        actualizados++;
      }

      // 🆕 Ejecutar todo en paralelo para máxima velocidad
      await Promise.all([...promesasUpdateEquipos, ...promesasUpsertHistorico]);

      let mensaje = `✅ Importación completada\n\nTemporada: ${temporada}\nEquipos actualizados: ${actualizados}`;
      
      if (noEncontrados.length > 0) {
        mensaje += `\n\n⚠️ No encontrados en aliases (${noEncontrados.length}):\n${noEncontrados.join("\n")}`;
      }

      alert(mensaje);
      
      // Limpiar formulario tras éxito
      setTexto("");
      setEquipos([]);
    } catch (error) {
      console.error(error);
      alert("Error crítico: " + error.message);
    } finally {
      setImportando(false);
    }
  };

  // 🆕 Función auxiliar para colorear la forma en la tabla
  const renderForma = (formaArray) => {
    return formaArray.map((res, idx) => {
      let colorClass = "bg-gray-200 text-gray-700";
      if (res === "W") colorClass = "bg-green-100 text-green-800 border border-green-300";
      if (res === "D") colorClass = "bg-yellow-100 text-yellow-800 border border-yellow-300";
      if (res === "L") colorClass = "bg-red-100 text-red-800 border border-red-300";

      return (
        <span key={idx} className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded mx-0.5 ${colorClass}`}>
          {res}
        </span>
      );
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">📈 Importar Forma SofaScore</h1>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
        <p className="text-sm text-blue-800">
          💡 <strong>Nota:</strong> Esta herramienta es ideal para configuraciones iniciales o correcciones manuales. 
          Para el mantenimiento semanal, se recomienda usar la pestaña <strong>"Por Validar"</strong> en el módulo de Partidos, 
          ya que actualiza automáticamente todas las estadísticas (no solo la forma).
        </p>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <p className="mb-4 text-gray-700">
          Copia y pega la vista "Forma" de SofaScore directamente en el área de texto.
        </p>

        <div className="mb-4">
          <label className="block mb-2 font-semibold text-gray-700">Temporada</label>
          <select
            value={temporada}
            onChange={(e) => setTemporada(e.target.value)}
            className="border rounded p-2 w-full md:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="2026-2027">2026-2027</option>
            <option value="2025-2026">2025-2026</option>
            <option value="2024-2025">2024-2025</option>
            <option value="2023-2024">2023-2024</option>
          </select>
        </div>

        <textarea
          rows={12}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="w-full border rounded p-3 mb-4 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={`Ejemplo de formato esperado:\n1\nMonterrey\nMonterrey\nW\nW\nD\nL\nW\n\n2\nAmérica\nAmérica\nD\nW\nW\nW\nD`}
        />

        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded flex justify-between text-sm text-yellow-800">
          <span>Caracteres capturados: <strong>{texto.length}</strong></span>
          <span>Líneas detectadas: <strong>{texto.split("\n").filter(Boolean).length}</strong></span>
        </div>

        <button
          onClick={procesar}
          disabled={!texto.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition"
        >
          🔍 Analizar Forma
        </button>
      </div>

      {equipos.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-4">Vista Previa ({equipos.length} equipos)</h2>

          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="border p-2 w-16">Pos</th>
                  <th className="border p-2 text-left">Equipo</th>
                  <th className="border p-2 text-center">Forma (Últimos 5)</th>
                  <th className="border p-2 w-32">Puntos Forma</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((equipo) => (
                  <tr key={`${equipo.posicion}-${equipo.equipo}`} className="hover:bg-gray-50">
                    <td className="border p-2 text-center font-bold">{equipo.posicion}</td>
                    <td className="border p-2 font-medium">
                      {equipo.equipo}
                      {equipo.nombreLargo && equipo.nombreLargo !== equipo.equipo && (
                        <div className="text-xs text-gray-500 font-normal">{equipo.nombreLargo}</div>
                      )}
                    </td>
                    <td className="border p-2 text-center">
                      <div className="flex justify-center flex-wrap gap-1">
                        {renderForma(equipo.forma)}
                      </div>
                    </td>
                    <td className="border p-2 text-center font-bold text-blue-700 text-lg">
                      {equipo.puntos_ultimos5}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={importarForma}
            disabled={importando}
            className="mt-6 bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg transition shadow-sm"
          >
            {importando ? "⏳ Importando..." : "✅ Importar Forma a la Base de Datos"}
          </button>
        </div>
      )}
    </div>
  );
}