import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { Link } from "react-router-dom";

export default function JugadorVsJugador() {

  const [jugadores, setJugadores] =
    useState([]);

  const [jugador1, setJugador1] =
    useState("");

  const [jugador2, setJugador2] =
    useState("");

  const [datos1, setDatos1] =
    useState(null);

  const [datos2, setDatos2] =
    useState(null);

  useEffect(() => {
    cargarJugadores();
  }, []);

  const cargarJugadores = async () => {

    const { data } =
      await supabase
        .from("comparativa_jugadores")
        .select("*")
        .order(
       *  "nombre_usuario"
        );

   *setJugadores(
      data || []
   *);
  };

  const comparar = () => *

    const j1 =
      jugadores.f*nd(
        j =>
          String(*            j.usuario_id
         *) ===
          String(
          * jugador1
          )
      );

  * const j2 =
      jugadores.find(
*       j =>
          String(
    *       j.usuario_id
          ) ==*
          String(
            jug*dor2
          )
      );

    set*atos1(j1);
    setDatos2(j2);
  };*
  return (

    <div className="m*x-w-5xl mx-auto p-6">

      <div *lassName="flex justify-between mb-*">

        <h1 className="text-3x* font-bold">
          ⚔️ Comparad*r de Jugadores
        </h1>

    *   <Link
          to="/historico"*          className="
            *g-blue-600
            text-white
*           px-4
            py-2
 *          rounded
          "
    *   >
          Regresar
        </*ink>

      </div>

      <div cla*sName="grid md:grid-cols-2 gap-4 m*-4">

        <select
          va*ue={jugador1}
          onChange={*e) =>
            setJugador1(
   *          e.target.value
         *  )
          }
          classNam*="
            border
            *ounded
            p-2
          "*        >

          <option value*"">
            Jugador 1
        * </option>

          {jugadores.m*p(
            (j) => (

         *    <option
                key={j*usuario_id}
                value=*j.usuario_id}
              >
    *           {j.nombre_usuario}
    *         </option>

            )
*         )}

        </select>

  *     <select
          value={juga*or2}
          onChange={(e) =>
  *         setJugador2(
            * e.target.value
            )
    *     }
          className="
     *      border
            rounded
 *          p-2
          "
        *

          <option value="">
    *       Jugador 2
          </optio*>

          {jugadores.map(
     *      (j) => (

              <opt*on
                key={j.usuario_*d}
                value={j.usuari*_id}
              >
             *  {j.nombre_usuario}
             *</option>

            )
         *)}

        </select>

      </div*

      <button
        onClick={c*mparar}
        className="
      *   bg-green-600
          text-whi*e
          px-4
          py-2
  *       rounded
          mb-6
    *   "
      >
        Comparar
    * </button>

      {datos1 && datos* && (

        <div className="
  *       bg-white
          shadow
 *        rounded
          p-6
    *   ">

          <table className=*w-full">

            <thead>

   *          <tr>

                <t*></th>

                <th>
     *            {datos1.nombre_usuario*
                </th>

          *     <th>
                  {datos*.nombre_usuario}
                <*th>

              </tr>

        *   </thead>

            <tbody>

*             <tr>

               *<td>
                  🏆 Aciertos*                </td>

           *    <td>
                  {datos1*aciertos_totales}
                */td>

                <td>
       *          {datos2.aciertos_totales*
                </td>

          *   </tr>

              <tr>

    *           <td>
                  *� Jornadas
                </td>

*               <td>
              *   {datos1.jornadas_jugadas}
     *          </td>

                <*d>
                  {datos2.jorna*as_jugadas}
                </td>
*              </tr>

             *<tr>

                <td>
       *          🎯 Promedio
            *   </td>

                <td>
   *              {datos1.promedio}
  *             </td>

              * <td>
                  {datos2.pr*medio}
                </td>

    *         </tr>

            </tbod*>

          </table>

        </d*v>

      )}

    </div>

  );
}
`*