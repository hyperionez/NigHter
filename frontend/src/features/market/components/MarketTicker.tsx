import { useQuery } from '@tanstack/react-query'
import { CHART_SYMBOL } from '@/config/index.ts'
import { formatPrice } from '@/lib/format.ts'
import { useMarket } from '../hooks/useMarket.ts'
import { useSignedPrice } from '../hooks/useSignedPrice.ts'
import './MarketTicker.css'

const MARKET_SYMBOL = 'BTC-PERP-DEMO'

async function fetchDailyChange(signal: AbortSignal): Promise<number> {
  const response = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${CHART_SYMBOL}`,
    { signal },
  )
  if (!response.ok) throw new Error(`Binance ticker returned ${response.status}`)
  const body = (await response.json()) as { priceChangePercent: string }
  return Number(body.priceChangePercent)
}

export function MarketTicker() {
  const { market } = useMarket()
  const signedMode = market?.usesSignedPrice === true
  const stalenessWindowMs = market ? Number(market.maxPriceStalenessSecs) * 1000 : undefined
  const signed = useSignedPrice(signedMode, stalenessWindowMs)

  const { data: changePct } = useQuery({
    queryKey: ['dailyChange'],
    retry: false,
    refetchInterval: 30_000,
    queryFn: ({ signal }) => fetchDailyChange(signal),
  })

  if (!market) return null

  const markPrice = signedMode ? signed.report?.price : BigInt(market.mockPrice)

  return (
    <div className="ticker">
      <span className="market-pill">{MARKET_SYMBOL}</span>

      <span className={signedMode ? 'badge badge-signed' : 'badge'}>
        {signedMode ? 'Live price' : 'Demo price'}
      </span>

      <div className="ticker-price">
        <span className="ticker-mark">
          {markPrice === undefined ? '--' : `$${formatPrice(markPrice)}`}
        </span>

        {changePct !== undefined && (
          <span className={changePct >= 0 ? 'ticker-change num-long' : 'ticker-change num-short'}>
            {changePct >= 0 ? '+' : ''}
            {changePct.toFixed(2)}%
          </span>
        )}

        {signedMode && (
          <span className={`ticker-age feed-${signed.state}`}>
            <span className="feed-dot" aria-hidden="true" />
            {signed.ageMs === undefined ? 'no price' : `${(signed.ageMs / 1000).toFixed(0)}s old`}
          </span>
        )}
      </div>

      {market.paused && <span className="badge badge-warn">Trading off</span>}
    </div>
  )
}
