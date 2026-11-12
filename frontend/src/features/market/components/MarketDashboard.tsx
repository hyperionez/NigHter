import { useMarket, useVault } from '../hooks/useMarket.ts'
import { useSignedPrice } from '../hooks/useSignedPrice.ts'
import { formatUsdc, formatPrice, formatBps, maxLeverageFrom } from '@/lib/format.ts'
import './MarketDashboard.css'

export function MarketDashboard() {
  const { market, isPending: marketPending, isError: marketError } = useMarket()
  const { vault, isPending: vaultPending, isError: vaultError } = useVault()

  const signedMode = market?.usesSignedPrice === true
  const stalenessWindowMs = market ? Number(market.maxPriceStalenessSecs) * 1000 : undefined
  const signed = useSignedPrice(signedMode, stalenessWindowMs)

  if (marketPending || vaultPending) return <p className="muted">Loading market data...</p>
  if (marketError || vaultError || !market || !vault) {
    return <p className="error">Failed to load on-chain market data.</p>
  }

  const markPrice = signedMode ? signed.report?.price : BigInt(market.mockPrice)
  const longOi = Number(market.longOpenInterest)
  const shortOi = Number(market.shortOpenInterest)
  const totalOi = longOi + shortOi
  const longShare = totalOi > 0 ? (longOi / totalOi) * 100 : 50

  return (
    <>
      {signed.blockedReason && (
        <p className="feed-banner">
          <strong>Price feed is {signed.stateLabel}.</strong> {signed.blockedReason}
          {signed.error && <span className="feed-detail">{signed.error.message}</span>}
        </p>
      )}

      <div className="market-bar">
        <div className="bar-cell">
          <span className="stat-label">Current price</span>
          <span className="stat-value">
            {markPrice === undefined ? '--' : `$${formatPrice(markPrice)}`}
          </span>
          {signedMode && (
            <span className={`cell-note feed-${signed.state}`}>
              <span className="feed-dot" aria-hidden="true" />
              {signed.ageMs === undefined ? 'no price yet' : `${(signed.ageMs / 1000).toFixed(1)}s old`}
              <span className="feed-window">max {market.maxPriceStalenessSecs}s</span>
            </span>
          )}
        </div>

        <div className="bar-cell">
          <span className="stat-label">Long vs short</span>
          <div className="oi-values">
            <span className="num-long">${formatUsdc(market.longOpenInterest)}</span>
            <span className="oi-sep">/</span>
            <span className="num-short">${formatUsdc(market.shortOpenInterest)}</span>
          </div>
          <div className="meter" aria-hidden="true">
            <span className="meter-long" style={{ width: `${longShare}%` }} />
            <span className="meter-short" style={{ width: `${100 - longShare}%` }} />
          </div>
        </div>

        <div className="bar-cell">
          <span className="stat-label">Hourly rate</span>
          <span className="stat-value">{formatBps(market.fundingRateBpsPerHour)}</span>
        </div>

        <div className="bar-cell">
          <span className="stat-label">Pool size</span>
          <span className="stat-value">${formatUsdc(vault.balance)}</span>
        </div>

        <div className="bar-cell">
          <span className="stat-label">Max multiplier</span>
          <span className="stat-value">{maxLeverageFrom(market.initialMarginBps)}x</span>
        </div>
      </div>
    </>
  )
}
