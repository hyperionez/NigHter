import { useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { useMarket } from '@/features/market/hooks/useMarket.ts'
import { useSignedPrice } from '@/features/market/hooks/useSignedPrice.ts'
import { useUsdcCoins, largestCoin } from '../hooks/useUsdcCoins.ts'
import { useOpenPosition } from '../hooks/useOpenPosition.ts'
import { formatUsdc, formatPrice, formatBps, toUsdcRaw, maxLeverageFrom } from '@/lib/format.ts'
import './OpenPositionForm.css'

const LEVERAGE_PRESETS = [2, 5, 10]

export function OpenPositionForm() {
  const account = useCurrentAccount()
  const { market } = useMarket()
  const { data: coins } = useUsdcCoins()
  const openPosition = useOpenPosition()

  const signedMode = market?.usesSignedPrice === true
  const stalenessWindowMs = market ? Number(market.maxPriceStalenessSecs) * 1000 : undefined
  const signed = useSignedPrice(signedMode, stalenessWindowMs)

  const [collateral, setCollateral] = useState('100')
  const [leverage, setLeverage] = useState(10)
  const [isLong, setIsLong] = useState(true)

  if (!account) return null

  const coin = largestCoin(coins)
  const available = coin ? BigInt(coin.balance) : 0n
  const collateralRaw = toUsdcRaw(Number(collateral) || 0)
  const maxLeverage = market ? maxLeverageFrom(market.initialMarginBps) : 0
  const sliderMax = maxLeverage > 0 ? maxLeverage : 1
  const leverageNum = Math.min(Math.max(leverage, 1), sliderMax)
  const sizeRaw = collateralRaw * BigInt(leverageNum)

  const entryPrice = signedMode ? signed.report?.price : market ? BigInt(market.mockPrice) : undefined
  const openFeeRaw = market ? (sizeRaw * BigInt(market.openFeeBps)) / 10_000n : 0n

  const liquidationPrice = (() => {
    if (entryPrice === undefined || market === undefined) return undefined
    const maintenance = Number(market.maintenanceMarginBps) / 10_000
    const edge = maintenance - 1 / leverageNum
    const factor = isLong ? 1 + edge : 1 - edge
    return BigInt(Math.round(Number(entryPrice) * factor))
  })()

  const problem = !market
    ? 'Loading market...'
    : market.paused
      ? 'Market is paused, so opens and closes are rejected on chain.'
      : signed.blockedReason
        ? signed.blockedReason
        : collateralRaw <= 0n
          ? 'Enter a collateral amount'
          : collateralRaw > available
            ? `Not enough TEST_USDC (have $${formatUsdc(available)})`
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
      <div className="side-toggle">
        <button
          type="button"
          className={isLong ? 'side side-long side-active' : 'side'}
          onClick={() => setIsLong(true)}
        >
          Long
        </button>
        <button
          type="button"
          className={!isLong ? 'side side-short side-active' : 'side'}
          onClick={() => setIsLong(false)}
        >
          Short
        </button>
      </div>

      <div className="field">
        <div className="field-head">
          <label htmlFor="collateral">Collateral</label>
          <span className="field-aside">Balance {formatUsdc(available)}</span>
        </div>
        <div className="input-shell">
          <input
            id="collateral"
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
            inputMode="decimal"
          />
          <span className="input-suffix">USDC</span>
        </div>
      </div>

      <div className="field">
        <div className="field-head">
          <label htmlFor="leverage-range">Leverage</label>
          <strong className="leverage-value">{leverageNum}x</strong>
        </div>
        <input
          id="leverage-range"
          className="leverage-range"
          type="range"
          min={1}
          max={sliderMax}
          step={1}
          value={leverageNum}
          disabled={!market}
          onChange={(e) => setLeverage(Number(e.target.value))}
        />
        <div className="leverage-chips">
          {LEVERAGE_PRESETS.filter((preset) => preset <= sliderMax).map((preset) => (
            <button
              key={preset}
              type="button"
              className={leverageNum === preset ? 'chip chip-active' : 'chip'}
              onClick={() => setLeverage(preset)}
            >
              {preset}x
            </button>
          ))}
          <span className="chip-max">max {sliderMax}x</span>
        </div>
      </div>

      <dl className="summary">
        <div className="summary-row">
          <dt>Position size</dt>
          <dd>${formatUsdc(sizeRaw)}</dd>
        </div>
        <div className="summary-row">
          <dt>Entry price</dt>
          <dd>{entryPrice === undefined ? '--' : `$${formatPrice(entryPrice)}`}</dd>
        </div>
        <div className="summary-row">
          <dt>Liquidation est.</dt>
          <dd className={isLong ? 'num-long' : 'num-short'}>
            {liquidationPrice === undefined ? '--' : `$${formatPrice(liquidationPrice)}`}
          </dd>
        </div>
        <div className="summary-row">
          <dt>
            Open fee <span className="dim">{market ? formatBps(market.openFeeBps) : ''}</span>
          </dt>
          <dd>${formatUsdc(openFeeRaw)}</dd>
        </div>
      </dl>

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
