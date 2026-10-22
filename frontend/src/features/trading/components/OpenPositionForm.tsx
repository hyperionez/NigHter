import { useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { useMarket } from '@/features/market/hooks/useMarket.ts'
import { useUsdcCoins, largestCoin } from '../hooks/useUsdcCoins.ts'
import { useOpenPosition } from '../hooks/useOpenPosition.ts'
import { formatUsdc, toUsdcRaw } from '@/lib/format.ts'
import './OpenPositionForm.css'

export function OpenPositionForm() {
  const account = useCurrentAccount()
  const { market } = useMarket()
  const { data: coins } = useUsdcCoins()
  const openPosition = useOpenPosition()

  const [collateral, setCollateral] = useState('100')
  const [leverage, setLeverage] = useState('10')
  const [isLong, setIsLong] = useState(true)

  if (!account) return null

  const coin = largestCoin(coins)
  const available = coin ? BigInt(coin.balance) : 0n
  const collateralRaw = toUsdcRaw(Number(collateral) || 0)
  const leverageNum = Number(leverage) || 0
  const sizeRaw = collateralRaw * BigInt(Math.max(leverageNum, 0))
  const maxLeverage = market ? 10_000 / Number(market.initialMarginBps) : 0

  const problem = !market
    ? 'Loading market...'
    : collateralRaw <= 0n
      ? 'Enter a collateral amount'
      : collateralRaw > available
        ? `Not enough TEST_USDC (have $${formatUsdc(available)})`
        : leverageNum < 1 || leverageNum > maxLeverage
          ? `Leverage must be between 1x and ${maxLeverage}x`
          : sizeRaw < BigInt(market.minPositionSize)
            ? `Position size below minimum ($${formatUsdc(market.minPositionSize)})`
            : undefined

  function submit() {
    if (problem || !coin) return
    openPosition.mutate({
      collateralCoinId: coin.objectId,
      collateralAmount: collateralRaw,
      isLong,
      leverage: leverageNum,
    })
  }

  return (
    <section className="open-position">
      <h2>Open position</h2>

      <div className="side-toggle">
        <button
          type="button"
          className={isLong ? 'side side-active' : 'side'}
          onClick={() => setIsLong(true)}
        >
          Long
        </button>
        <button
          type="button"
          className={!isLong ? 'side side-active side-short' : 'side'}
          onClick={() => setIsLong(false)}
        >
          Short
        </button>
      </div>

      <label className="field">
        <span>Collateral (TEST_USDC)</span>
        <input value={collateral} onChange={(e) => setCollateral(e.target.value)} inputMode="decimal" />
        <small>Available: ${formatUsdc(available)}</small>
      </label>

      <label className="field">
        <span>Leverage</span>
        <input value={leverage} onChange={(e) => setLeverage(e.target.value)} inputMode="numeric" />
        <small>Max {maxLeverage}x on this market</small>
      </label>

      <div className="summary">
        <span>Position size</span>
        <strong>${formatUsdc(sizeRaw)}</strong>
      </div>

      <button
        type="button"
        className="submit"
        disabled={problem !== undefined || openPosition.isPending}
        onClick={submit}
      >
        {openPosition.isPending ? 'Confirm in wallet...' : `Open ${isLong ? 'long' : 'short'}`}
      </button>

      {problem && <p className="hint">{problem}</p>}
      {openPosition.isError && <p className="error">{openPosition.error.message}</p>}
      {openPosition.isSuccess && (
        <p className="success">
          Position opened: <code>{openPosition.data.createdSharedObjectId ?? 'unknown id'}</code>
        </p>
      )}
    </section>
  )
}
