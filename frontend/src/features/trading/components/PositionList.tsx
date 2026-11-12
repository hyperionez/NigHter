import { checkLiquidatable, type OnChainMarket } from '@perp-dex/shared'
import { useMarket } from '@/features/market/hooks/useMarket.ts'
import { useSignedPrice } from '@/features/market/hooks/useSignedPrice.ts'
import { usePositions } from '../hooks/usePositions.ts'
import { useClosePosition } from '../hooks/useClosePosition.ts'
import { formatUsdc, formatPrice, formatBps } from '@/lib/format.ts'
import './PositionList.css'

export function PositionList() {
  const { market } = useMarket()
  const { data: positions, isPending } = usePositions()
  const closePosition = useClosePosition()

  const signedMode = market?.usesSignedPrice === true
  const stalenessWindowMs = market ? Number(market.maxPriceStalenessSecs) * 1000 : undefined
  const signed = useSignedPrice(signedMode, stalenessWindowMs)

  if (!market) return null

  if (isPending || !positions || positions.length === 0) {
    return (
      <section className="positions">
        <h2>Your positions</h2>
        <div className="positions-empty">
          <p className="muted">
            {isPending ? 'Loading positions...' : 'No open positions yet.'}
          </p>
          {!isPending && (
            <p className="hint">
              An open position appears here with live PnL and its margin ratio against the{' '}
              {Number(market.maintenanceMarginBps) / 100}% maintenance floor.
            </p>
          )}
        </div>
      </section>
    )
  }

  const marketState: OnChainMarket = {
    maintenanceMarginBps: BigInt(market.maintenanceMarginBps),
    mockPrice: BigInt(market.mockPrice),
    cumulativeFundingLongCharge: BigInt(market.cumulativeFundingLongCharge),
    cumulativeFundingLongCredit: BigInt(market.cumulativeFundingLongCredit),
    cumulativeFundingShortCharge: BigInt(market.cumulativeFundingShortCharge),
    cumulativeFundingShortCredit: BigInt(market.cumulativeFundingShortCredit),
  }
  const markPrice = signedMode ? signed.report?.price : BigInt(market.mockPrice)
  const closeBlockedReason = market.paused
    ? 'The market is paused. Liquidation and funding keep running, but closes are rejected on chain.'
    : signed.blockedReason
  const maintenancePct = Number(market.maintenanceMarginBps) / 100

  return (
    <section className="positions">
      <h2>Your positions</h2>

      {closeBlockedReason && (
        <p className="feed-banner">
          <strong>Closing unavailable.</strong> {closeBlockedReason}
        </p>
      )}

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
            const health =
              markPrice === undefined ? undefined : checkLiquidatable(p, marketState, markPrice)
            const marginPct = health ? Number(health.marginRatioBps) / 100 : 0
            const healthWidth = Math.max(0, Math.min(100, (marginPct / (maintenancePct * 4)) * 100))

            return (
              <tr key={p.id}>
                <td>
                  <span className={p.isLong ? 'pos-side-long' : 'pos-side-short'}>
                    {p.isLong ? 'Long' : 'Short'}
                  </span>
                </td>
                <td className="num">${formatUsdc(p.size)}</td>
                <td className="num">${formatUsdc(p.collateral)}</td>
                <td className="num">{formatPrice(p.entryPrice)}</td>
                <td className="num">{markPrice === undefined ? '--' : formatPrice(markPrice)}</td>
                {health === undefined ? (
                  <>
                    <td className="num">--</td>
                    <td className="num">--</td>
                  </>
                ) : (
                  <>
                    <td className={health.netIsProfit ? 'num pnl-up' : 'num pnl-down'}>
                      {health.netIsProfit ? '+' : '-'}${formatUsdc(health.netResult)}
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
                  </>
                )}
                <td>
                  <button
                    type="button"
                    className="close-btn"
                    disabled={closePosition.isPending || closeBlockedReason !== undefined}
                    title={closeBlockedReason}
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
