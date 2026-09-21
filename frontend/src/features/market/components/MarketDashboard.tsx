import { useMarket, useVault } from '../hooks/useMarket.ts'
import { formatUsdc, formatPrice, formatBps } from '@/lib/format.ts'
import './MarketDashboard.css'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

export function MarketDashboard() {
  const { market, isPending: marketPending, isError: marketError } = useMarket()
  const { vault, isPending: vaultPending, isError: vaultError } = useVault()

  if (marketPending || vaultPending) return <p>Loading market data...</p>
  if (marketError || vaultError || !market || !vault) {
    return <p className="error">Failed to load on-chain market data.</p>
  }

  return (
    <section className="market-dashboard">
      <div className="market-heading">
        <h2>BTC-PERP-DEMO</h2>
        {market.demoMode && <span className="badge">demo market — mock price</span>}
        {market.paused && <span className="badge badge-warn">paused</span>}
      </div>
      <div className="stat-grid">
        <Stat label="Mark price" value={`$${formatPrice(market.mockPrice)}`} />
        <Stat label="Long open interest" value={`$${formatUsdc(market.longOpenInterest)}`} />
        <Stat label="Short open interest" value={`$${formatUsdc(market.shortOpenInterest)}`} />
        <Stat label="Max open interest" value={`$${formatUsdc(market.maxOpenInterest)}`} />
        <Stat label="Min position size" value={`$${formatUsdc(market.minPositionSize)}`} />
        <Stat label="Max leverage" value={`${10_000 / Number(market.initialMarginBps)}x`} />
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
