import { checkLiquidatable, type OnChainMarket } from '@perp-dex/shared'
import { useMarket } from '@/features/market/hooks/useMarket.ts'
import { useSignedPrice } from '@/features/market/hooks/useSignedPrice.ts'
import { usePositions } from '../hooks/usePositions.ts'
import { useClosePosition } from '../hooks/useClosePosition.ts'
import { formatUsdc, formatPrice, formatBps } from '@/lib/format.ts'
import { usePrivacy } from '@/app/privacy.tsx'
import './PositionList.css'

export function PositionList() {
  const { market } = useMarket()
  const { data: positions, isPending } = usePositions()
  const closePosition = useClosePosition()
  const { mask } = usePrivacy()

  const signedMode = market?.usesSignedPrice === true
  const stalenessWindowMs = market ? Number(market.maxPriceStalenessSecs) * 1000 : undefined
  const signed = useSignedPrice(signedMode, stalenessWindowMs)

  if (!market) return null

  const closeBlockedReason = market.paused
    ? 'Trading is switched off. Your trade stays open and keeps paying the hourly rate, but it cannot be closed until trading is back on.'
    : signed.blockedReason

  if (isPending || !positions || positions.length === 0) {
    return (
      <section className="panel positions">
        <div className="panel-head">
          <span className="panel-title">Your trades</span>
          <span className="panel-meta">0</span>
        </div>
        <div className="positions-empty">
          <p className="muted">{isPending ? 'Loading your trades...' : 'No open trades yet.'}</p>
          {!isPending && (
            <p className="hint">
              A trade you open shows up here with its live profit or loss, and how close it is to
              the {Number(market.maintenanceMarginBps) / 100}% level where it closes automatically.
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
  const maintenancePct = Number(market.maintenanceMarginBps) / 100

  return (
    <section className="panel positions">
      <div className="panel-head">
        <span className="panel-title">Your trades</span>
        <span className="panel-meta">{positions.length}</span>
      </div>

      <div className="table-scroll">
        <table className="data-table position-table">
          <thead>
            <tr>
              <th scope="col">Direction</th>
              <th scope="col" className="num">Size</th>
              <th scope="col" className="num">Opening price</th>
              <th scope="col" className="num">Current price</th>
              <th scope="col" className="num">Profit / loss</th>
              <th scope="col">Safety</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const health =
                markPrice === undefined ? undefined : checkLiquidatable(p, marketState, markPrice)
              const marginPct = health ? Number(health.marginRatioBps) / 100 : 0
              const healthWidth = Math.max(0, Math.min(100, (marginPct / (maintenancePct * 4)) * 100))
              const nearFloor = health ? marginPct < maintenancePct * 2 : false

              return (
                <tr key={p.id}>
                  <td>
                    <span className={p.isLong ? 'pos-side pos-side-long' : 'pos-side pos-side-short'}>
                      {p.isLong ? 'LONG' : 'SHORT'}
                    </span>
                  </td>
                  <td className="num">{mask(formatUsdc(p.size))}</td>
                  <td className="num">{formatPrice(p.entryPrice)}</td>
                  <td className="num">{markPrice === undefined ? '--' : formatPrice(markPrice)}</td>
                  {health === undefined ? (
                    <>
                      <td className="num">--</td>
                      <td>--</td>
                    </>
                  ) : (
                    <>
                      <td className={health.netIsProfit ? 'num num-long' : 'num num-short'}>
                        {mask(`${health.netIsProfit ? '+' : '-'}${formatUsdc(health.netResult)}`)}
                      </td>
                      <td>
                        <div className="margin-cell">
                          <span className="health-track">
                            <span
                              className={
                                health.liquidatable
                                  ? 'health-bar health-danger'
                                  : nearFloor
                                    ? 'health-bar health-warn'
                                    : 'health-bar'
                              }
                              style={{ width: `${healthWidth}%` }}
                            />
                          </span>
                          <span className="key">{formatBps(health.marginRatioBps.toString())}</span>
                        </div>
                      </td>
                    </>
                  )}
                  <td className="num">
                    <button
                      type="button"
                      className="ghost-btn"
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
      </div>

      {(closeBlockedReason || closePosition.isError) && (
        <div className="panel-note">
          {closeBlockedReason && <span>{closeBlockedReason}</span>}
          {closePosition.isError && <span className="error">{closePosition.error.message}</span>}
        </div>
      )}
    </section>
  )
}
