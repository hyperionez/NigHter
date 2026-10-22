import { checkLiquidatable, type OnChainMarket } from '@perp-dex/shared'
import { useMarket } from '@/features/market/hooks/useMarket.ts'
import { usePositions } from '../hooks/usePositions.ts'
import { useClosePosition } from '../hooks/useClosePosition.ts'
import { formatUsdc, formatPrice, formatBps } from '@/lib/format.ts'
import './PositionList.css'

export function PositionList() {
  const { market } = useMarket()
  const { data: positions, isPending } = usePositions()
  const closePosition = useClosePosition()

  if (isPending) return <p className="muted">Loading positions...</p>
  if (!market) return null
  if (!positions || positions.length === 0) {
    return <p className="muted">No open positions.</p>
  }

  const marketState: OnChainMarket = {
    maintenanceMarginBps: BigInt(market.maintenanceMarginBps),
    mockPrice: BigInt(market.mockPrice),
    cumulativeFundingLongCharge: BigInt(market.cumulativeFundingLongCharge),
    cumulativeFundingLongCredit: BigInt(market.cumulativeFundingLongCredit),
    cumulativeFundingShortCharge: BigInt(market.cumulativeFundingShortCharge),
    cumulativeFundingShortCredit: BigInt(market.cumulativeFundingShortCredit),
  }
  const markPrice = BigInt(market.mockPrice)

  return (
    <section className="positions">
      <h2>Your positions</h2>
      <table className="position-table">
        <thead>
          <tr>
            <th>Side</th>
            <th className="num">Size</th>
            <th className="num">Collateral</th>
            <th className="num">Entry</th>
            <th className="num">Mark</th>
            <th className="num">PnL</th>
            <th className="num">Margin</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const health = checkLiquidatable(p, marketState, markPrice)
            const pnlSign = health.netIsProfit ? '+' : '-'
            const marginPct = Number(health.marginRatioBps) / 100
            const maintenancePct = Number(market.maintenanceMarginBps) / 100
            const healthWidth = Math.max(0, Math.min(100, (marginPct / (maintenancePct * 4)) * 100))

            return (
              <tr key={p.id}>
                <td>
                  <span className={p.isLong ? 'side-long' : 'side-short'}>
                    {p.isLong ? 'Long' : 'Short'}
                  </span>
                </td>
                <td className="num">${formatUsdc(p.size)}</td>
                <td className="num">${formatUsdc(p.collateral)}</td>
                <td className="num">{formatPrice(p.entryPrice)}</td>
                <td className="num">{formatPrice(markPrice)}</td>
                <td className={health.netIsProfit ? 'num pnl-up' : 'num pnl-down'}>
                  {pnlSign}${formatUsdc(health.netResult)}
                </td>
                <td className="num">
                  <div className="margin-cell">
                    <span>{formatBps(health.marginRatioBps.toString())}</span>
                    <div className="health-track">
                      <div
                        className={health.liquidatable ? 'health-bar health-danger' : 'health-bar'}
                        style={{ width: `${healthWidth}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    className="close-btn"
                    disabled={closePosition.isPending}
                    onClick={() => closePosition.mutate({ positionId: p.id })}
                  >
                    {closePosition.isPending ? '...' : 'Close'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {closePosition.isError && <p className="error">{closePosition.error.message}</p>}
    </section>
  )
}
