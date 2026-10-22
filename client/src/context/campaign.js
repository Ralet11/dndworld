import { createContext, useContext } from 'react';

export const CampaignContext = createContext(undefined);

export function useCampaign() {
  const value = useContext(CampaignContext);
  if (!value) throw new Error('useCampaign must be inside CampaignProvider');
  return value;
}
