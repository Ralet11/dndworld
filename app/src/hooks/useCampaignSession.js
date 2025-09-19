import { useCallback, useEffect, useMemo } from 'react'
import { getCampaignById } from '../api/campaigns'
import { useSessionStore } from '../store/useSessionStore'

const isAbortError = (error) => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'

export const useCampaignSession = (campaignId, { role } = {}) => {
  const session = useSessionStore((state) => state.session)
  const assignCampaign = useSessionStore((state) => state.assignCampaign)
  const setLoading = useSessionStore((state) => state.setLoading)
  const setError = useSessionStore((state) => state.setError)
  const isLoading = useSessionStore((state) => state.isLoading)
  const error = useSessionStore((state) => state.error)

  const fetchCampaign = useCallback(
    async ({ signal } = {}) => {
      if (!campaignId) return null

      setLoading(true)
      setError(null)

      try {
        const campaign = await getCampaignById(campaignId, { signal })
        assignCampaign(role ? { ...campaign, role } : campaign)
        return campaign
      } catch (err) {
        if (signal?.aborted || isAbortError(err)) {
          return null
        }
        setError(err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [campaignId, role, assignCampaign, setLoading, setError],
  )

  useEffect(() => {
    if (!campaignId) return undefined

    const controller = new AbortController()

    fetchCampaign({ signal: controller.signal }).catch((err) => {
      if (isAbortError(err)) return
      console.error('Failed to load campaign', err)
    })

    return () => controller.abort()
  }, [campaignId, fetchCampaign])

  const campaign = useMemo(
    () => session.campaigns.find((c) => c.id === session.activeCampaignId) ?? null,
    [session.campaigns, session.activeCampaignId],
  )

  return {
    campaign,
    isLoading,
    error,
    refetch: () => fetchCampaign(),
  }
}
