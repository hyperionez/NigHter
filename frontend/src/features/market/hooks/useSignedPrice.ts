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
      ? 'The price service is unreachable, so no signed report can be attached to a transaction.'
      : state === 'stale'
        ? 'The latest signed report is past the staleness window, so the chain would reject it.'
        : state === 'loading'
          ? 'Waiting for the first signed price report.'
          : undefined

  return { report, ageMs, isStale, isPending: enabled && query.isPending, error, state, blockedReason }
}
