import { useOnChainObject } from '../hooks/useOnChainObject.ts'
import { useLivePrice } from '../hooks/useLivePrice.ts'
import { config } from '../config.ts'
import { formatUsdcAmount, formatScaledPrice, formatBpsAsPercent } from '../format.ts'
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
  const market = useOnChainObject(config.marketId)
  const vault = useOnChainObject(config.vaultId)
  const livePrice = useLivePrice()

  if (market.isPending || vault.isPending) {
    return <p>Loading market data...</p>
  }
  if (market.isError || vault.isError) {
    return (
      <p className="error">
        Failed to load on-chain data: {String(market.error ?? vault.error)}
      </p>
    )
  }

  const m = market.data
  const v = vault.data

  return (
    <section className="market-dashboard">
      <h2>Market</h2>
      <div className="stat-grid">
        <Stat
          label="Live price (Pyth)"
          value={
            livePrice.data !== undefined
              ? `$${formatScaledPrice(livePrice.data)}`
              : livePrice.isError
                ? 'unavailable (Hermes needs an API key as of 2026-08-26)'
                : 'loading...'
          }
        />
        <Stat label="Long open interest" value={`$${formatUsdcAmount(m.long_open_interest as string)}`} />
        <Stat label="Short open interest" value={`$${formatUsdcAmount(m.short_open_interest as string)}`} />
        <Stat label="Max open interest" value={`$${formatUsdcAmount(m.max_open_interest as string)}`} />
        <Stat label="Initial margin" value={formatBpsAsPercent(m.initial_margin_bps as string)} />
        <Stat label="Maintenance margin" value={formatBpsAsPercent(m.maintenance_margin_bps as string)} />
        <Stat label="Open fee" value={formatBpsAsPercent(m.open_fee_bps as string)} />
        <Stat label="Close fee" value={formatBpsAsPercent(m.close_fee_bps as string)} />
        <Stat label="Funding rate / hour" value={formatBpsAsPercent(m.funding_rate_bps_per_hour as string)} />
        <Stat label="Paused" value={m.paused ? 'yes' : 'no'} />
        <Stat label="Vault TVL" value={`$${formatUsdcAmount(v.balance as string)}`} />
        <Stat label="LP shares outstanding" value={String(v.lp_supply)} />
      </div>
    </section>
  )
}
