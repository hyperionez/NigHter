import { useMarket, useVault } from '../hooks/useMarket.ts'
import { useSignedPrice } from '../hooks/useSignedPrice.ts'
import { formatUsdc, formatPrice, formatBps, maxLeverageFrom } from '@/lib/format.ts'
import './MarketDashboard.css'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

function formatAge(ageMs: number | undefined): string {
  if (ageMs === undefined) return 'n/a'
  return `${(ageMs / 1000).toFixed(1)}s ago`
}

export function MarketDashboard() {
  const { market, isPending: marketPending, isError: marketError } = useMarket()
  const { vault, isPending: vaultPending, isError: vaultError } = useVault()

  const signedMode = market?.usesSignedPrice === true
  const stalenessWindowMs = market ? Number(market.maxPriceStalenessSecs) * 1000 : undefined
  const signed = useSignedPrice(signedMode, stalenessWindowMs)

  if (marketPending || vaultPending) return <p>Loading market data...</p>
  if (marketError || vaultError || !market || !vault) {
    return <p className="error">Failed to load on-chain market data.</p>
  }

  const markPrice = signedMode ? signed.report?.price : BigInt(market.mockPrice)
  const markPriceLabel = signedMode && signed.report === undefined
    ? signed.error
      ? 'unavailable'
      : 'loading...'
    : `$${formatPrice(markPrice)}`

  return (
    <section className="market-dashboard">
      <div className="market-heading">
        <h2>BTC-PERP-DEMO</h2>
        {signedMode ? (
          <span className="badge">signed price feed</span>
        ) : (
          market.demoMode && <span className="badge">demo market — mock price</span>
        )}
        {signed.isStale && <span className="badge badge-warn">price stale</span>}
        {market.paused && <span className="badge badge-warn">paused</span>}
      </div>

      {signedMode && signed.error && (
        <p className="error">{signed.error.message}</p>
      )}

      <div className="stat-grid">
        <Stat label={signedMode ? 'Mark price (signed)' : 'Mark price'} value={markPriceLabel} />
        {signedMode && (
          <Stat
            label={`Price age (max ${market.maxPriceStalenessSecs}s)`}
            value={formatAge(signed.ageMs)}
          />
        )}
        <Stat label="Long open interest" value={`$${formatUsdc(market.longOpenInterest)}`} />
        <Stat label="Short open interest" value={`$${formatUsdc(market.shortOpenInterest)}`} />
        <Stat label="Max open interest" value={`$${formatUsdc(market.maxOpenInterest)}`} />
        <Stat label="Min position size" value={`$${formatUsdc(market.minPositionSize)}`} />
        <Stat label="Max leverage" value={`${maxLeverageFrom(market.initialMarginBps)}x`} />
        <Stat label="Maintenance margin" value={formatBps(market.maintenanceMarginBps)} />
        <Stat label="Open / close fee" value={`${formatBps(market.openFeeBps)} / ${formatBps(market.closeFeeBps)}`} />
        <Stat label="Funding rate / hour" value={formatBps(market.fundingRateBpsPerHour)} />
        <Stat label="Liquidation penalty" value={formatBps(market.liquidationPenaltyBps)} />
        <Stat label="Vault TVL" value={`$${formatUsdc(vault.balance)}`} />
        <Stat label="LP shares" value={formatUsdc(vault.lpSupply)} />
      </div>
    </section>
  )
}
