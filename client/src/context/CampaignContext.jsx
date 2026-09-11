import { createContext, useContext, useEffect, useState } from 'react';
import API_URL from '../config';
import { useSocket } from './SocketContext';

const CampaignContext = createContext(undefined);

export function CampaignProvider({ children }) {
  const { socket, connected } = useSocket();
  const [campaigns, setCampaigns] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [campaignReady, setCampaignReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const response = await fetch(`${API_URL}/api/campaigns`, { headers: { Authorization: `Bearer ${localStorage.getItem('dnd_token')}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudieron cargar las campañas.');
    setCampaigns(data.campaigns || []);
    const savedId = localStorage.getItem('dnd_campaign_id');
    setCampaign(current => (data.campaigns || []).find(item => item.id === current?.id || item.id === savedId) || null);
  };

  useEffect(() => { refresh().catch(() => setCampaigns([])).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!campaign || !socket || !connected) return undefined;
    let cancelled = false;
    let attempts = 0;
    let retryTimer;
    const activateCampaign = () => {
      attempts += 1;
      // The REST list already verified that this user may access the campaign.
      // Do not block the entire application while the live-table socket catches up.
      setCampaignReady(true);
      socket.timeout(5000).emit('campaign:select', { campaignId: campaign.id }, (timeoutError, response) => {
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
  }, [campaign?.id, socket, connected]);
  const selectCampaign = next => { localStorage.setItem('dnd_campaign_id', next.id); setCampaignReady(false); setCampaign(next); };
  return <CampaignContext.Provider value={{ campaigns, campaign, campaignReady, loading, refresh, selectCampaign }}>{children}</CampaignContext.Provider>;
}

export function useCampaign() {
  const value = useContext(CampaignContext);
  if (!value) throw new Error('useCampaign must be inside CampaignProvider');
  return value;
}
