import { useState } from "react";
import { supabase } from "../services/supabase";

export default function AdminImportarTransfermarkt() {
  const [texto, setTexto] = useState("");
  const [equipos, setEquipos] = useState([]);
  const [importando, setImportando] = useState(false);
  const [temporada, setTemporada] = useState("Apertura 2026");

  const normalizar = (texto) =>
    texto?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  // 🆕 Función para convertir "102.45 mill. €" o "884 mil €" a número (en millones)
  const parsearValorMillones = (texto) => {
    if (!texto) return 0;
    const limpio = texto.replace("€", "").trim();
    
    if (limpio.includes("mill")) {
      // "102.45 mill. €" → 102.45
      const match = limpio.match(/([\d.,]+)/);
      return match ? parseFloat(match[1].replace(",", ".")) : 0;
    }
    if (limpio.includes("mil")) {
      // "884 mil €" → 0.884 millones
      const match = limpio.match(/([\d.,]+)/);
      return match ? parseFloat(match[1].replace(",", ".")) / 1000 : 0;
    }
    return 0;
  };

  const procesar = () => {
    const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
    const resultado = [];

    for (const linea of lineas) {
      // Dividir por tabulaciones o múltiples espacios
      const partes = linea.split(/\t+|\s{2,}/).map((p) => p.trim()).filter(Boolean);

      // Buscar líneas que contengan "mill" o "mil" (indicador de valor monetario)
      const tieneValor = partes.some((p) => p.includes("mill") || p.includes("mil"));
      if (!tieneValor) continue;

      // Evitar la línea de totales (la que empieza con un número grande como "482")
      if (/^\d{3,}$/.test(partes[0])) continue;

      // Identificar las partes según el formato de Transfermarkt:
      // [NombreLargo] [NombreCorto] [Jugadores] [Edad] [Extranjeros] [ValorMedio] [ValorTotal]
      // A veces el nombre largo y corto se fusionan, así que buscamos los valores numéricos
      
      let jugadores = 0, edad = 0, extranjeros = 0;
      let valorMedioTexto = "", valorTotalTexto = "";
      let nombreClub = "";

      // Extraer valores numéricos y textos de valor
      const valoresNumericos = [];
      const textosRestantes = [];

      for (const parte of partes) {
        if (parte.includes("mill") || parte.includes("mil")) {
          if (!valorMedioTexto) valorMedioTexto = parte;
          else valorTotalTexto = parte;
        } else if (/^\d+(\.\d+)?$/.test(parte)) {
          valoresNumericos.push(parseFloat(parte));
        } else if (/^\d+$/.test(parte)) {
          valoresNumericos.push(parseInt(parte));
        } else {
          textosRestantes.push(parte);
        }
      }

      // Asignar valores numéricos en orden: jugadores, edad, extranjeros
      if (valoresNumericos.length >= 3) {
        jugadores = valoresNumericos[0];
        edad = valoresNumericos[1];
        extranjeros = valoresNumericos[2];
      }

      // El nombre del club es el primer texto restante
      nombreClub = textosRestantes[0] || "";

      if (!nombreClub || !valorTotalTexto) continue;

      const valorTotal = parsearValorMillones(valorTotalTexto);
      const valorMedio = parsearValorMillones(valorMedioTexto);

      resultado.push({
        nombreClub,
        jugadores,
        edad,
        extranjeros,
        valorMedio,
        valorTotal, // en millones de euros
      });
    }

    // 🆕 Normalizar a escala 0-100 basado en el valor más alto de la liga
    if (resultado.length > 0) {
      const maxValor = Math.max(...resultado.map((e) => e.valorTotal));
      resultado.forEach((eq) => {
        eq.valorEscala100 = maxValor > 0 ? Number(((eq.valorTotal / maxValor) * 100).toFixed(2)) : 0;
      });
    }

    if (resultado.length === 0) {
      alert("⚠️ No se detectaron equipos. Verifica que el formato copiado de Transfermarkt sea correcto.");
    } else {
      alert(`✅ Equipos detectados: ${resultado.length}`);
    }

    setEquipos(resultado);
  };

  const importar = async () => {
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
      const promesas = [];

      for (const equipo of equipos) {
        const alias = aliases.find(
          (a) => normalizar(a.alias) === normalizar(equipo.nombreClub)
        );

        if (!alias) {
          noEncontrados.push(equipo.nombreClub);
          continue;
        }

        promesas.push(
          supabase
            .from("pronosticos_equipos")
            .update({
              valor_plantilla: equipo.valorEscala100, // Escala 0-100 para el modelo
              valor_plantilla_millones: equipo.valorTotal, // Valor real en millones €
              valor_plantilla_media: equipo.valorMedio, // Valor medio por jugador
              jugadores_plantilla: equipo.jugadores,
              edad_promedio: equipo.edad,
              extranjeros: equipo.extranjeros,
              temporada_valor: temporada,
              ultima_actualizacion_valor: new Date().toISOString(),
            })
            .eq("equipo", alias.equipo_oficial)
        );

        actualizados++;
      }

      await Promise.all(promesas);

      let mensaje = `✅ Importación completada\n\nTemporada: ${temporada}\nEquipos actualizados: ${actualizados}`;
      if (noEncontrados.length > 0) {
        mensaje += `\n\n⚠️ No encontrados en aliases (${noEncontrados.length}):\n${noEncontrados.join("\n")}`;
      }
      alert(mensaje);

      setTexto("");
      setEquipos([]);
    } catch (error) {
      console.error(error);
      alert("Error crítico: " + error.message);
    } finally {
      setImportando(false);
    }
  };

  // Formatear valores para mostrar
  const formatearMillones = (valor) => {
    if (valor >= 1) return `${valor.toFixed(2)} M€`;
    return `${(valor * 1000).toFixed(0)} K€`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">💰 Importar Valores de Transfermarkt</h1>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
        <p className="text-sm text-blue-800">
          💡 <strong>Instrucciones:</strong> Ve a Transfermarkt → Liga MX → Tabla de valores de mercado. 
          Copia toda la tabla y pégala aquí. Se actualiza cada 6 meses (ventanas de fichajes).
        </p>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <div className="mb-4">
          <label className="block mb-2 font-semibold text-gray-700">Temporada</label>
          <select
            value={temporada}
            onChange={(e) => setTemporada(e.target.value)}
            className="border rounded p-2 w-full md:w-64 focus:ring-2 focus:ring-blue-500"
          >
            <option value="Apertura 2026">Apertura 2026</option>
            <option value="Clausura 2027">Clausura 2027</option>
            <option value="Apertura 2025">Apertura 2025</option>
            <option value="Clausura 2026">Clausura 2026</option>
          </select>
        </div>

        <textarea
          rows={15}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="w-full border rounded p-3 mb-4 font-mono text-sm"
          placeholder="Pega aquí la tabla completa de Transfermarkt..."
        />

        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded flex justify-between text-sm">
          <span>Caracteres: <strong>{texto.length}</strong></span>
          <span>Líneas: <strong>{texto.split("\n").filter(Boolean).length}</strong></span>
        </div>

        <button
          onClick={procesar}
          disabled={!texto.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
        >
          🔍 Analizar Datos
        </button>
      </div>

      {equipos.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-4">Vista Previa ({equipos.length} equipos)</h2>

          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">#</th>
                  <th className="border p-2 text-left">Club</th>
                  <th className="border p-2 text-center">Jugadores</th>
                  <th className="border p-2 text-center">Edad Prom.</th>
                  <th className="border p-2 text-center">Extranjeros</th>
                  <th className="border p-2 text-center">Valor Medio</th>
                  <th className="border p-2 text-center">Valor Total</th>
                  <th className="border p-2 text-center">Escala 0-100</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((equipo, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="border p-2 font-bold">{idx + 1}</td>
                    <td className="border p-2 font-medium">{equipo.nombreClub}</td>
                    <td className="border p-2 text-center">{equipo.jugadores}</td>
                    <td className="border p-2 text-center">{equipo.edad}</td>
                    <td className="border p-2 text-center">{equipo.extranjeros}</td>
                    <td className="border p-2 text-center text-gray-700">{formatearMillones(equipo.valorMedio)}</td>
                    <td className="border p-2 text-center font-bold text-green-700">{formatearMillones(equipo.valorTotal)}</td>
                    <td className="border p-2 text-center">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded font-bold">
                        {equipo.valorEscala100}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
            ✅ La columna <strong>"Escala 0-100"</strong> es la que usará el modelo de pronósticos. 
            Se normaliza automáticamente tomando el valor más alto de la liga como 100.
          </div>

          <button
            onClick={importar}
            disabled={importando}
            className="mt-6 bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 disabled:bg-gray-400 font-bold text-lg"
          >
            {importando ? "⏳ Importando..." : "💾 Importar Valores a la Base de Datos"}
          </button>
        </div>
      )}
    </div>
  );
}