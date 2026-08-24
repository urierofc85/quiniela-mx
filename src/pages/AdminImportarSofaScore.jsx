import { useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminImportarSofaScore() {
  const [texto, setTexto] = useState("");
  const [equipos, setEquipos] = useState([]);
  const [importando, setImportando] = useState(false);
  const [temporada, setTemporada] = useState("2025-2026"); // Ajusta según tu torneo actual
  const [guardarHistorico, setGuardarHistorico] = useState(true);

  const normalizar = (texto) =>
    texto?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const procesar = () => {
    const datos = texto
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);

    const resultado = [];
    const errores = [];

    for (let i = 0; i < datos.length - 8; i++) {
      const posicion = Number(datos[i]);
      const equipo = datos[i + 1];
      const partidos = Number(datos[i + 2]);
      const ganados = Number(datos[i + 3]);
      const empatados = Number(datos[i + 4]);
      const perdidos = Number(datos[i + 5]);
      const diferenciaTexto = datos[i + 6];
      const marcador = datos[i + 7];
      const puntos = Number(datos[i + 8]);

      // Validación básica del bloque
      const esBloqueValido =
        !isNaN(posicion) &&
        posicion >= 1 &&
        posicion <= 18 &&
        isNaN(Number(equipo)) &&
        !isNaN(partidos) &&
        !isNaN(ganados) &&
        !isNaN(empatados) &&
        !isNaN(perdidos) &&
        marcador.includes(":") &&
        !isNaN(puntos);

      if (!esBloqueValido) continue;

      const diferencia = Number(diferenciaTexto.replace("+", ""));
      const [gf, gc] = marcador.split(":").map(Number);

      // 🆕 VALIDACIONES CRUZADAS (detecta errores de SofaScore)
      const sumaResultados = ganados + empatados + perdidos;
      const diferenciaCalculada = gf - gc;

      if (sumaResultados !== partidos) {
        errores.push(`⚠️ ${equipo}: W+D+L (${sumaResultados}) ≠ PJ (${partidos})`);
        continue;
      }

      if (diferenciaCalculada !== diferencia) {
        errores.push(`⚠️ ${equipo}: GF-GC (${diferenciaCalculada}) ≠ DIF (${diferencia})`);
        continue;
      }

      resultado.push({
        posicion,
        equipo,
        partidos,
        ganados,
        empatados,
        perdidos,
        goles_favor: gf,
        goles_contra: gc,
        diferencia_goles: diferencia,
        puntos,
      });

      // Saltar las 9 líneas ya procesadas
      i += 8;
    }

    // 🆕 Deduplicación eficiente con Map (O(n) en lugar de O(n²))
    const equiposUnicos = Array.from(
      new Map(resultado.map(e => [e.posicion, e])).values()
    );

    if (errores.length > 0) {
      alert(`⚠️ Se detectaron ${errores.length} inconsistencias:\n\n${errores.slice(0, 5).join("\n")}${errores.length > 5 ? "\n..." : ""}\n\nEstos equipos fueron omitidos.`);
    }

    alert(`✅ Equipos detectados correctamente: ${equiposUnicos.length}`);
    setEquipos(equiposUnicos);
  };

  const importarPronosticos = async () => {
    try {
      setImportando(true);

      // 1. Cargar aliases y equipos existentes en paralelo
      const [
        { data: aliases, error: errorAliases },
        { data: equiposExistentes, error: errorEquipos },
      ] = await Promise.all([
        supabase.from("pronosticos_alias_equipos").select("*"),
        supabase.from("pronosticos_equipos").select("*"),
      ]);

      if (errorAliases || errorEquipos) {
        alert("Error al cargar datos: " + (errorAliases?.message || errorEquipos?.message));
        return;
      }

      const equiposExistentesSet = new Set(equiposExistentes.map(e => normalizar(e.equipo)));
      
      let actualizados = 0;
      const noEncontrados = [];
      const promesasActualizacion = [];
      const promesasHistorico = [];

      for (const equipo of equipos) {
        const alias = aliases.find(
          (a) => normalizar(a.alias) === normalizar(equipo.equipo)
        );

        if (!alias) {
          noEncontrados.push(equipo.equipo);
          continue;
        }

        const nombreOficial = alias.equipo_oficial;

        // 2. Actualizar tabla principal (acumular promesa)
        promesasActualizacion.push(
          supabase
            .from("pronosticos_equipos")
            .update({
              posicion: equipo.posicion,
              partidos: equipo.partidos,
              victorias: equipo.ganados,
              empates: equipo.empatados,
              derrotas: equipo.perdidos,
              goles_favor: equipo.goles_favor,
              goles_contra: equipo.goles_contra,
              diferencia_goles: equipo.diferencia_goles,
              puntos: equipo.puntos,
              ultima_actualizacion: new Date().toISOString(), // 🆕 Timestamp
            })
            .eq("equipo", nombreOficial)
        );

        // 3. 🆕 GUARDAR EN HISTÓRICO AUTOMÁTICAMENTE
        if (guardarHistorico) {
          // Verificar si ya existe un registro para esta temporada y equipo
          promesasHistorico.push(
            supabase
              .from("pronosticos_temporadas_equipos")
              .upsert(
                {
                  equipo: nombreOficial,
                  temporada: temporada,
                  tipo: "GENERAL",
                  partidos: equipo.partidos,
                  victorias: equipo.ganados,
                  empates: equipo.empatados,
                  derrotas: equipo.perdidos,
                  goles_favor: equipo.goles_favor,
                  goles_contra: equipo.goles_contra,
                  puntos: equipo.puntos,
                  fecha_captura: new Date().toISOString(),
                },
                { 
                  onConflict: "equipo,temporada,tipo", // Ajusta según tus constraints únicos
                  ignoreDuplicates: false 
                }
              )
          );
        }

        actualizados++;
      }

      // 4. Ejecutar todas las actualizaciones en paralelo
      await Promise.all([
        ...promesasActualizacion,
        ...promesasHistorico,
      ]);

      let mensaje = `✅ Equipos actualizados: ${actualizados}`;
      
      if (guardarHistorico) {
        mensaje += `\n📚 Registros históricos guardados: ${actualizados}`;
      }
      
      if (noEncontrados.length > 0) {
        mensaje += `\n\n⚠️ No encontrados en aliases (${noEncontrados.length}):\n${noEncontrados.join(", ")}`;
      }

      alert(mensaje);

      // Recargar vista
      setEquipos([]);
      setTexto("");
    } catch (error) {
      console.error(error);
      alert("Error crítico: " + error.message);
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">📊 Importar SofaScore</h1>

      <div className="bg-white p-6 rounded shadow">
        {/* 🆕 Configuración de temporada y histórico */}
        <div className="mb-4 p-4 bg-blue-50 rounded border border-blue-200">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-semibold mb-1">Temporada:</label>
              <input
                type="text"
                value={temporada}
                onChange={(e) => setTemporada(e.target.value)}
                className="border rounded px-3 py-1"
                placeholder="2025-2026"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="guardarHistorico"
                checked={guardarHistorico}
                onChange={(e) => setGuardarHistorico(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="guardarHistorico" className="text-sm font-semibold">
                Guardar snapshot en histórico
              </label>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            💡 Al activar "Guardar snapshot", cada importación crea un registro en el historial para calcular ratings históricos y porcentajes.
          </p>
        </div>

        <textarea
          rows={15}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="w-full border rounded p-3 mb-4 font-mono text-sm"
          placeholder={`Pega aquí la tabla de SofaScore. Formato esperado:\n\n1\nAmérica\n10\n7\n2\n1\n+12\n20:8\n23\n\n2\nMonterrey\n10\n6\n3\n1\n+8\n18:10\n21\n...`}
        />

        <div className="mb-4 p-3 bg-yellow-100 rounded flex justify-between">
          <span>Caracteres capturados: {texto.length}</span>
          <span>Líneas detectadas: {texto.split("\n").filter(Boolean).length}</span>
        </div>

        <button
          onClick={procesar}
          disabled={!texto.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          🔍 Analizar SofaScore
        </button>
      </div>

      {equipos.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-4">
            Vista previa ({equipos.length} equipos)
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">Pos</th>
                  <th className="border p-2 text-left">Equipo</th>
                  <th className="border p-2">PJ</th>
                  <th className="border p-2">W</th>
                  <th className="border p-2">D</th>
                  <th className="border p-2">L</th>
                  <th className="border p-2">GF</th>
                  <th className="border p-2">GC</th>
                  <th className="border p-2">DIF</th>
                  <th className="border p-2">PTS</th>
                  <th className="border p-2">Efect%</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((equipo) => {
                  const efectividad = ((equipo.puntos / (equipo.partidos * 3)) * 100).toFixed(1);
                  return (
                    <tr key={`${equipo.posicion}-${equipo.equipo}`} className="hover:bg-gray-50">
                      <td className="border p-2 text-center font-bold">{equipo.posicion}</td>
                      <td className="border p-2 font-medium">{equipo.equipo}</td>
                      <td className="border p-2 text-center">{equipo.partidos}</td>
                      <td className="border p-2 text-center text-green-700">{equipo.ganados}</td>
                      <td className="border p-2 text-center text-yellow-700">{equipo.empatados}</td>
                      <td className="border p-2 text-center text-red-700">{equipo.perdidos}</td>
                      <td className="border p-2 text-center">{equipo.goles_favor}</td>
                      <td className="border p-2 text-center">{equipo.goles_contra}</td>
                      <td className={`border p-2 text-center font-semibold ${equipo.diferencia_goles > 0 ? 'text-green-700' : equipo.diferencia_goles < 0 ? 'text-red-700' : ''}`}>
                        {equipo.diferencia_goles > 0 ? '+' : ''}{equipo.diferencia_goles}
                      </td>
                      <td className="border p-2 text-center font-bold">{equipo.puntos}</td>
                      <td className="border p-2 text-center text-blue-700 font-semibold">{efectividad}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={importarPronosticos}
            disabled={importando}
            className="mt-6 bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 disabled:bg-gray-400 font-semibold"
          >
            {importando ? "⏳ Importando..." : "✅ Importar a Pronósticos"}
          </button>
        </div>
      )}
    </div>
  );
}