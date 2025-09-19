import { useCallback, useEffect } from 'react'
import { getCampaigns } from '../api/campaigns'
import { useSessionStore } from '../store/useSessionStore'

const isAbortError = (error) => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'

export const useCampaignList = () => {
  const campaigns = useSessionStore((state) => state.session.campaigns)
  const setCampaigns = useSessionStore((state) => state.setCampaigns)
  const setLoading = useSessionStore((state) => state.setLoading)
  const setError = useSessionStore((state) => state.setError)
  const isLoading = useSessionStore((state) => state.isLoading)
  const error = useSessionStore((state) => state.error)

  const fetchCampaigns = useCallback(
    async ({ signal } = {}) => {
      setLoading(true)
      setError(null)

      try {
        const data = await getCampaigns({ signal })
        setCampaigns(data)
        return data
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
    [setCampaigns, setError, setLoading],
  )

  useEffect(() => {
    const controller = new AbortController()

    fetchCampaigns({ signal: controller.signal }).catch((err) => {
      if (isAbortError(err)) return
      console.error('Failed to load campaigns', err)
    })

    return () => controller.abort()
  }, [fetchCampaigns])

  return {
    campaigns,
    isLoading,
    error,
    refetch: () => fetchCampaigns(),
  }
}
