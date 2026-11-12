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
import './LiquidityPanel.css'

function reserved(market: { longOpenInterest: string; shortOpenInterest: string }): bigint {
  return BigInt(market.longOpenInterest) + BigInt(market.shortOpenInterest)
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

  const [depositAmount, setDepositAmount] = useState('1000')
  const [withdrawShares, setWithdrawShares] = useState('')

  if (!account) return <p className="muted">Connect a testnet wallet to provide liquidity.</p>
  if (!market || !vault) return <p className="muted">Loading vault...</p>

  const balance = BigInt(vault.balance)
  const lpSupply = BigInt(vault.lpSupply)
  const locked = reserved(market)
  const free = locked >= balance ? 0n : balance - locked

  const myShares = roles.totalLpShares
  const myValue = lpSupply === 0n ? 0n : (myShares * balance) / lpSupply
  const sharePct = lpSupply === 0n ? 0 : Number((myShares * 10_000n) / lpSupply) / 100

  const coin = largestCoin(coins)
  const walletUsdc = coin ? BigInt(coin.balance) : 0n
  const depositRaw = toUsdcRaw(Number(depositAmount) || 0)

  const depositProblem =
    depositRaw <= 0n
      ? 'Enter an amount'
      : depositRaw > walletUsdc
        ? `Not enough TEST_USDC (have $${formatUsdc(walletUsdc)})`
        : undefined

  const sharesRaw = withdrawShares === '' ? 0n : BigInt(Math.floor(Number(withdrawShares) || 0))
  const partialValue = lpSupply === 0n ? 0n : (sharesRaw * balance) / lpSupply
  const withdrawProblem =
    !roles.isLp
      ? 'You hold no LP shares yet'
      : sharesRaw <= 0n
        ? 'Enter a share amount'
        : sharesRaw >= roles.lpReceipts[0]!.shares
          ? 'Use "Withdraw all" for the full receipt'
          : partialValue > free
            ? `Only $${formatUsdc(free)} is free right now`
            : undefined

  const pending = deposit.isPending || withdrawAll.isPending || withdrawPart.isPending
  const failure = deposit.error ?? withdrawAll.error ?? withdrawPart.error ?? merge.error

  return (
    <section className="liquidity">
      <div className="market-bar">
        <div className="bar-cell">
          <span className="stat-label">Vault TVL</span>
          <span className="stat-value">${formatUsdc(balance)}</span>
        </div>
        <div className="bar-cell">
          <span className="stat-label">Backing open positions</span>
          <span className="stat-value">${formatUsdc(locked)}</span>
        </div>
        <div className="bar-cell">
          <span className="stat-label">Free liquidity</span>
          <span className={free === 0n ? 'stat-value warn' : 'stat-value'}>${formatUsdc(free)}</span>
        </div>
        <div className="bar-cell">
          <span className="stat-label">Your share</span>
          <span className="stat-value">${formatUsdc(myValue)}</span>
          <span className="cell-note">{sharePct}% of the pool</span>
        </div>
      </div>

      <p className="reserve-note">
        Withdrawals are capped at free liquidity: the vault is the counterparty to every open
        position, so the amount backing them cannot be taken out.
      </p>

      <div className="lp-forms">
        <div className="lp-card">
          <h3>Deposit</h3>
          <label className="field">
            <span>Amount (TEST_USDC)</span>
            <input
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              inputMode="decimal"
            />
            <small>Wallet: ${formatUsdc(walletUsdc)}</small>
          </label>
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
            {deposit.isPending ? 'Confirm in wallet...' : 'Provide liquidity'}
          </button>
          {depositProblem && <p className="hint">{depositProblem}</p>}
        </div>

        <div className="lp-card">
          <h3>Withdraw</h3>
          {roles.lpReceipts.length === 0 ? (
            <p className="hint">No LP receipt in this wallet.</p>
          ) : (
            <>
              <label className="field">
                <span>Shares to redeem</span>
                <input
                  value={withdrawShares}
                  onChange={(e) => setWithdrawShares(e.target.value)}
                  inputMode="numeric"
                  placeholder={roles.lpReceipts[0]!.shares.toString()}
                />
                <small>
                  Receipt holds {roles.lpReceipts[0]!.shares.toString()} shares
                  {sharesRaw > 0n && ` · redeems ~$${formatUsdc(partialValue)}`}
                </small>
              </label>
              <div className="lp-actions">
                <button
                  type="button"
                  className="submit"
                  disabled={withdrawProblem !== undefined || pending}
                  onClick={() =>
                    withdrawPart.mutate({
                      receiptId: roles.lpReceipts[0]!.id,
                      shares: sharesRaw,
                      recipient: account.address,
                    })
                  }
                >
                  {withdrawPart.isPending ? 'Confirm...' : 'Withdraw part'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={pending}
                  onClick={() =>
                    withdrawAll.mutate({
                      receiptId: roles.lpReceipts[0]!.id,
                      recipient: account.address,
                    })
                  }
                >
                  {withdrawAll.isPending ? 'Confirm...' : 'Withdraw all'}
                </button>
              </div>
              {withdrawProblem && <p className="hint">{withdrawProblem}</p>}
              {roles.lpReceipts.length > 1 && (
                <button
                  type="button"
                  className="secondary merge"
                  disabled={merge.isPending}
                  onClick={() => merge.mutate({ receiptIds: roles.lpReceipts.map((r) => r.id) })}
                >
                  {merge.isPending
                    ? 'Confirm...'
                    : `Merge ${roles.lpReceipts.length} receipts into one`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {failure && <p className="error">{failure.message}</p>}
    </section>
  )
}
