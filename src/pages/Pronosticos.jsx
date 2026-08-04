import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Pronosticos() {

  const navigate = useNavigate();

  useEffect(() => {

    const autorizado =
      sessionStorage.getItem(
        "pronosticos_autorizado"
      );

    if (!autorizado) {

      navigate(
        "/acceso-pronosticos"
      );

    }

  }, [navigate]);

  return (

    <div className="p-6">

      <h1 className="text-3xl font-bold">
        📈 Pronósticos Deportivos
      </h1>

    </div>

  );

}