import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { useMarket, useVault } from '@/features/market/hooks/useMarket.ts'
import { useRoles } from '@/features/roles/hooks/useRoles.ts'
import { usePositions } from '@/features/trading/hooks/usePositions.ts'
import { useUsdcCoins, largestCoin } from '@/features/trading/hooks/useUsdcCoins.ts'
import { MarketDashboard } from '@/features/market/components/MarketDashboard.tsx'
import { usePrivacy } from '@/app/privacy.tsx'
import { formatUsdc, formatPrice } from '@/lib/format.ts'
import { useTradeHistory, type ClosedTrade } from '../hooks/useTradeHistory.ts'
import './AccountOverview.css'

function signedUsdc(amount: bigint): string {
  const sign = amount < 0n ? '-' : '+'
  return `${sign}${formatUsdc(amount < 0n ? -amount : amount)}`
}

function PnlCurve({ trades }: { trades: ClosedTrade[] }) {
  if (trades.length === 0) {
    return <p className="muted curve-empty">No closed trades yet.</p>
  }

  const points: number[] = [0]
  let running = 0
  for (const trade of trades) {
    running += Number(trade.isProfit ? trade.amount : -trade.amount)
    points.push(running)
  }

  const high = Math.max(...points, 0)
  const low = Math.min(...points, 0)
  const span = high - low || 1
  const width = 100
  const height = 100

  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1 || 1)) * width
    const y = height - ((value - low) / span) * height
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  const zeroY = height - ((0 - low) / span) * height
  const up = running >= 0

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="curve">
      <line className="curve-zero" x1={0} x2={width} y1={zeroY} y2={zeroY} />
      <polyline className={up ? 'curve-line curve-up' : 'curve-line curve-down'} points={coords.join(' ')} />
    </svg>
  )
}

export function AccountOverview() {
  const account = useCurrentAccount()
  const { market } = useMarket()
  const { vault } = useVault()
  const { roles } = useRoles()
  const { data: positions } = usePositions()
  const { data: coins } = useUsdcCoins()
  const { data: history } = useTradeHistory()
  const { mask } = usePrivacy()

  if (!account) return <p className="muted">Connect a testnet wallet to see your account.</p>
  if (!market || !vault) return <p className="muted">Loading your account...</p>

  const wallet = largestCoin(coins) ? BigInt(largestCoin(coins)!.balance) : 0n
  const inTrades = (positions ?? []).reduce((sum, p) => sum + p.collateral, 0n)
  const lpSupply = BigInt(vault.lpSupply)
  const inPool =
    lpSupply === 0n ? 0n : (roles.totalLpShares * BigInt(vault.balance)) / lpSupply
  const total = wallet + inTrades + inPool

  const closed = history?.trades.length ?? 0
  const winRate = closed === 0 ? 0 : Math.round(((history?.wins ?? 0) / closed) * 100)

  return (
    <section className="overview">
      <div className="market-bar">
        <div className="bar-cell">
          <span className="stat-label">Total</span>
          <span className="stat-value stat-value-lg">{mask(formatUsdc(total))}</span>
          <span className="cell-note">wallet, open trades and pool together</span>
        </div>
        <div className="bar-cell">
          <span className="stat-label">In your wallet</span>
          <span className="stat-value stat-value-lg">{mask(formatUsdc(wallet))}</span>
          <span className="cell-note">free to trade or deposit</span>
        </div>
        <div className="bar-cell">
          <span className="stat-label">In open trades</span>
          <span className="stat-value stat-value-lg">{mask(formatUsdc(inTrades))}</span>
          <span className="cell-note">{positions?.length ?? 0} open</span>
        </div>
        <div className="bar-cell">
          <span className="stat-label">In the pool</span>
          <span className="stat-value stat-value-lg">{mask(formatUsdc(inPool))}</span>
          <span className="cell-note">{roles.lpReceipts.length} deposits</span>
        </div>
      </div>

      <div className="overview-body">
        <section className="panel overview-perf">
          <div className="panel-head">
            <span className="panel-title">Closed trade results</span>
            <span className="panel-meta">{closed} closed</span>
            <span className="panel-spacer" />
            <span
              className={
                (history?.realized ?? 0n) < 0n ? 'stat-value num-short' : 'stat-value num-long'
              }
            >
              {mask(signedUsdc(history?.realized ?? 0n))}
            </span>
          </div>

          <div className="curve-frame">
            <PnlCurve trades={history?.trades ?? []} />
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <tbody>
                <tr>
                  <td className="key">Trades won</td>
                  <td className="num">
                    {history?.wins ?? 0} of {closed} ({winRate}%)
                  </td>
                </tr>
                <tr>
                  <td className="key">Best result</td>
                  <td className="num num-long">{mask(signedUsdc(history?.best ?? 0n))}</td>
                </tr>
                <tr>
                  <td className="key">Worst result</td>
                  <td className="num num-short">{mask(signedUsdc(history?.worst ?? 0n))}</td>
                </tr>
                <tr>
                  <td className="key">Closed automatically</td>
                  <td className="num">{history?.liquidated ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel overview-holdings">
          <div className="panel-head">
            <span className="panel-title">What you hold</span>
            <span className="panel-meta">{account.address.slice(0, 6)}...{account.address.slice(-4)}</span>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Holding</th>
                  <th scope="col" className="num">Amount</th>
                  <th scope="col" className="num">Worth</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="key">Test USDC</td>
                  <td className="num">{mask(formatUsdc(wallet))}</td>
                  <td className="num">{mask(formatUsdc(wallet))}</td>
                </tr>
                {(positions ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className={p.isLong ? 'pos-side-long' : 'pos-side-short'}>
                      {p.isLong ? 'LONG' : 'SHORT'} at {formatPrice(p.entryPrice)}
                    </td>
                    <td className="num">{mask(formatUsdc(p.size))}</td>
                    <td className="num">{mask(formatUsdc(p.collateral))}</td>
                  </tr>
                ))}
                {roles.lpReceipts.map((receipt) => {
                  const value =
                    lpSupply === 0n ? 0n : (receipt.shares * BigInt(vault.balance)) / lpSupply
                  return (
                    <tr key={receipt.id}>
                      <td className="key">Pool deposit</td>
                      <td className="num">{mask(formatUsdc(receipt.shares))}</td>
                      <td className="num">{mask(formatUsdc(value))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <MarketDashboard />
    </section>
  )
}
