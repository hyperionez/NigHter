import { useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { useMarket, useVault } from '@/features/market/hooks/useMarket.ts'
import { useRoles } from '@/features/roles/hooks/useRoles.ts'
import { useUsdcCoins, largestCoin } from '@/features/trading/hooks/useUsdcCoins.ts'
import {
  useDepositLiquidity,
  useWithdrawLiquidity,
  useWithdrawPartial,
  useMergeReceipts,
} from '../hooks/useLiquidity.ts'
import { formatUsdc, toUsdcRaw } from '@/lib/format.ts'
import { usePrivacy } from '@/app/privacy.tsx'
import './LiquidityPanel.css'

function shortId(id: string): string {
  return `${id.slice(0, 6)}...${id.slice(-4)}`
}

export function LiquidityPanel() {
  const account = useCurrentAccount()
  const { market } = useMarket()
  const { vault } = useVault()
  const { roles } = useRoles()
  const { data: coins } = useUsdcCoins()

  const deposit = useDepositLiquidity()
  const withdrawAll = useWithdrawLiquidity()
  const withdrawPart = useWithdrawPartial()
  const merge = useMergeReceipts()
  const { mask } = usePrivacy()

  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit')
  const [depositAmount, setDepositAmount] = useState('1000')
  const [withdrawShares, setWithdrawShares] = useState('')

  if (!account) return <p className="muted">Connect a testnet wallet to put money into the pool.</p>
  if (!market || !vault) return <p className="muted">Loading the pool...</p>

  const balance = BigInt(vault.balance)
  const lpSupply = BigInt(vault.lpSupply)
  const locked = BigInt(market.longOpenInterest) + BigInt(market.shortOpenInterest)
  const free = locked >= balance ? 0n : balance - locked
  const reservedPct = balance === 0n ? 0 : Number((locked * 10_000n) / balance) / 100

  const myShares = roles.totalLpShares
  const myValue = lpSupply === 0n ? 0n : (myShares * balance) / lpSupply
  const sharePct = lpSupply === 0n ? 0 : Number((myShares * 10_000n) / lpSupply) / 100

  const coin = largestCoin(coins)
  const walletUsdc = coin ? BigInt(coin.balance) : 0n
  const depositRaw = toUsdcRaw(Number(depositAmount) || 0)
  const sharesOut = lpSupply === 0n || balance === 0n ? depositRaw : (depositRaw * lpSupply) / balance
  const sharePriceMilli = lpSupply === 0n ? 1000n : (balance * 1000n) / lpSupply
  const shareAfterPct =
    lpSupply + sharesOut === 0n
      ? 0
      : Number(((myShares + sharesOut) * 10_000n) / (lpSupply + sharesOut)) / 100

  const firstReceipt = roles.lpReceipts[0]
  const sharesRaw = withdrawShares === '' ? 0n : BigInt(Math.floor(Number(withdrawShares) || 0))
  const partialValue = lpSupply === 0n ? 0n : (sharesRaw * balance) / lpSupply

  const depositProblem =
    depositRaw <= 0n
      ? 'Enter an amount'
      : depositRaw > walletUsdc
        ? `Not enough TEST_USDC (have ${formatUsdc(walletUsdc)})`
        : undefined

  const withdrawProblem = !firstReceipt
    ? 'You have not deposited anything yet'
    : sharesRaw <= 0n
      ? 'Enter a share amount'
      : sharesRaw >= firstReceipt.shares
        ? 'Take the whole deposit out from the table instead'
        : partialValue > free
          ? `Only ${formatUsdc(free)} of the pool is free right now`
          : undefined

  const pending = deposit.isPending || withdrawAll.isPending || withdrawPart.isPending
  const failure = deposit.error ?? withdrawAll.error ?? withdrawPart.error ?? merge.error
  const lockedReceipt = roles.lpReceipts.some(
    (r) => (lpSupply === 0n ? 0n : (r.shares * balance) / lpSupply) > free,
  )

  return (
    <section className="liquidity">
      <div className="market-bar">
        <div className="bar-cell">
          <span className="stat-label">Pool size</span>
          <span className="stat-value stat-value-lg">{formatUsdc(balance)}</span>
          <span className="cell-note">test dollars sitting in the pool</span>
        </div>
        <div className="bar-cell">
          <span className="stat-label">Your share</span>
          <span className="stat-value stat-value-lg">{mask(`${sharePct}%`)}</span>
          <span className="cell-note">worth {mask(formatUsdc(myValue))} right now</span>
        </div>
        <div className="bar-cell">
          <span className="stat-label">Free to take out</span>
          <span className="stat-value stat-value-lg">{formatUsdc(free)}</span>
          <div className="meter" aria-hidden="true">
            <span className="meter-reserved" style={{ width: `${reservedPct}%` }} />
          </div>
          <span className="cell-note">{reservedPct}% is backing open trades</span>
        </div>
        <div className="bar-cell">
          <span className="stat-label">Backing open trades</span>
          <span className="stat-value stat-value-lg">{formatUsdc(locked)}</span>
          <span className="cell-note">cannot be taken out while those trades run</span>
        </div>
      </div>

      <div className="liquidity-body">
        <section className="panel panel-pad lp-ticket">
          <div className="segmented">
            <button
              type="button"
              className={mode === 'deposit' ? 'seg-on' : undefined}
              onClick={() => setMode('deposit')}
            >
              Deposit
            </button>
            <button
              type="button"
              className={mode === 'withdraw' ? 'seg-on' : undefined}
              onClick={() => setMode('withdraw')}
            >
              Withdraw
            </button>
          </div>

          {mode === 'deposit' ? (
            <>
              <div className="field">
                <div className="field-head">
                  <label htmlFor="lp-amount">Amount</label>
                  <span className="field-aside">Balance {mask(formatUsdc(walletUsdc))}</span>
                </div>
                <div className="input-shell">
                  <input
                    id="lp-amount"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    inputMode="decimal"
                  />
                  <button
                    type="button"
                    className="max-btn"
                    onClick={() => setDepositAmount(formatUsdc(walletUsdc).replace(/,/g, ''))}
                  >
                    MAX
                  </button>
                  <span className="input-suffix">USDC</span>
                </div>
              </div>

              <div className="rows">
                <div>
                  <span>Shares you get</span>
                  <span>{formatUsdc(sharesOut)}</span>
                </div>
                <div>
                  <span>Your share afterwards</span>
                  <span>{shareAfterPct}%</span>
                </div>
                <div>
                  <span>Price per share</span>
                  <span>{(Number(sharePriceMilli) / 1000).toFixed(4)}</span>
                </div>
              </div>

              <button
                type="button"
                className="submit"
                disabled={depositProblem !== undefined || pending || !coin}
                onClick={() =>
                  deposit.mutate({
                    coinId: coin!.objectId,
                    amount: depositRaw,
                    recipient: account.address,
                  })
                }
              >
                {deposit.isPending ? 'Confirm in wallet...' : `Deposit ${formatUsdc(depositRaw)} USDC`}
              </button>
              {depositProblem && <p className="hint">{depositProblem}</p>}
            </>
          ) : (
            <>
              <div className="field">
                <div className="field-head">
                  <label htmlFor="lp-shares">Shares to cash in</label>
                  <span className="field-aside">
                    {firstReceipt ? `This deposit holds ${formatUsdc(firstReceipt.shares)}` : 'Nothing deposited'}
                  </span>
                </div>
                <div className="input-shell">
                  <input
                    id="lp-shares"
                    value={withdrawShares}
                    onChange={(e) => setWithdrawShares(e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                  />
                  <span className="input-suffix">shares</span>
                </div>
              </div>

              <div className="rows">
                <div>
                  <span>You get back about</span>
                  <span>{formatUsdc(partialValue)} USDC</span>
                </div>
                <div>
                  <span>Free in the pool</span>
                  <span>{formatUsdc(free)} USDC</span>
                </div>
              </div>

              <button
                type="button"
                className="submit"
                disabled={withdrawProblem !== undefined || pending}
                onClick={() =>
                  withdrawPart.mutate({
                    receiptId: firstReceipt!.id,
                    shares: sharesRaw,
                    recipient: account.address,
                  })
                }
              >
                {withdrawPart.isPending ? 'Confirm in wallet...' : 'Cash in part of it'}
              </button>
              {withdrawProblem && <p className="hint">{withdrawProblem}</p>}

              {roles.lpReceipts.length > 1 && (
                <button
                  type="button"
                  className="ghost-btn ghost-btn-lg"
                  disabled={merge.isPending}
                  onClick={() => merge.mutate({ receiptIds: roles.lpReceipts.map((r) => r.id) })}
                >
                  {merge.isPending ? 'Confirm...' : `Combine ${roles.lpReceipts.length} deposits into one`}
                </button>
              )}
            </>
          )}

          <span className="explainer">
            You are on the other side of every trade here. When traders win, the money comes out of
            this pool; when they lose, it goes in. So your share is worth more when traders lose and
            less when they win.
          </span>
        </section>

        <section className="panel lp-receipts">
          <div className="panel-head">
            <span className="panel-title">Your deposits</span>
            <span className="panel-meta">{roles.lpReceipts.length}</span>
          </div>

          {roles.lpReceipts.length === 0 ? (
            <div className="positions-empty">
              <p className="muted">Nothing deposited from this wallet yet.</p>
              <p className="hint">
                Each deposit becomes its own entry here. They can be split and combined, so taking out
                part of one never leaves an empty leftover behind.
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Deposit</th>
                    <th scope="col" className="num">Shares</th>
                    <th scope="col" className="num">Worth now</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {roles.lpReceipts.map((receipt) => {
                    const value = lpSupply === 0n ? 0n : (receipt.shares * balance) / lpSupply
                    const redeemable = value <= free
                    return (
                      <tr key={receipt.id}>
                        <td className="key">{shortId(receipt.id)}</td>
                        <td className="num">{mask(formatUsdc(receipt.shares))}</td>
                        <td className="num num-long">{mask(formatUsdc(value))}</td>
                        <td className="num">
                          <button
                            type="button"
                            className="ghost-btn"
                            disabled={!redeemable || pending}
                            title={
                              redeemable
                                ? undefined
                                : 'Not enough free money in the pool to take this out yet'
                            }
                            onClick={() =>
                              withdrawAll.mutate({
                                receiptId: receipt.id,
                                recipient: account.address,
                              })
                            }
                          >
                            {withdrawAll.isPending ? '...' : 'Take out'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {lockedReceipt && (
            <div className="panel-note">
              One deposit cannot be taken out right now: only {formatUsdc(free)} of the pool is free,
              the rest is backing open trades. It frees up as those trades close.
            </div>
          )}
        </section>
      </div>

      {failure && <p className="error">{failure.message}</p>}
    </section>
  )
}
