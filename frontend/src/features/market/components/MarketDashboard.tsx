import { useMarket, useVault } from '../hooks/useMarket.ts'
import { useSignedPrice } from '../hooks/useSignedPrice.ts'
import { formatUsdc, formatPrice, formatBps, maxLeverageFrom } from '@/lib/format.ts'
import './MarketDashboard.css'

function Cell({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="bar-cell">
      <span className="stat-label">{label}</span>
      {value !== undefined && <span className="stat-value">{value}</span>}
      {children}
    </div>
  )
}

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="param">
      <span className="stat-label">{label}</span>
      <span className="param-value">{value}</span>
    </div>
  )
}

function formatAge(ageMs: number | undefined): string {
  if (ageMs === undefined) return 'no report'
  return `${(ageMs / 1000).toFixed(1)}s ago`
}

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
  const markPriceLabel = signedMode && signed.report === undefined
    ? signed.error
      ? 'unavailable'
      : 'loading...'
    : `$${formatPrice(markPrice)}`

  const longOi = Number(market.longOpenInterest)
  const shortOi = Number(market.shortOpenInterest)
  const totalOi = longOi + shortOi
  const longShare = totalOi > 0 ? (longOi / totalOi) * 100 : 50

  return (
    <section className="market-dashboard">
      <div className="market-heading">
        <h2>BTC-PERP-DEMO</h2>
        {signedMode ? (
          <span className="badge badge-signed">signed price feed</span>
        ) : (
          market.demoMode && <span className="badge">demo market, mock price</span>
        )}
        {signed.isStale && <span className="badge badge-warn">price stale</span>}
        {market.paused && <span className="badge badge-warn">paused</span>}
      </div>

      {signed.blockedReason && (
        <p className="feed-banner">
          <strong>Signed price feed {signed.state}.</strong> {signed.blockedReason}
          {signed.error && <span className="feed-detail">{signed.error.message}</span>}
        </p>
      )}

      <div className="market-bar">
        <Cell label="Mark price" value={markPriceLabel}>
          {signedMode && (
            <span className={`cell-note feed-${signed.state}`}>
              <span className="feed-dot" aria-hidden="true" />
              {formatAge(signed.ageMs)}
              <span className="feed-window">of {market.maxPriceStalenessSecs}s</span>
            </span>
          )}
        </Cell>

        <Cell label="Open interest">
          <div className="oi-values">
            <span className="oi-long">${formatUsdc(market.longOpenInterest)}</span>
            <span className="oi-sep">/</span>
            <span className="oi-short">${formatUsdc(market.shortOpenInterest)}</span>
          </div>
          <div className="oi-ratio" aria-hidden="true">
            <span className="oi-ratio-long" style={{ width: `${longShare}%` }} />
            <span className="oi-ratio-short" style={{ width: `${100 - longShare}%` }} />
          </div>
        </Cell>

        <Cell label="Funding / 1h" value={formatBps(market.fundingRateBpsPerHour)} />
        <Cell label="Vault TVL" value={`$${formatUsdc(vault.balance)}`} />
        <Cell label="Max leverage" value={`${maxLeverageFrom(market.initialMarginBps)}x`} />
      </div>

      <details className="market-params">
        <summary>Market parameters</summary>
        <div className="param-grid">
          <Param label="Max open interest" value={`$${formatUsdc(market.maxOpenInterest)}`} />
          <Param label="Min position size" value={`$${formatUsdc(market.minPositionSize)}`} />
          <Param label="Maintenance margin" value={formatBps(market.maintenanceMarginBps)} />
          <Param label="Initial margin" value={formatBps(market.initialMarginBps)} />
          <Param label="Open fee" value={formatBps(market.openFeeBps)} />
          <Param label="Close fee" value={formatBps(market.closeFeeBps)} />
          <Param label="Liquidation penalty" value={formatBps(market.liquidationPenaltyBps)} />
          <Param label="Keeper reward" value={formatBps(market.keeperRewardBps)} />
          <Param label="Price staleness window" value={`${market.maxPriceStalenessSecs}s`} />
          <Param label="LP shares" value={formatUsdc(vault.lpSupply)} />
        </div>
      </details>
    </section>
  )
}
