import { useEffect, useState, useCallback } from 'react';
import API_URL from '../config';
import { useSocket } from './SocketContext';

import { CampaignContext } from './campaign';

async function fetchCampaigns() {
  const response = await fetch(`${API_URL}/api/campaigns`, { headers: { Authorization: `Bearer ${localStorage.getItem('dnd_token')}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'No se pudieron cargar las campañas.');
  return data;
}

export function CampaignProvider({ children }) {
  const { socket, connected } = useSocket();
  const [campaigns, setCampaigns] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const campaignReady = Boolean(campaign);
  const campaignId = campaign?.id;
  const [loading, setLoading] = useState(true);

  const applyCampaigns = useCallback(data => {
    setCampaigns(data.campaigns || []);
    const savedId = localStorage.getItem('dnd_campaign_id');
    setCampaign(current => (data.campaigns || []).find(item => item.id === current?.id || item.id === savedId) || null);
  }, []);
  const refresh = useCallback(() => fetchCampaigns().then(applyCampaigns), [applyCampaigns]);

  useEffect(() => {
    let active = true;
    fetchCampaigns().then(data => { if (active) applyCampaigns(data); })
      .catch(() => { if (active) setCampaigns([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyCampaigns]);
  useEffect(() => {
    if (!campaignId) return undefined;
    // Campaign access is already authorized by REST. The socket is only needed
    // for live-table state and must not prevent navigation through the app.
    if (!socket || !connected) return undefined;
    let cancelled = false;
    let attempts = 0;
    let retryTimer;
    const activateCampaign = () => {
      attempts += 1;
      socket.timeout(5000).emit('campaign:select', { campaignId }, (timeoutError, response) => {
        if (cancelled) return;
        if (!timeoutError && response?.ok) {
          return;
        }
        if (attempts < 3) {
          retryTimer = window.setTimeout(activateCampaign, 800);
        }
      });
    };
    activateCampaign();
    return () => { cancelled = true; window.clearTimeout(retryTimer); };
  }, [campaignId, socket, connected]);
  const selectCampaign = next => { localStorage.setItem('dnd_campaign_id', next.id); setCampaign(next); };
  return <CampaignContext.Provider value={{ campaigns, campaign, campaignReady, loading, refresh, selectCampaign }}>{children}</CampaignContext.Provider>;
}
