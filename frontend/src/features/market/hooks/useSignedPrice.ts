import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSignedPrice, type SignedPriceReport } from '@/lib/priceFeed.ts'

export const SIGNED_PRICE_POLL_MS = 5_000

export interface SignedPriceState {
  report: SignedPriceReport | undefined
  ageMs: number | undefined
  isStale: boolean
  isPending: boolean
  error: Error | undefined
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

  return {
    report,
    ageMs,
    isStale: ageMs !== undefined && stalenessWindowMs !== undefined && ageMs > stalenessWindowMs,
    isPending: enabled && query.isPending,
    error: enabled ? (query.error as Error | undefined) : undefined,
  }
}
