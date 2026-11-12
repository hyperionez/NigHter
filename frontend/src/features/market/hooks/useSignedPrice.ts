import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSignedPrice, type SignedPriceReport } from '@/lib/priceFeed.ts'

export const SIGNED_PRICE_POLL_MS = 5_000

export const AGING_FRACTION = 1 / 3

export type PriceFeedState = 'off' | 'loading' | 'unavailable' | 'fresh' | 'aging' | 'stale'

export interface SignedPriceState {
  report: SignedPriceReport | undefined
  ageMs: number | undefined
  isStale: boolean
  isPending: boolean
  error: Error | undefined
  state: PriceFeedState
  stateLabel: string
  blockedReason: string | undefined
}

export function useSignedPrice(enabled: boolean, stalenessWindowMs?: number): SignedPriceState {
  const query = useQuery({
    queryKey: ['signedPrice'],
    enabled,
    retry: false,
    refetchInterval: SIGNED_PRICE_POLL_MS,
    queryFn: ({ signal }) => fetchSignedPrice(signal),
  })

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [enabled])

  const report = enabled ? query.data : undefined
  const ageMs = report ? Number(BigInt(now) - report.timestampMs) : undefined
  const error = enabled ? (query.error as Error | undefined) : undefined
  const isStale = ageMs !== undefined && stalenessWindowMs !== undefined && ageMs > stalenessWindowMs

  const state: PriceFeedState = !enabled
    ? 'off'
    : error
      ? 'unavailable'
      : ageMs === undefined || stalenessWindowMs === undefined
        ? 'loading'
        : isStale
          ? 'stale'
          : ageMs > stalenessWindowMs * AGING_FRACTION
            ? 'aging'
            : 'fresh'

  const blockedReason =
    state === 'unavailable'
      ? 'The price service is not responding, so no fresh price can be attached to a trade.'
      : state === 'stale'
        ? 'The latest price is older than this market allows, so the chain would turn the trade down.'
        : state === 'loading'
          ? 'Waiting for the first price update.'
          : undefined

  const stateLabel =
    state === 'unavailable'
      ? 'not responding'
      : state === 'stale'
        ? 'out of date'
        : state === 'loading'
          ? 'starting up'
          : state

  return {
    report,
    ageMs,
    isStale,
    isPending: enabled && query.isPending,
    error,
    state,
    stateLabel,
    blockedReason,
  }
}
