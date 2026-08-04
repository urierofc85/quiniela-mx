import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AccesoPronosticos() {

  const navigate = useNavigate();

  const [password, setPassword] =
    useState("");

  const validarAcceso = () => {

    if (password === "Pronosticos2026") {

      sessionStorage.setItem(
        "pronosticos_autorizado",
        "true"
      );

      navigate(
        "/pronosticos"
      );

      return;

    }

    alert(
      "Contraseña incorrecta"
    );

  };

  return (

    <div className="max-w-md mx-auto p-6">

      <h1 className="text-3xl font-bold mb-6">
        🔒 Acceso Privado
      </h1>

      <div className="bg-white shadow rounded p-6">

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) =>
            setPassword(
              e.target.value
            )
          }
          className="
            w-full
            border
            rounded
            p-3
            mb-4
          "
        />

        <button
          onClick={validarAcceso}
          className="
            w-full
            bg-blue-600
            text-white
            py-3
            rounded
          "
        >
          Ingresar
        </button>

      </div>

    </div>

  );

}