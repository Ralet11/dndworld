import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../../api/client";
import useAuth from "../../store/useAuth";

export default function CampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  const [data, setData] = useState(null);
  const [news, setNews] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/campaigns/${id}`).then((r) => setData(r.data));
    api
      .get(`/campaigns/${id}/news`)
      .then((r) => setNews(r.data))
      .catch(() => setNews([]));
  }, [id]);

  // 👉 INICIAR / CONTINUAR SESIÓN
  const startOrResumeSession = async () => {
    try {
      setBusy(true);
      // 1) ¿Hay sesión OPEN existente?
      const open = await api.get(`/sessions`, {
        params: { campaignId: id, status: "OPEN" },
      });
      if (Array.isArray(open.data) && open.data.length) {
        return nav(`/sesion/${open.data[0].id}`);
      }

      // 2) Si no hay, elegimos un escenario (primero de la campaña, si existe)
      let scenarioId = null;
      try {
        const sc = await api.get(`/scenarios/by-campaign/${id}`);
        scenarioId =
          Array.isArray(sc.data) && sc.data.length ? sc.data[0].id : null;
      } catch {}

      // 3) Creamos sesión
      const { data: created } = await api.post(`/sessions`, {
        campaignId: id,
        scenarioId, // puede ir null si tu API lo permite
        status: "OPEN",
      });
      nav(`/sesion/${created.id}`);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div>Cargando…</div>;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-sm opacity-70">{data.status}</div>
        <h2 className="text-xl font-semibold">{data.name}</h2>
        <p className="opacity-80">{data.description}</p>

        {user?.roles?.includes("DM") && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <button className="btn" onClick={startOrResumeSession} disabled={busy}>
              {busy ? "Preparando…" : "Iniciar/Continuar Sesión"}
            </button>
            <Link to={`/dm/campanias/${id}/escenarios`} className="btn">
              Escenarios
            </Link>
            <Link to={`/campanias/${id}/miembros`} className="btn">
              Miembros
            </Link>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold mb-2">Noticias</h3>
        <div className="space-y-2">
          {news.length === 0 && <div className="opacity-70">Sin noticias</div>}
          {news.map((n) => (
            <div key={n.id} className="card">
              <div className="text-sm opacity-70">{n.kind}</div>
              <div className="font-semibold">{n.title}</div>
              <p className="opacity-80">{n.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
