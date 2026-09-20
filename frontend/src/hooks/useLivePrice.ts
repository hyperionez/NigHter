import { useQuery } from '@tanstack/react-query'
import { fetchLivePrice } from '@perp-dex/shared'
import { config } from '../config.ts'

export function useLivePrice() {
  return useQuery({
    queryKey: ['livePrice', config.pythFeedId],
    queryFn: () => fetchLivePrice(config.pythFeedId, config.pythApiKey),
    refetchInterval: 10_000,
    retry: false,
  })
}
